import fs from "node:fs";
import path from "node:path";
import { buildApp } from "./app.js";
import { MockAdapter } from "./adapters/mock/mock-adapter.js";
import { createAdapterRegistry } from "./adapters/registry.js";
import { TemuReconciliationAdapter } from "./adapters/temu/reconciliation-adapter.js";
import { BitBrowserClient } from "./bitbrowser/client.js";
import { CollectionEngine } from "./collection/engine.js";
import { loadConfig } from "./config/load-config.js";
import { ArtifactRepository } from "./db/artifact-repository.js";
import { JobRepository } from "./db/job-repository.js";
import { migrate } from "./db/migrate.js";
import { NormalizedRepository } from "./db/normalized-repository.js";
import { openDatabase } from "./db/open-database.js";
import { PublicationRepository } from "./db/publication-repository.js";
import { QuarantineRepository } from "./db/quarantine-repository.js";
import type { DatasetParser } from "./parsers/contracts.js";
import { MockFinanceParser } from "./parsers/mock-finance-parser.js";
import { TemuReconciliationParser } from "./parsers/temu-reconciliation-parser.js";
import { LocalPreviewPublisher } from "./publishers/local-preview.js";
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
const jobs = new JobRepository(db);
const artifacts = new ArtifactRepository(db);
const normalized = new NormalizedRepository(db);
const publications = new PublicationRepository(db);
const bitBrowser = new BitBrowserClient(config.bitBrowser.baseUrl);
const engine = new CollectionEngine({
  jobs,
  artifacts,
  normalized,
  quarantine: new QuarantineRepository(db),
  archiveRoot: paths.raw,
  adapters: createAdapterRegistry([
    new MockAdapter(),
    new TemuReconciliationAdapter({ db, bitBrowser })
  ]),
  parsers: new Map<string, DatasetParser>([
    ["finance_daily", new MockFinanceParser()],
    ["temu_reconciliation_statement", new TemuReconciliationParser()]
  ]),
  publishers: [
    new LocalPreviewPublisher(config.runtimeDir, normalized, publications)
  ]
});

const app = buildApp({
  db,
  runtimeDir: config.runtimeDir,
  adminDistDir: path.join(projectRoot, "admin", "dist"),
  collection: {
    engine,
    supportedDatasets: new Map([
      ["mock", new Set(["finance_daily"])],
      ["temu", new Set(["temu_reconciliation_statement"])]
    ]),
    maxFileBytes: 50 * 1024 * 1024,
    runCreatedJobs: true
  }
});
app.addHook("onClose", async () => {
  db.close();
});

await app.listen({ host: config.api.host, port: config.api.port });
