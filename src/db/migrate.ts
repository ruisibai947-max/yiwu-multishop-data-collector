import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

export function migrate(
  db: Database.Database,
  migrationDirectory: string
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const migrationFiles = fs
    .readdirSync(migrationDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const isApplied = db.prepare(
    "SELECT 1 FROM schema_migrations WHERE version = ?"
  );
  const recordMigration = db.prepare(
    "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)"
  );

  for (const migrationFile of migrationFiles) {
    if (isApplied.get(migrationFile)) {
      continue;
    }

    const sql = fs.readFileSync(
      path.join(migrationDirectory, migrationFile),
      "utf8"
    );

    db.transaction(() => {
      db.exec(sql);
      recordMigration.run(migrationFile, new Date().toISOString());
    })();
  }
}
