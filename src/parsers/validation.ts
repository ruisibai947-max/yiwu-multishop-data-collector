import type { NormalizedRow } from "./contracts.js";

export type ValidationFailureReason =
  | "missing_columns"
  | "ambiguous_empty"
  | "total_mismatch"
  | "duplicate_key"
  | "invalid_values";

export type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      reasonCode: ValidationFailureReason;
      details: Record<string, unknown>;
    };

export type DatasetValidationInput = {
  requiredColumns: string[];
  actualColumns: string[];
  rows: NormalizedRow[];
  emptyState: "non_empty" | "confirmed_zero" | "ambiguous";
  detailTotal?: string;
  reportTotal?: string;
};

function normalizeDecimal(value: string): string {
  const match = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(value.trim());
  if (!match) {
    return value.trim();
  }
  const sign = match[1] === "-" ? "-" : "";
  const integer = (match[2] ?? "0").replace(/^0+(?=\d)/, "");
  const fraction = (match[3] ?? "").replace(/0+$/, "");
  const normalized = fraction ? `${integer}.${fraction}` : integer;
  return normalized === "0" ? "0" : `${sign}${normalized}`;
}

export function validateDataset(
  input: DatasetValidationInput
): ValidationResult {
  const actual = new Set(input.actualColumns);
  const missingColumns = input.requiredColumns.filter(
    (column) => !actual.has(column)
  );
  if (missingColumns.length > 0) {
    return {
      ok: false,
      reasonCode: "missing_columns",
      details: { missingColumns }
    };
  }

  if (input.rows.length === 0) {
    if (input.emptyState === "confirmed_zero") {
      return { ok: true };
    }
    return {
      ok: false,
      reasonCode: "ambiguous_empty",
      details: { emptyState: input.emptyState }
    };
  }

  if (
    input.detailTotal !== undefined &&
    input.reportTotal !== undefined &&
    normalizeDecimal(input.detailTotal) !== normalizeDecimal(input.reportTotal)
  ) {
    return {
      ok: false,
      reasonCode: "total_mismatch",
      details: {
        detailTotal: input.detailTotal,
        reportTotal: input.reportTotal
      }
    };
  }

  const seen = new Set<string>();
  const duplicateKeys = new Set<string>();
  for (const row of input.rows) {
    const key = `${row.businessDate}\u001f${row.naturalKey}`;
    if (seen.has(key)) {
      duplicateKeys.add(key);
    }
    seen.add(key);
  }
  if (duplicateKeys.size > 0) {
    return {
      ok: false,
      reasonCode: "duplicate_key",
      details: { duplicateKeys: [...duplicateKeys] }
    };
  }

  return { ok: true };
}
