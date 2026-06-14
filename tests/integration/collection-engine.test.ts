import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MockAdapter } from "../../src/adapters/mock/mock-adapter.js";
import { CollectionEngine } from "../../src/collection/engine.js";
import { RetryableCollectionError } from "../../src/collection/errors.js";
import { ArtifactRepository } from "../../src/db/artifact-repository.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { migrate } from "../../src/db/migrate.js";
import { NormalizedRepository } from "../../src/db/normalized-repository.js";
import { openDatabase } from "../../src/db/open-database.js";
import { MockFinanceParser } from "../../src/parsers/mock-finance-parser.js";

let directory: string;
let db: ReturnType<typeof openDatabase>;
let jobs: JobRepository;
let artifacts: ArtifactRepository;
let normalized: NormalizedRepository;

function seedAccount(accountId: string, shopId: string) {
  const profileId = `profile-${accountId}`;
  db.prepare(
    `INSERT INTO browser_profiles
      (id, provider, external_profile_id, display_name, status)
     VALUES (?, ?, ?, ?, ?)`
  ).run(profileId, "bitbrowser", profileId, profileId, "active");
  db.prepare(
    `INSERT INTO accounts
      (id, platform, account_name, browser_profile_id, status)
     VALUES (?, ?, ?, ?, ?)`
  ).run(accountId, "mock", accountId, profileId, "active");
  db.prepare(
    `INSERT INTO shops
      (id, account_id, platform_shop_id, shop_name, status)
     VALUES (?, ?, ?, ?, ?)`
  ).run(shopId, accountId, shopId, shopId, "active");
}

function createJob(id: string, accountId: string, shopId: string) {
  jobs.create({
    id,
    platform: "mock",
    accountId,
    shopId,
    datasetCode: "finance_daily",
    businessFrom: "2026-06-14",
    businessTo: "2026-06-14",
    triggerType: "manual"
  });
}

function createEngine(
  adapter: MockAdapter,
  sleep: (milliseconds: number) => Promise<void> = async () => {}
) {
  return new CollectionEngine({
    jobs,
    artifacts,
    normalized,
    archiveRoot: path.join(directory, "raw"),
    adapters: new Map([["mock", adapter]]),
    parsers: new Map([["finance_daily", new MockFinanceParser()]]),
    sleep
  });
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "collection-engine-"));
  db = openDatabase(path.join(directory, "test.db"));
  migrate(db, path.resolve("migrations"));
  jobs = new JobRepository(db);
  artifacts = new ArtifactRepository(db);
  normalized = new NormalizedRepository(db);
});

afterEach(() => {
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("CollectionEngine", () => {
  it("archives, parses, and stores a successful collection job", async () => {
    seedAccount("account-1", "shop-1");
    createJob("job-1", "account-1", "shop-1");

    await createEngine(new MockAdapter()).run("job-1");

    expect(jobs.get("job-1")).toMatchObject({
      status: "succeeded",
      checkpoint: "stored",
      attemptCount: 1
    });
    expect(artifacts.count()).toBe(1);
    expect(normalized.count()).toBe(1);
  });

  it("pauses only the account that needs login recovery", async () => {
    seedAccount("account-auth", "shop-auth");
    seedAccount("account-ready", "shop-ready");
    createJob("job-auth", "account-auth", "shop-auth");
    createJob("job-ready", "account-ready", "shop-ready");
    const engine = createEngine(
      new MockAdapter({ waitingAccountIds: new Set(["account-auth"]) })
    );

    await engine.run("job-auth");
    await engine.run("job-ready");

    expect(jobs.get("job-auth")).toMatchObject({
      status: "waiting_auth",
      attemptCount: 1,
      errorCode: "WAITING_FOR_AUTH"
    });
    expect(jobs.get("job-ready")).toMatchObject({
      status: "succeeded",
      checkpoint: "stored"
    });
  });

  it("retries retryable failures with bounded injected delays", async () => {
    seedAccount("account-retry", "shop-retry");
    createJob("job-retry", "account-retry", "shop-retry");
    const delays: number[] = [];
    const adapter = new MockAdapter({
      collectFailures: [
        new RetryableCollectionError("temporary network failure"),
        new RetryableCollectionError("temporary network failure")
      ]
    });
    const engine = createEngine(adapter, async (milliseconds) => {
      delays.push(milliseconds);
    });

    await engine.run("job-retry");

    expect(delays).toEqual([30_000, 120_000]);
    expect(jobs.get("job-retry")).toMatchObject({
      status: "succeeded",
      attemptCount: 3
    });
  });
});
