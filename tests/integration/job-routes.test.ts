import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerJobRoutes } from "../../src/api/job-routes.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { migrate } from "../../src/db/migrate.js";
import { openDatabase } from "../../src/db/open-database.js";

let directory: string;
let db: ReturnType<typeof openDatabase>;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "job-routes-"));
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
});

afterEach(() => {
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

function buildTestApp() {
  const app = Fastify();
  registerJobRoutes(app, {
    db,
    jobs: new JobRepository(db),
    supportedDatasets: new Map([["mock", new Set(["finance_daily"])]])
  });
  return app;
}

describe("POST /api/jobs", () => {
  it("creates a validated manual collection job", async () => {
    const app = buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        accountId: "account-1",
        shopId: "shop-1",
        datasetCode: "finance_daily",
        businessFrom: "2026-06-14",
        businessTo: "2026-06-14"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      platform: "mock",
      triggerType: "manual",
      status: "queued"
    });
  });

  it("rejects an unsupported dataset and a reversed date range", async () => {
    const app = buildTestApp();
    const unsupported = await app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        accountId: "account-1",
        shopId: "shop-1",
        datasetCode: "unknown",
        businessFrom: "2026-06-14",
        businessTo: "2026-06-14"
      }
    });
    const reversed = await app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        accountId: "account-1",
        shopId: "shop-1",
        datasetCode: "finance_daily",
        businessFrom: "2026-06-15",
        businessTo: "2026-06-14"
      }
    });
    await app.close();

    expect(unsupported.statusCode).toBe(400);
    expect(reversed.statusCode).toBe(400);
  });
});
