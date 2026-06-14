import fs from "node:fs";
import path from "node:path";
import { openDatabase } from "../db/open-database.js";

const [source, destination] = process.argv.slice(2);
if (!source || !destination) {
  throw new Error(
    "Usage: node dist/cli/backup-database.js <source.db> <destination.db>"
  );
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
const db = openDatabase(source);
try {
  await db.backup(destination);
} finally {
  db.close();
}
