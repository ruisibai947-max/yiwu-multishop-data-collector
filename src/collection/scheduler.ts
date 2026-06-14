import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { JobRecord, JobRepository } from "../db/job-repository.js";

type ActiveShopRow = {
  platform: string;
  account_id: string;
  shop_id: string;
};

function scheduledJobId(parts: string[]): string {
  const digest = crypto
    .createHash("sha256")
    .update(parts.join("\u001f"))
    .digest("hex");
  return `scheduled-${digest.slice(0, 32)}`;
}

export class DailyScheduler {
  constructor(
    private readonly db: Database.Database,
    private readonly jobs: JobRepository,
    private readonly datasetsByPlatform: Map<string, string[]>
  ) {}

  schedule(businessDate: string): JobRecord[] {
    const shops = this.db
      .prepare(
        `SELECT accounts.platform, accounts.id AS account_id, shops.id AS shop_id
         FROM shops
         JOIN accounts ON accounts.id = shops.account_id
         WHERE shops.status = 'active' AND accounts.status = 'active'
         ORDER BY accounts.platform, accounts.id, shops.id`
      )
      .all() as ActiveShopRow[];
    const created: JobRecord[] = [];

    for (const shop of shops) {
      const datasetCodes = this.datasetsByPlatform.get(shop.platform) ?? [];
      for (const datasetCode of datasetCodes) {
        const id = scheduledJobId([
          shop.platform,
          shop.account_id,
          shop.shop_id,
          datasetCode,
          businessDate,
          businessDate,
          "scheduled"
        ]);
        if (this.jobs.get(id)) {
          continue;
        }
        created.push(
          this.jobs.create({
            id,
            platform: shop.platform,
            accountId: shop.account_id,
            shopId: shop.shop_id,
            datasetCode,
            businessFrom: businessDate,
            businessTo: businessDate,
            triggerType: "scheduled"
          })
        );
      }
    }

    return created;
  }
}
