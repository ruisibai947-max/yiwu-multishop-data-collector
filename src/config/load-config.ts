import fs from "node:fs";
import { parseAppConfig, type AppConfig } from "./schema.js";

export function loadConfig(file: string): AppConfig {
  return parseAppConfig(JSON.parse(fs.readFileSync(file, "utf8")));
}
