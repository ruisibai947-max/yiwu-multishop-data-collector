import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createShopSchema = z
  .object({
    accountId: z.string().min(1),
    platformShopId: z.string().min(1),
    shopName: z.string().min(1),
    siteCode: z.string().min(1).optional(),
    currency: z.string().min(1).optional(),
    timezone: z.string().min(1).optional()
  })
  .strict();

const statusSchema = z
  .object({ status: z.enum(["active", "paused"]) })
  .strict();

export function registerShopRoutes(
  app: FastifyInstance,
  db: Database.Database
): void {
  app.post("/api/shops", async (request, reply) => {
    const parsed = createShopSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_SHOP",
        issues: parsed.error.issues
      });
    }
    const account = db
      .prepare("SELECT id FROM accounts WHERE id = ?")
      .get(parsed.data.accountId);
    if (!account) {
      return reply.code(404).send({ error: "ACCOUNT_NOT_FOUND" });
    }
    const id = crypto.randomUUID();
    try {
      db.prepare(
        `INSERT INTO shops (
          id, account_id, platform_shop_id, shop_name, site_code,
          currency, timezone, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`
      ).run(
        id,
        parsed.data.accountId,
        parsed.data.platformShopId,
        parsed.data.shopName,
        parsed.data.siteCode ?? null,
        parsed.data.currency ?? null,
        parsed.data.timezone ?? null
      );
    } catch {
      return reply.code(409).send({ error: "SHOP_CONFLICT" });
    }
    return reply.code(201).send({
      id,
      accountId: parsed.data.accountId,
      platformShopId: parsed.data.platformShopId,
      shopName: parsed.data.shopName,
      ...(parsed.data.siteCode ? { siteCode: parsed.data.siteCode } : {}),
      ...(parsed.data.currency ? { currency: parsed.data.currency } : {}),
      ...(parsed.data.timezone ? { timezone: parsed.data.timezone } : {}),
      status: "active"
    });
  });

  app.patch("/api/shops/:id/status", async (request, reply) => {
    const parameters = z
      .object({ id: z.string().min(1) })
      .safeParse(request.params);
    const body = statusSchema.safeParse(request.body);
    if (!parameters.success || !body.success) {
      return reply.code(400).send({ error: "INVALID_SHOP_STATUS" });
    }
    const result = db
      .prepare("UPDATE shops SET status = ? WHERE id = ?")
      .run(body.data.status, parameters.data.id);
    if (result.changes === 0) {
      return reply.code(404).send({ error: "SHOP_NOT_FOUND" });
    }
    const row = db
      .prepare("SELECT * FROM shops WHERE id = ?")
      .get(parameters.data.id) as Record<string, unknown>;
    return reply.send({
      id: row.id,
      accountId: row.account_id,
      platformShopId: row.platform_shop_id,
      shopName: row.shop_name,
      status: row.status
    });
  });

  app.get("/api/shops", async () => {
    const rows = db
      .prepare(
        `SELECT shops.id, shops.platform_shop_id, shops.shop_name,
                shops.site_code, shops.currency, shops.timezone, shops.status,
                accounts.id AS account_id, accounts.platform,
                accounts.account_name,
                browser_profiles.id AS browser_profile_id,
                browser_profiles.display_name AS browser_profile_name
         FROM shops
         JOIN accounts ON accounts.id = shops.account_id
         JOIN browser_profiles ON browser_profiles.id = accounts.browser_profile_id
         ORDER BY accounts.platform, accounts.account_name, shops.shop_name`
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: row.id,
      platformShopId: row.platform_shop_id,
      shopName: row.shop_name,
      siteCode: row.site_code,
      currency: row.currency,
      timezone: row.timezone,
      status: row.status,
      accountId: row.account_id,
      platform: row.platform,
      accountName: row.account_name,
      browserProfileId: row.browser_profile_id,
      browserProfileName: row.browser_profile_name
    }));
  });
}
