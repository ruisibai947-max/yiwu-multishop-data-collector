import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { migrate } from "../../src/db/migrate.js";
import { openDatabase } from "../../src/db/open-database.js";

let directory: string;
let runtimeDir: string;
let db: ReturnType<typeof openDatabase>;
let app: FastifyInstance;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "admin-api-"));
  runtimeDir = path.join(directory, "runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });
  db = openDatabase(path.join(runtimeDir, "collector.db"));
  migrate(db, path.resolve("migrations"));
  app = buildApp({ db, runtimeDir });
});

afterEach(async () => {
  await app.close();
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

async function createProfileAccountShop() {
  const profile = await app.inject({
    method: "POST",
    url: "/api/browser-profiles",
    payload: {
      externalProfileId: "bit-profile-1",
      displayName: "BitBrowser Profile 1"
    }
  });
  const profileBody = profile.json();
  const account = await app.inject({
    method: "POST",
    url: "/api/accounts",
    payload: {
      platform: "temu",
      accountName: "Temu Account 1",
      browserProfileId: profileBody.id
    }
  });
  const accountBody = account.json();
  const shop = await app.inject({
    method: "POST",
    url: "/api/shops",
    payload: {
      accountId: accountBody.id,
      platformShopId: "temu-shop-1",
      shopName: "Temu Shop 1",
      currency: "USD",
      timezone: "Asia/Shanghai"
    }
  });
  return {
    profile: profileBody,
    account: accountBody,
    shop: shop.json()
  };
}

describe("administration API", () => {
  it("creates and pauses browser profiles, accounts, and shops", async () => {
    const invalid = await app.inject({
      method: "POST",
      url: "/api/browser-profiles",
      payload: {
        externalProfileId: "bit-profile-invalid",
        displayName: "Invalid",
        unknownField: true
      }
    });
    expect(invalid.statusCode).toBe(400);

    const entities = await createProfileAccountShop();
    const pauseProfile = await app.inject({
      method: "PATCH",
      url: `/api/browser-profiles/${entities.profile.id}/status`,
      payload: { status: "paused" }
    });
    const pauseShop = await app.inject({
      method: "PATCH",
      url: `/api/shops/${entities.shop.id}/status`,
      payload: { status: "paused" }
    });
    const shops = await app.inject({
      method: "GET",
      url: "/api/shops"
    });

    expect(pauseProfile.json()).toMatchObject({ status: "paused" });
    expect(pauseShop.json()).toMatchObject({ status: "paused" });
    expect(shops.json()).toMatchObject([
      {
        platform: "temu",
        accountName: "Temu Account 1",
        shopName: "Temu Shop 1",
        browserProfileName: "BitBrowser Profile 1",
        status: "paused"
      }
    ]);
  });

  it("lists jobs and retries only failed or waiting-auth jobs", async () => {
    const entities = await createProfileAccountShop();
    const jobs = new JobRepository(db);
    jobs.create({
      id: "job-failed",
      platform: "temu",
      accountId: entities.account.id,
      shopId: entities.shop.id,
      datasetCode: "finance_daily",
      businessFrom: "2026-06-14",
      businessTo: "2026-06-14",
      triggerType: "scheduled"
    });
    jobs.update("job-failed", {
      status: "failed",
      checkpoint: "artifact_archived",
      errorCode: "page_changed",
      errorMessage: "Expected report button was not found",
      startedAt: "2026-06-14T01:00:00.000Z",
      finishedAt: "2026-06-14T01:01:00.000Z"
    });

    const listed = await app.inject({ method: "GET", url: "/api/jobs" });
    const retried = await app.inject({
      method: "POST",
      url: "/api/jobs/job-failed/retry"
    });

    expect(listed.json()).toMatchObject([
      {
        id: "job-failed",
        platform: "temu",
        shopName: "Temu Shop 1",
        status: "failed",
        checkpoint: "artifact_archived",
        startedAt: "2026-06-14T01:00:00.000Z",
        finishedAt: "2026-06-14T01:01:00.000Z"
      }
    ]);
    expect(retried.statusCode).toBe(200);
    expect(retried.json()).toMatchObject({
      status: "queued",
      checkpoint: null,
      errorCode: null
    });
  });

  it("lists and downloads artifacts without accepting paths outside runtime", async () => {
    const entities = await createProfileAccountShop();
    new JobRepository(db).create({
      id: "job-1",
      platform: "temu",
      accountId: entities.account.id,
      shopId: entities.shop.id,
      datasetCode: "finance_daily",
      businessFrom: "2026-06-14",
      businessTo: "2026-06-14",
      triggerType: "manual"
    });
    const reportPath = path.join(runtimeDir, "raw", "report.csv");
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, "gmv\n100\n");
    db.prepare(
      `INSERT INTO raw_artifacts
        (id, job_id, artifact_type, file_path, sha256, byte_size, metadata_json, created_at)
       VALUES (?, 'job-1', 'csv', ?, 'safe-hash', 8, '{}', ?)`
    ).run("artifact-safe", reportPath, new Date().toISOString());
    const outsidePath = path.join(directory, "outside.csv");
    fs.writeFileSync(outsidePath, "secret");
    db.prepare(
      `INSERT INTO raw_artifacts
        (id, job_id, artifact_type, file_path, sha256, byte_size, metadata_json, created_at)
       VALUES (?, 'job-1', 'csv', ?, 'outside-hash', 6, '{}', ?)`
    ).run("artifact-outside", outsidePath, new Date().toISOString());

    const listed = await app.inject({
      method: "GET",
      url: "/api/jobs/job-1/artifacts"
    });
    const downloaded = await app.inject({
      method: "GET",
      url: "/api/artifacts/artifact-safe/download"
    });
    const rejected = await app.inject({
      method: "GET",
      url: "/api/artifacts/artifact-outside/download"
    });

    expect(listed.json()).toHaveLength(2);
    expect(downloaded.statusCode).toBe(200);
    expect(downloaded.body).toBe("gmv\n100\n");
    expect(rejected.statusCode).toBe(403);
  });

  it("pauses and resumes new job pickup", async () => {
    const paused = await app.inject({
      method: "POST",
      url: "/api/system/pause"
    });
    const status = await app.inject({
      method: "GET",
      url: "/api/system/status"
    });
    const resumed = await app.inject({
      method: "POST",
      url: "/api/system/resume"
    });

    expect(paused.json()).toEqual({ jobPickupPaused: true });
    expect(status.json()).toEqual({ jobPickupPaused: true });
    expect(resumed.json()).toEqual({ jobPickupPaused: false });
  });
});
