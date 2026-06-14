import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerManualArtifactRoutes } from "../../src/api/manual-artifact-routes.js";
import { CollectionEngine } from "../../src/collection/engine.js";
import { ArtifactRepository } from "../../src/db/artifact-repository.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { migrate } from "../../src/db/migrate.js";
import { NormalizedRepository } from "../../src/db/normalized-repository.js";
import { openDatabase } from "../../src/db/open-database.js";
import { QuarantineRepository } from "../../src/db/quarantine-repository.js";
import { MockFinanceParser } from "../../src/parsers/mock-finance-parser.js";

let directory: string;
let db: ReturnType<typeof openDatabase>;
let jobs: JobRepository;
let artifacts: ArtifactRepository;
let normalized: NormalizedRepository;

function multipartBody(
  fields: Record<string, string>,
  file: { filename: string; content: string }
) {
  const boundary = "----codex-test-boundary";
  const chunks: string[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="${name}"\r\n\r\n`,
      `${value}\r\n`
    );
  }
  chunks.push(
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="${file.filename}"\r\n`,
    "Content-Type: text/csv\r\n\r\n",
    `${file.content}\r\n`,
    `--${boundary}--\r\n`
  );
  return {
    boundary,
    body: Buffer.from(chunks.join(""), "utf8")
  };
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "manual-artifact-"));
  db = openDatabase(path.join(directory, "test.db"));
  migrate(db, path.resolve("migrations"));
  db.prepare(
    `INSERT INTO browser_profiles
      (id, provider, external_profile_id, display_name, status)
     VALUES ('profile-1', 'bitbrowser', 'external-1', 'Profile 1', 'active')`
  ).run();
  db.prepare(
    `INSERT INTO accounts
      (id, platform, account_name, browser_profile_id, status)
     VALUES ('account-1', 'mock', 'Account 1', 'profile-1', 'active')`
  ).run();
  db.prepare(
    `INSERT INTO shops
      (id, account_id, platform_shop_id, shop_name, status)
     VALUES ('shop-1', 'account-1', 'external-shop-1', 'Shop 1', 'active')`
  ).run();
  jobs = new JobRepository(db);
  artifacts = new ArtifactRepository(db);
  normalized = new NormalizedRepository(db);
});

afterEach(() => {
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

function buildTestApp(maxFileBytes = 1024 * 1024) {
  const app = Fastify();
  const engine = new CollectionEngine({
    jobs,
    artifacts,
    normalized,
    quarantine: new QuarantineRepository(db),
    archiveRoot: path.join(directory, "raw"),
    adapters: new Map(),
    parsers: new Map([["finance_daily", new MockFinanceParser()]])
  });
  registerManualArtifactRoutes(app, {
    db,
    jobs,
    engine,
    supportedDatasets: new Map([["mock", new Set(["finance_daily"])]]),
    maxFileBytes
  });
  return app;
}

describe("POST /api/manual-artifacts", () => {
  it("archives and ingests an approved manually exported report", async () => {
    const app = buildTestApp();
    const multipart = multipartBody(
      {
        accountId: "account-1",
        shopId: "shop-1",
        datasetCode: "finance_daily",
        businessFrom: "2026-06-14",
        businessTo: "2026-06-14"
      },
      {
        filename: "finance.csv",
        content: [
          "business_date,natural_key,currency,gmv,refund",
          "2026-06-14,summary,USD,120.00,3.00"
        ].join("\n")
      }
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/manual-artifacts",
      headers: {
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`
      },
      payload: multipart.body
    });
    await app.close();

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      status: "succeeded",
      triggerType: "manual"
    });
    expect(artifacts.count()).toBe(1);
    expect(normalized.count()).toBe(1);
  });

  it("rejects unsupported file extensions", async () => {
    const app = buildTestApp();
    const multipart = multipartBody(
      {
        accountId: "account-1",
        shopId: "shop-1",
        datasetCode: "finance_daily",
        businessFrom: "2026-06-14",
        businessTo: "2026-06-14"
      },
      {
        filename: "finance.exe",
        content: "not a report"
      }
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/manual-artifacts",
      headers: {
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`
      },
      payload: multipart.body
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(artifacts.count()).toBe(0);
  });
});
