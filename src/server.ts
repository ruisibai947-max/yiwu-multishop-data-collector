import fs from "node:fs";
import path from "node:path";
import { buildApp } from "./app.js";
import { loadConfig } from "./config/load-config.js";
import { migrate } from "./db/migrate.js";
import { openDatabase } from "./db/open-database.js";
import { runtimePaths } from "./runtime/paths.js";

const projectRoot = process.cwd();
const configPath =
  process.env.YIWU_COLLECTOR_CONFIG ??
  path.join(projectRoot, "config", "app.local.json");
const config = loadConfig(configPath);
const paths = runtimePaths(config);

for (const directory of [
  config.runtimeDir,
  paths.raw,
  paths.screenshots,
  paths.logs,
  paths.backups,
  paths.secrets
]) {
  fs.mkdirSync(directory, { recursive: true });
}

const db = openDatabase(paths.database);
migrate(db, path.join(projectRoot, "migrations"));

const app = buildApp({
  db,
  runtimeDir: config.runtimeDir,
  adminDistDir: path.join(projectRoot, "admin", "dist")
});
app.addHook("onClose", async () => {
  db.close();
});

await app.listen({ host: config.api.host, port: config.api.port });
