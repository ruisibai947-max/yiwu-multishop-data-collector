import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JobRepository } from "../../src/db/job-repository.js";
import { migrate } from "../../src/db/migrate.js";
import { NormalizedRepository } from "../../src/db/normalized-repository.js";
import { openDatabase } from "../../src/db/open-database.js";
import { PublicationRepository } from "../../src/db/publication-repository.js";
import {
  FeishuPublisher,
  type FeishuTransport
} from "../../src/publishers/feishu.js";
import { LocalPreviewPublisher } from "../../src/publishers/local-preview.js";

let directory: string;
let db: ReturnType<typeof openDatabase>;
let normalized: NormalizedRepository;
let rowId: string;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "publishers-"));
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
  new JobRepository(db).create({
    id: "job-1",
    platform: "mock",
    accountId: "account-1",
    shopId: "shop-1",
    datasetCode: "finance_daily",
    businessFrom: "2026-06-14",
    businessTo: "2026-06-14",
    triggerType: "manual"
  });
  db.prepare(
    `INSERT INTO raw_artifacts
      (id, job_id, artifact_type, file_path, sha256, byte_size, metadata_json, created_at)
     VALUES ('artifact-1', 'job-1', 'csv', '/tmp/report.csv', 'hash', 10, '{}', ?)`
  ).run(new Date().toISOString());
  normalized = new NormalizedRepository(db);
  rowId = normalized.upsert({
    platform: "mock",
    datasetCode: "finance_daily",
    accountId: "account-1",
    shopId: "shop-1",
    businessDate: "2026-06-14",
    naturalKey: "summary",
    currency: "USD",
    payload: {
      gmv: "100.00",
      cookie: "must-not-leak",
      responseHeaders: { authorization: "must-not-leak" }
    },
    metrics: [
      { code: "gmv", value: "100.00", unit: "money", currency: "USD" }
    ],
    sourceArtifactId: "artifact-1"
  }).id;
});

afterEach(() => {
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("LocalPreviewPublisher", () => {
  it("writes normalized business data without secret-like fields", async () => {
    const publisher = new LocalPreviewPublisher(directory, normalized);

    await publisher.publish({
      batchKey: "finance_daily:2026-06-14:shop-1",
      datasetCode: "finance_daily",
      rowIds: [rowId]
    });

    const outputPath = path.join(
      directory,
      "preview",
      "finance_daily",
      "2026-06-14-shop-1.json"
    );
    const output = fs.readFileSync(outputPath, "utf8");
    expect(JSON.parse(output)).toMatchObject([
      {
        businessDate: "2026-06-14",
        shopId: "shop-1",
        naturalKey: "summary",
        payload: { gmv: "100.00" }
      }
    ]);
    expect(output).not.toContain("must-not-leak");
    expect(output).not.toContain("cookie");
    expect(output).not.toContain("authorization");
  });
});

describe("FeishuPublisher", () => {
  it("records a failed attempt and retries without changing normalized rows", async () => {
    const publications = new PublicationRepository(db);
    let calls = 0;
    const transport: FeishuTransport = {
      async publish() {
        calls += 1;
        if (calls === 1) {
          throw new Error("temporary Feishu failure");
        }
      }
    };
    const publisher = new FeishuPublisher(
      {
        appToken: "test-app-token",
        tableId: "test-table",
        enabled: true
      },
      publications,
      normalized,
      transport
    );
    const batch = {
      batchKey: "finance_daily:2026-06-14:shop-1",
      datasetCode: "finance_daily",
      rowIds: [rowId]
    };

    await expect(publisher.publish(batch)).rejects.toThrow(
      "temporary Feishu failure"
    );
    await publisher.publish(batch);

    expect(normalized.count()).toBe(1);
    expect(
      publications.get("feishu", batch.batchKey)
    ).toMatchObject({
      status: "succeeded",
      attemptCount: 2
    });
  });

  it("creates no publication when Feishu is disabled", async () => {
    const publications = new PublicationRepository(db);
    const transport: FeishuTransport = {
      async publish() {
        throw new Error("must not be called");
      }
    };
    const publisher = new FeishuPublisher(
      {
        appToken: "",
        tableId: "",
        enabled: false
      },
      publications,
      normalized,
      transport
    );

    await publisher.publish({
      batchKey: "disabled-batch",
      datasetCode: "finance_daily",
      rowIds: [rowId]
    });

    expect(publications.count()).toBe(0);
  });
});
