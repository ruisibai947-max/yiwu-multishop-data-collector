import crypto from "node:crypto";
import type Database from "better-sqlite3";

export type PublicationStatus = "pending" | "running" | "failed" | "succeeded";

export type PublicationRecord = {
  id: string;
  destination: string;
  datasetCode: string;
  batchKey: string;
  status: PublicationStatus;
  attemptCount: number;
  errorMessage: string | null;
  updatedAt: string;
};

type PublicationRow = {
  id: string;
  destination: string;
  dataset_code: string;
  batch_key: string;
  status: PublicationStatus;
  attempt_count: number;
  error_message: string | null;
  updated_at: string;
};

function mapRow(row: PublicationRow): PublicationRecord {
  return {
    id: row.id,
    destination: row.destination,
    datasetCode: row.dataset_code,
    batchKey: row.batch_key,
    status: row.status,
    attemptCount: row.attempt_count,
    errorMessage: row.error_message,
    updatedAt: row.updated_at
  };
}

export class PublicationRepository {
  constructor(private readonly db: Database.Database) {}

  get(destination: string, batchKey: string): PublicationRecord | undefined {
    const row = this.db
      .prepare(
        "SELECT * FROM publications WHERE destination = ? AND batch_key = ?"
      )
      .get(destination, batchKey) as PublicationRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  getOrCreate(input: {
    destination: string;
    datasetCode: string;
    batchKey: string;
  }): PublicationRecord {
    const existing = this.get(input.destination, input.batchKey);
    if (existing) {
      return existing;
    }
    this.db
      .prepare(
        `INSERT INTO publications (
          id, destination, dataset_code, batch_key, status, updated_at
        ) VALUES (?, ?, ?, ?, 'pending', ?)`
      )
      .run(
        crypto.randomUUID(),
        input.destination,
        input.datasetCode,
        input.batchKey,
        new Date().toISOString()
      );
    return this.require(input.destination, input.batchKey);
  }

  markRunning(destination: string, batchKey: string): PublicationRecord {
    this.db
      .prepare(
        `UPDATE publications
         SET status = 'running',
             attempt_count = attempt_count + 1,
             error_message = NULL,
             updated_at = ?
         WHERE destination = ? AND batch_key = ?`
      )
      .run(new Date().toISOString(), destination, batchKey);
    return this.require(destination, batchKey);
  }

  markSucceeded(destination: string, batchKey: string): PublicationRecord {
    return this.updateStatus(destination, batchKey, "succeeded", null);
  }

  markFailed(
    destination: string,
    batchKey: string,
    errorMessage: string
  ): PublicationRecord {
    return this.updateStatus(destination, batchKey, "failed", errorMessage);
  }

  count(): number {
    return (
      this.db.prepare("SELECT COUNT(*) AS count FROM publications").get() as {
        count: number;
      }
    ).count;
  }

  private require(destination: string, batchKey: string): PublicationRecord {
    const record = this.get(destination, batchKey);
    if (!record) {
      throw new Error(`Publication not found: ${destination}/${batchKey}`);
    }
    return record;
  }

  private updateStatus(
    destination: string,
    batchKey: string,
    status: PublicationStatus,
    errorMessage: string | null
  ): PublicationRecord {
    this.db
      .prepare(
        `UPDATE publications
         SET status = ?, error_message = ?, updated_at = ?
         WHERE destination = ? AND batch_key = ?`
      )
      .run(
        status,
        errorMessage,
        new Date().toISOString(),
        destination,
        batchKey
      );
    return this.require(destination, batchKey);
  }
}
