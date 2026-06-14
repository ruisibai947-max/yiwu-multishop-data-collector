import type Database from "better-sqlite3";
import type { FastifyInstance } from "fastify";
import type { JobRepository } from "../db/job-repository.js";

export class JobPickupControl {
  private paused = false;

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  status(): { jobPickupPaused: boolean } {
    return { jobPickupPaused: this.paused };
  }
}

export function registerStatusRoutes(
  app: FastifyInstance,
  db: Database.Database,
  jobs: JobRepository,
  control: JobPickupControl
): void {
  app.get("/api/jobs", async () => {
    const rows = db
      .prepare(
        `SELECT collection_jobs.*, accounts.account_name, shops.shop_name
         FROM collection_jobs
         JOIN accounts ON accounts.id = collection_jobs.account_id
         LEFT JOIN shops ON shops.id = collection_jobs.shop_id
         ORDER BY collection_jobs.created_at DESC`
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: row.id,
      platform: row.platform,
      accountId: row.account_id,
      accountName: row.account_name,
      shopId: row.shop_id,
      shopName: row.shop_name,
      datasetCode: row.dataset_code,
      businessFrom: row.business_from,
      businessTo: row.business_to,
      triggerType: row.trigger_type,
      status: row.status,
      checkpoint: row.checkpoint,
      attemptCount: row.attempt_count,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at
    }));
  });

  app.post("/api/jobs/:id/retry", async (request, reply) => {
    const id = (request.params as { id?: string }).id;
    if (!id) {
      return reply.code(400).send({ error: "INVALID_JOB_ID" });
    }
    const job = jobs.get(id);
    if (!job) {
      return reply.code(404).send({ error: "JOB_NOT_FOUND" });
    }
    if (job.status !== "failed" && job.status !== "waiting_auth") {
      return reply.code(409).send({ error: "JOB_NOT_RETRYABLE" });
    }
    return jobs.update(id, {
      status: "queued",
      checkpoint: null,
      errorCode: null,
      errorMessage: null,
      finishedAt: null
    });
  });

  app.post("/api/system/pause", async () => {
    control.pause();
    return control.status();
  });

  app.post("/api/system/resume", async () => {
    control.resume();
    return control.status();
  });

  app.get("/api/system/status", async () => control.status());
}
