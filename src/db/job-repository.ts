import type Database from "better-sqlite3";

export type JobStatus =
  | "queued"
  | "running"
  | "waiting_auth"
  | "failed"
  | "succeeded"
  | "cancelled";

export type JobCheckpoint =
  | "session_ready"
  | "artifact_archived"
  | "parsed"
  | "stored"
  | "published";

export type CreateJobInput = {
  id: string;
  platform: string;
  accountId: string;
  shopId?: string;
  datasetCode: string;
  businessFrom: string;
  businessTo: string;
  triggerType: "scheduled" | "manual" | "retry";
};

export type JobPatch = {
  status?: JobStatus;
  checkpoint?: JobCheckpoint | null;
  attemptCount?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type JobRecord = {
  id: string;
  platform: string;
  accountId: string;
  shopId: string | null;
  datasetCode: string;
  businessFrom: string;
  businessTo: string;
  triggerType: "scheduled" | "manual" | "retry";
  status: JobStatus;
  checkpoint: JobCheckpoint | null;
  attemptCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

type JobRow = {
  id: string;
  platform: string;
  account_id: string;
  shop_id: string | null;
  dataset_code: string;
  business_from: string;
  business_to: string;
  trigger_type: JobRecord["triggerType"];
  status: JobStatus;
  checkpoint: JobCheckpoint | null;
  attempt_count: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

const patchColumns: Record<keyof JobPatch, string> = {
  status: "status",
  checkpoint: "checkpoint",
  attemptCount: "attempt_count",
  errorCode: "error_code",
  errorMessage: "error_message",
  startedAt: "started_at",
  finishedAt: "finished_at"
};

function mapJob(row: JobRow): JobRecord {
  return {
    id: row.id,
    platform: row.platform,
    accountId: row.account_id,
    shopId: row.shop_id,
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
  };
}

export class JobRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: CreateJobInput): JobRecord {
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO collection_jobs (
          id, platform, account_id, shop_id, dataset_code,
          business_from, business_to, trigger_type, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`
      )
      .run(
        input.id,
        input.platform,
        input.accountId,
        input.shopId ?? null,
        input.datasetCode,
        input.businessFrom,
        input.businessTo,
        input.triggerType,
        createdAt
      );

    return this.require(input.id);
  }

  get(id: string): JobRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM collection_jobs WHERE id = ?")
      .get(id) as JobRow | undefined;
    return row ? mapJob(row) : undefined;
  }

  require(id: string): JobRecord {
    const job = this.get(id);
    if (!job) {
      throw new Error(`Collection job not found: ${id}`);
    }
    return job;
  }

  listByStatus(status: JobStatus): JobRecord[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM collection_jobs WHERE status = ? ORDER BY created_at"
      )
      .all(status) as JobRow[];
    return rows.map(mapJob);
  }

  update(id: string, patch: JobPatch): JobRecord {
    const entries = Object.entries(patch) as Array<
      [keyof JobPatch, JobPatch[keyof JobPatch]]
    >;
    if (entries.length === 0) {
      return this.require(id);
    }

    const assignments = entries.map(([key]) => `${patchColumns[key]} = ?`);
    const values = entries.map(([, value]) => value);
    const result = this.db
      .prepare(
        `UPDATE collection_jobs SET ${assignments.join(", ")} WHERE id = ?`
      )
      .run(...values, id);

    if (result.changes === 0) {
      throw new Error(`Collection job not found: ${id}`);
    }

    return this.require(id);
  }
}
