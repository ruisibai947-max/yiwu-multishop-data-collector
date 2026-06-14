import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MockAdapter } from "../../src/adapters/mock/mock-adapter.js";
import { createAdapterRegistry } from "../../src/adapters/registry.js";
import { CollectionEngine } from "../../src/collection/engine.js";
import { ArtifactRepository } from "../../src/db/artifact-repository.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { migrate } from "../../src/db/migrate.js";
import { NormalizedRepository } from "../../src/db/normalized-repository.js";
import { openDatabase } from "../../src/db/open-database.js";
import { PublicationRepository } from "../../src/db/publication-repository.js";
import { QuarantineRepository } from "../../src/db/quarantine-repository.js";
import { MockFinanceParser } from "../../src/parsers/mock-finance-parser.js";
import { LocalPreviewPublisher } from "../../src/publishers/local-preview.js";

let directory: string;
let db: ReturnType<typeof openDatabase>;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "mock-e2e-"));
  db = openDatabase(path.join(directory, "collector.db"));
  migrate(db, path.resolve("migrations"));
  db.prepare(
    `INSERT INTO browser_profiles
      (id, provider, external_profile_id, display_name, status)
     VALUES ('profile-1', 'bitbrowser', 'mock-profile', 'Mock Profile', 'active')`
  ).run();
  db.prepare(
    `INSERT INTO accounts
      (id, platform, account_name, browser_profile_id, status)
     VALUES ('account-1', 'mock', 'Mock Account', 'profile-1', 'active')`
  ).run();
  db.prepare(
    `INSERT INTO shops
      (id, account_id, platform_shop_id, shop_name, currency, timezone, status)
     VALUES (
       'shop-1', 'account-1', 'mock-shop-1', 'Mock Shop',
       'USD', 'Asia/Shanghai', 'active'
     )`
  ).run();
});

afterEach(() => {
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("mock collection foundation", () => {
  it("runs twice while keeping normalized data and publication idempotent", async () => {
    const csvContent = fs.readFileSync(
      path.resolve("tests/fixtures/mock/finance-daily.csv"),
      "utf8"
    );
    const jobs = new JobRepository(db);
    const artifacts = new ArtifactRepository(db);
    const normalized = new NormalizedRepository(db);
    const publications = new PublicationRepository(db);
    const adapter = new MockAdapter({ csvContent });
    const engine = new CollectionEngine({
      jobs,
      artifacts,
      normalized,
      quarantine: new QuarantineRepository(db),
      archiveRoot: path.join(directory, "raw"),
      adapters: createAdapterRegistry([adapter]),
      parsers: new Map([["finance_daily", new MockFinanceParser()]])
    });
    const publisher = new LocalPreviewPublisher(
      directory,
      normalized,
      publications
    );

    for (const jobId of ["job-first", "job-rerun"]) {
      jobs.create({
        id: jobId,
        platform: "mock",
        accountId: "account-1",
        shopId: "shop-1",
        datasetCode: "finance_daily",
        businessFrom: "2026-06-14",
        businessTo: "2026-06-14",
        triggerType: "manual"
      });
      const completed = await engine.run(jobId);
      expect(completed.status).toBe("succeeded");

      const row = db
        .prepare(
          `SELECT id FROM normalized_rows
           WHERE shop_id = 'shop-1' AND business_date = '2026-06-14'`
        )
        .get() as { id: string };
      await publisher.publish({
        batchKey: "finance_daily:2026-06-14:shop-1",
        datasetCode: "finance_daily",
        rowIds: [row.id]
      });
    }

    expect(artifacts.count()).toBe(2);
    expect(normalized.count()).toBe(1);
    expect(publications.count()).toBe(1);
    expect(
      publications.get(
        "local_preview",
        "finance_daily:2026-06-14:shop-1"
      )
    ).toMatchObject({
      status: "succeeded",
      attemptCount: 2
    });
    expect(
      fs.existsSync(
        path.join(
          directory,
          "preview",
          "finance_daily",
          "2026-06-14-shop-1.json"
        )
      )
    ).toBe(true);
  });
});
