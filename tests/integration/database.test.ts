import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/db/open-database.js";
import { migrate } from "../../src/db/migrate.js";

const temporaryDirectories: string[] = [];

function createDatabaseFile() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "collector-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "test.db");
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("database", () => {
  it("creates the initial tables", () => {
    const db = openDatabase(createDatabaseFile());
    migrate(db, path.resolve("migrations"));

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining([
        "browser_profiles",
        "accounts",
        "shops",
        "collection_jobs",
        "raw_artifacts",
        "normalized_rows",
        "metric_facts",
        "publications"
      ])
    );
    db.close();
  });

  it("applies each migration only once", () => {
    const db = openDatabase(createDatabaseFile());

    migrate(db, path.resolve("migrations"));
    migrate(db, path.resolve("migrations"));

    const result = db
      .prepare("SELECT COUNT(*) AS count FROM schema_migrations")
      .get() as { count: number };

    expect(result.count).toBe(2);
    db.close();
  });

  it("opens databases with WAL and foreign keys enabled", () => {
    const db = openDatabase(createDatabaseFile());

    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    db.close();
  });
});
