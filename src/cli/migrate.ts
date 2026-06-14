import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../config/load-config.js";
import { migrate } from "../db/migrate.js";
import { openDatabase } from "../db/open-database.js";
import { runtimePaths } from "../runtime/paths.js";

function configArgument(args: string[]): string {
  const index = args.indexOf("--config");
  const configured = index >= 0 ? args[index + 1] : undefined;
  return configured ?? path.resolve("config/app.local.json");
}

const config = loadConfig(configArgument(process.argv.slice(2)));
const paths = runtimePaths(config);
fs.mkdirSync(config.runtimeDir, { recursive: true });
const db = openDatabase(paths.database);

try {
  migrate(db, path.resolve("migrations"));
} finally {
  db.close();
}
