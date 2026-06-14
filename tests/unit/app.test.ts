import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildApp } from "../../src/app.js";
import { MockAdapter } from "../../src/adapters/mock/mock-adapter.js";
import { CollectionEngine } from "../../src/collection/engine.js";
import { ArtifactRepository } from "../../src/db/artifact-repository.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { migrate } from "../../src/db/migrate.js";
import { NormalizedRepository } from "../../src/db/normalized-repository.js";
import { openDatabase } from "../../src/db/open-database.js";
import { QuarantineRepository } from "../../src/db/quarantine-repository.js";
import { MockFinanceParser } from "../../src/parsers/mock-finance-parser.js";

describe("health route", () => {
  it("returns ok", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });

  it("serves the built administration UI when a dist directory exists", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "admin-dist-"));
    fs.writeFileSync(
      path.join(directory, "index.html"),
      "<html><body>Yiwu Admin</body></html>"
    );
    const app = buildApp({ adminDistDir: directory });

    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("Yiwu Admin");
    await app.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("mounts collection routes when an engine is configured", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "app-routes-"));
    const db = openDatabase(path.join(directory, "test.db"));
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
    const jobs = new JobRepository(db);
    const engine = new CollectionEngine({
      jobs,
      artifacts: new ArtifactRepository(db),
      normalized: new NormalizedRepository(db),
      quarantine: new QuarantineRepository(db),
      archiveRoot: path.join(directory, "raw"),
      adapters: new Map([["mock", new MockAdapter()]]),
      parsers: new Map([["finance_daily", new MockFinanceParser()]])
    });
    const app = buildApp({
      db,
      runtimeDir: directory,
      collection: {
        engine,
        supportedDatasets: new Map([
          ["mock", new Set(["finance_daily"])]
        ]),
        maxFileBytes: 1024 * 1024,
        runCreatedJobs: true
      }
    });

    await app.inject({ method: "POST", url: "/api/system/pause" });
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

    expect(response.statusCode).toBe(201);
    expect(jobs.require(response.json().id as string).status).toBe("queued");

    await app.inject({ method: "POST", url: "/api/system/resume" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(jobs.require(response.json().id as string).status).toBe(
      "succeeded"
    );
    await app.close();
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
