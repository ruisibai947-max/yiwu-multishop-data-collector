import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { NormalizedMetric } from "../parsers/contracts.js";

export type UpsertNormalizedInput = {
  platform: string;
  datasetCode: string;
  accountId: string;
  shopId: string;
  businessDate: string;
  naturalKey: string;
  currency?: string;
  payload: Record<string, unknown>;
  metrics: NormalizedMetric[];
  sourceArtifactId: string;
};

export type StoredNormalizedRow = {
  id: string;
  payload: Record<string, unknown>;
  sourceArtifactId: string;
  metrics: Array<NormalizedMetric>;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export class NormalizedRepository {
  constructor(private readonly db: Database.Database) {}

  upsert(input: UpsertNormalizedInput): { id: string } {
    return this.db.transaction(() => {
      const id = crypto.randomUUID();
      const payloadJson = canonicalJson(input.payload);
      const rowHash = crypto
        .createHash("sha256")
        .update(payloadJson)
        .digest("hex");
      const updatedAt = new Date().toISOString();

      this.db
        .prepare(
          `INSERT INTO normalized_rows (
            id, platform, dataset_code, account_id, shop_id, business_date,
            natural_key, currency, payload_json, row_hash,
            source_artifact_id, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(platform, dataset_code, shop_id, business_date, natural_key)
          DO UPDATE SET
            currency = excluded.currency,
            payload_json = excluded.payload_json,
            row_hash = excluded.row_hash,
            source_artifact_id = excluded.source_artifact_id,
            updated_at = excluded.updated_at`
        )
        .run(
          id,
          input.platform,
          input.datasetCode,
          input.accountId,
          input.shopId,
          input.businessDate,
          input.naturalKey,
          input.currency ?? null,
          payloadJson,
          rowHash,
          input.sourceArtifactId,
          updatedAt
        );

      const stored = this.db
        .prepare(
          `SELECT id FROM normalized_rows
           WHERE platform = ? AND dataset_code = ? AND shop_id = ?
             AND business_date = ? AND natural_key = ?`
        )
        .get(
          input.platform,
          input.datasetCode,
          input.shopId,
          input.businessDate,
          input.naturalKey
        ) as { id: string };

      this.db
        .prepare("DELETE FROM metric_facts WHERE normalized_row_id = ?")
        .run(stored.id);
      const insertMetric = this.db.prepare(
        `INSERT INTO metric_facts (
          normalized_row_id, metric_code, numeric_value, unit, currency
        ) VALUES (?, ?, ?, ?, ?)`
      );
      for (const metric of input.metrics) {
        insertMetric.run(
          stored.id,
          metric.code,
          metric.value,
          metric.unit,
          metric.currency ?? null
        );
      }

      return { id: stored.id };
    })();
  }

  count(): number {
    return (
      this.db.prepare("SELECT COUNT(*) AS count FROM normalized_rows").get() as {
        count: number;
      }
    ).count;
  }

  get(id: string): StoredNormalizedRow | undefined {
    const row = this.db
      .prepare(
        `SELECT id, payload_json, source_artifact_id
         FROM normalized_rows WHERE id = ?`
      )
      .get(id) as
      | { id: string; payload_json: string; source_artifact_id: string }
      | undefined;

    if (!row) {
      return undefined;
    }

    const metrics = this.db
      .prepare(
        `SELECT metric_code, numeric_value, unit, currency
         FROM metric_facts
         WHERE normalized_row_id = ?
         ORDER BY metric_code`
      )
      .all(id)
      .map((metric) => {
        const typed = metric as {
          metric_code: string;
          numeric_value: string;
          unit: NormalizedMetric["unit"];
          currency: string | null;
        };
        return {
          code: typed.metric_code,
          value: typed.numeric_value,
          unit: typed.unit,
          ...(typed.currency ? { currency: typed.currency } : {})
        };
      });

    return {
      id: row.id,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      sourceArtifactId: row.source_artifact_id,
      metrics
    };
  }
}
