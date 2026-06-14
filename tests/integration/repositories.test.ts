import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JobRepository } from "../../src/db/job-repository.js";
import { migrate } from "../../src/db/migrate.js";
import { NormalizedRepository } from "../../src/db/normalized-repository.js";
import { openDatabase } from "../../src/db/open-database.js";

let directory: string;
let db: ReturnType<typeof openDatabase>;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "repositories-"));
  db = openDatabase(path.join(directory, "test.db"));
  migrate(db, path.resolve("migrations"));

  db.prepare(
    `INSERT INTO browser_profiles
      (id, provider, external_profile_id, display_name, status)
     VALUES (?, ?, ?, ?, ?)`
  ).run("profile-1", "bitbrowser", "external-1", "Profile 1", "active");
  db.prepare(
    `INSERT INTO accounts
      (id, platform, account_name, browser_profile_id, status)
     VALUES (?, ?, ?, ?, ?)`
  ).run("account-1", "mock", "Account 1", "profile-1", "active");
  db.prepare(
    `INSERT INTO shops
      (id, account_id, platform_shop_id, shop_name, status)
     VALUES (?, ?, ?, ?, ?)`
  ).run("shop-1", "account-1", "external-shop-1", "Shop 1", "active");
});

afterEach(() => {
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("JobRepository", () => {
  it("creates a job and updates its checkpoint and status", () => {
    const repository = new JobRepository(db);
    repository.create({
      id: "job-1",
      platform: "mock",
      accountId: "account-1",
      shopId: "shop-1",
      datasetCode: "finance_daily",
      businessFrom: "2026-06-14",
      businessTo: "2026-06-14",
      triggerType: "manual"
    });

    repository.update("job-1", {
      status: "running",
      checkpoint: "artifact_archived",
      attemptCount: 1
    });

    expect(repository.get("job-1")).toMatchObject({
      id: "job-1",
      status: "running",
      checkpoint: "artifact_archived",
      attemptCount: 1
    });
  });
});

describe("NormalizedRepository", () => {
  it("updates an existing natural key instead of inserting a duplicate", () => {
    const jobRepository = new JobRepository(db);
    jobRepository.create({
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "artifact-1",
      "job-1",
      "csv",
      "/tmp/first.csv",
      "hash-1",
      10,
      "{}",
      new Date().toISOString()
    );
    db.prepare(
      `INSERT INTO raw_artifacts
        (id, job_id, artifact_type, file_path, sha256, byte_size, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "artifact-2",
      "job-1",
      "csv",
      "/tmp/second.csv",
      "hash-2",
      11,
      "{}",
      new Date().toISOString()
    );

    const repository = new NormalizedRepository(db);
    const first = repository.upsert({
      platform: "mock",
      datasetCode: "finance_daily",
      accountId: "account-1",
      shopId: "shop-1",
      businessDate: "2026-06-14",
      naturalKey: "summary",
      currency: "USD",
      payload: { gmv: "100.00", refund: "5.00" },
      metrics: [
        { code: "gmv", value: "100.00", unit: "money", currency: "USD" }
      ],
      sourceArtifactId: "artifact-1"
    });
    const second = repository.upsert({
      platform: "mock",
      datasetCode: "finance_daily",
      accountId: "account-1",
      shopId: "shop-1",
      businessDate: "2026-06-14",
      naturalKey: "summary",
      currency: "USD",
      payload: { refund: "5.00", gmv: "110.00" },
      metrics: [
        { code: "gmv", value: "110.00", unit: "money", currency: "USD" }
      ],
      sourceArtifactId: "artifact-2"
    });

    expect(first.id).toBe(second.id);
    expect(repository.count()).toBe(1);
    expect(repository.get(first.id)).toMatchObject({
      payload: { gmv: "110.00", refund: "5.00" },
      sourceArtifactId: "artifact-2",
      metrics: [
        { code: "gmv", value: "110.00", unit: "money", currency: "USD" }
      ]
    });
  });
});
