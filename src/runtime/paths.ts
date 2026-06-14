import path from "node:path";
import type { AppConfig } from "../config/schema.js";

export function runtimePaths(config: AppConfig) {
  const pathApi = path.posix.isAbsolute(config.runtimeDir)
    ? path.posix
    : path.win32;

  return {
    database: pathApi.join(config.runtimeDir, config.databaseFile),
    raw: pathApi.join(config.runtimeDir, "raw"),
    screenshots: pathApi.join(config.runtimeDir, "screenshots"),
    logs: pathApi.join(config.runtimeDir, "logs"),
    backups: pathApi.join(config.runtimeDir, "backups"),
    secrets: pathApi.join(config.runtimeDir, "secrets")
  };
}
