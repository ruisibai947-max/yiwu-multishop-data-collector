import type {
  NormalizedRepository,
  StoredNormalizedRow
} from "../db/normalized-repository.js";

const sensitiveKey =
  /password|cookie|authorization|secret|token|headers?|screenshot/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !sensitiveKey.test(key))
        .map(([key, item]) => [key, sanitize(item)])
    );
  }
  return value;
}

export type PublishableRow = {
  rowKey: string;
  platform: string;
  datasetCode: string;
  accountId: string;
  shopId: string;
  businessDate: string;
  naturalKey: string;
  currency: string | null;
  payload: Record<string, unknown>;
  metrics: StoredNormalizedRow["metrics"];
};

export function loadPublishableRows(
  source: NormalizedRepository,
  batchKey: string,
  rowIds: string[]
): PublishableRow[] {
  return source.getMany(rowIds).map((row) => ({
    rowKey: `${batchKey}:${row.businessDate}:${row.shopId}:${row.naturalKey}`,
    platform: row.platform,
    datasetCode: row.datasetCode,
    accountId: row.accountId,
    shopId: row.shopId,
    businessDate: row.businessDate,
    naturalKey: row.naturalKey,
    currency: row.currency,
    payload: sanitize(row.payload) as Record<string, unknown>,
    metrics: row.metrics
  }));
}
