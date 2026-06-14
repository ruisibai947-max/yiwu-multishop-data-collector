import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { ValidationFailureReason } from "../parsers/validation.js";

export type QuarantineRecord = {
  id: string;
  jobId: string;
  datasetCode: string;
  reasonCode: ValidationFailureReason;
  details: Record<string, unknown>;
  createdAt: string;
  resolvedAt: string | null;
};

type QuarantineRow = {
  id: string;
  job_id: string;
  dataset_code: string;
  reason_code: ValidationFailureReason;
  details_json: string;
  created_at: string;
  resolved_at: string | null;
};

function mapRow(row: QuarantineRow): QuarantineRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    datasetCode: row.dataset_code,
    reasonCode: row.reason_code,
    details: JSON.parse(row.details_json) as Record<string, unknown>,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at
  };
}

export class QuarantineRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: {
    jobId: string;
    datasetCode: string;
    reasonCode: ValidationFailureReason;
    details: Record<string, unknown>;
  }): QuarantineRecord {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO quarantined_batches (
          id, job_id, dataset_code, reason_code, details_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.jobId,
        input.datasetCode,
        input.reasonCode,
        JSON.stringify(input.details),
        createdAt
      );
    return this.require(id);
  }

  get(id: string): QuarantineRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM quarantined_batches WHERE id = ?")
      .get(id) as QuarantineRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  require(id: string): QuarantineRecord {
    const row = this.get(id);
    if (!row) {
      throw new Error(`Quarantined batch not found: ${id}`);
    }
    return row;
  }

  count(): number {
    return (
      this.db
        .prepare("SELECT COUNT(*) AS count FROM quarantined_batches")
        .get() as { count: number }
    ).count;
  }
}
