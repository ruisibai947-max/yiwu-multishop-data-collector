import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createProfileSchema = z
  .object({
    externalProfileId: z.string().min(1),
    displayName: z.string().min(1)
  })
  .strict();

const createAccountSchema = z
  .object({
    platform: z.string().min(1),
    accountName: z.string().min(1),
    browserProfileId: z.string().min(1)
  })
  .strict();

const profileStatusSchema = z
  .object({ status: z.enum(["active", "paused"]) })
  .strict();

const accountStatusSchema = z
  .object({ status: z.enum(["active", "waiting_auth", "paused"]) })
  .strict();

function updatedRow(
  db: Database.Database,
  table: "browser_profiles" | "accounts",
  id: string
): Record<string, unknown> | undefined {
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
}

export function registerAccountRoutes(
  app: FastifyInstance,
  db: Database.Database
): void {
  app.post("/api/browser-profiles", async (request, reply) => {
    const parsed = createProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_BROWSER_PROFILE",
        issues: parsed.error.issues
      });
    }
    const id = crypto.randomUUID();
    try {
      db.prepare(
        `INSERT INTO browser_profiles (
          id, provider, external_profile_id, display_name, status
        ) VALUES (?, 'bitbrowser', ?, ?, 'active')`
      ).run(id, parsed.data.externalProfileId, parsed.data.displayName);
    } catch {
      return reply.code(409).send({ error: "BROWSER_PROFILE_CONFLICT" });
    }
    return reply.code(201).send({
      id,
      provider: "bitbrowser",
      externalProfileId: parsed.data.externalProfileId,
      displayName: parsed.data.displayName,
      status: "active"
    });
  });

  app.patch(
    "/api/browser-profiles/:id/status",
    async (request, reply) => {
      const parameters = z
        .object({ id: z.string().min(1) })
        .safeParse(request.params);
      const body = profileStatusSchema.safeParse(request.body);
      if (!parameters.success || !body.success) {
        return reply.code(400).send({ error: "INVALID_PROFILE_STATUS" });
      }
      const result = db
        .prepare("UPDATE browser_profiles SET status = ? WHERE id = ?")
        .run(body.data.status, parameters.data.id);
      if (result.changes === 0) {
        return reply.code(404).send({ error: "BROWSER_PROFILE_NOT_FOUND" });
      }
      const row = updatedRow(db, "browser_profiles", parameters.data.id);
      return reply.send({
        id: row?.id,
        provider: row?.provider,
        externalProfileId: row?.external_profile_id,
        displayName: row?.display_name,
        status: row?.status
      });
    }
  );

  app.post("/api/accounts", async (request, reply) => {
    const parsed = createAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_ACCOUNT",
        issues: parsed.error.issues
      });
    }
    const profile = db
      .prepare("SELECT id FROM browser_profiles WHERE id = ?")
      .get(parsed.data.browserProfileId);
    if (!profile) {
      return reply.code(404).send({ error: "BROWSER_PROFILE_NOT_FOUND" });
    }
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO accounts (
        id, platform, account_name, browser_profile_id, status
      ) VALUES (?, ?, ?, ?, 'active')`
    ).run(
      id,
      parsed.data.platform,
      parsed.data.accountName,
      parsed.data.browserProfileId
    );
    return reply.code(201).send({
      id,
      platform: parsed.data.platform,
      accountName: parsed.data.accountName,
      browserProfileId: parsed.data.browserProfileId,
      status: "active"
    });
  });

  app.patch("/api/accounts/:id/status", async (request, reply) => {
    const parameters = z
      .object({ id: z.string().min(1) })
      .safeParse(request.params);
    const body = accountStatusSchema.safeParse(request.body);
    if (!parameters.success || !body.success) {
      return reply.code(400).send({ error: "INVALID_ACCOUNT_STATUS" });
    }
    const result = db
      .prepare("UPDATE accounts SET status = ? WHERE id = ?")
      .run(body.data.status, parameters.data.id);
    if (result.changes === 0) {
      return reply.code(404).send({ error: "ACCOUNT_NOT_FOUND" });
    }
    const row = updatedRow(db, "accounts", parameters.data.id);
    return reply.send({
      id: row?.id,
      platform: row?.platform,
      accountName: row?.account_name,
      browserProfileId: row?.browser_profile_id,
      status: row?.status
    });
  });
}
