import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DailyScheduler } from "../../src/collection/scheduler.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { migrate } from "../../src/db/migrate.js";
import { openDatabase } from "../../src/db/open-database.js";

let directory: string;
let db: ReturnType<typeof openDatabase>;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "scheduler-"));
  db = openDatabase(path.join(directory, "test.db"));
  migrate(db, path.resolve("migrations"));

  for (let index = 1; index <= 3; index += 1) {
    db.prepare(
      `INSERT INTO browser_profiles
        (id, provider, external_profile_id, display_name, status)
       VALUES (?, 'bitbrowser', ?, ?, 'active')`
    ).run(`profile-${index}`, `external-${index}`, `Profile ${index}`);
    db.prepare(
      `INSERT INTO accounts
        (id, platform, account_name, browser_profile_id, status)
       VALUES (?, 'mock', ?, ?, 'active')`
    ).run(`account-${index}`, `Account ${index}`, `profile-${index}`);
    db.prepare(
      `INSERT INTO shops
        (id, account_id, platform_shop_id, shop_name, status)
       VALUES (?, ?, ?, ?, 'active')`
    ).run(
      `shop-${index}`,
      `account-${index}`,
      `external-shop-${index}`,
      `Shop ${index}`
    );
  }
});

afterEach(() => {
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("DailyScheduler", () => {
  it("creates one scheduled job per active shop and dataset only once", () => {
    const scheduler = new DailyScheduler(
      db,
      new JobRepository(db),
      new Map([["mock", ["finance_daily"]]])
    );

    const first = scheduler.schedule("2026-06-14");
    const second = scheduler.schedule("2026-06-14");
    const count = db
      .prepare("SELECT COUNT(*) AS count FROM collection_jobs")
      .get() as { count: number };

    expect(first).toHaveLength(3);
    expect(second).toHaveLength(0);
    expect(count.count).toBe(3);
  });
});
