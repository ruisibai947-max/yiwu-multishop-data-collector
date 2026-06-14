import { describe, expect, it } from "vitest";
import { validateDataset } from "../../src/parsers/validation.js";

const baseInput = {
  requiredColumns: ["business_date", "natural_key", "gmv"],
  actualColumns: ["business_date", "natural_key", "gmv"],
  rows: [
    {
      naturalKey: "summary",
      businessDate: "2026-06-14",
      payload: { gmv: "100.00" },
      metrics: [{ code: "gmv", value: "100.00", unit: "money" as const }]
    }
  ],
  emptyState: "non_empty" as const
};

describe("validateDataset", () => {
  it("rejects reports with required columns missing", () => {
    expect(
      validateDataset({
        ...baseInput,
        actualColumns: ["business_date", "natural_key"]
      })
    ).toMatchObject({
      ok: false,
      reasonCode: "missing_columns",
      details: { missingColumns: ["gmv"] }
    });
  });

  it("accepts an empty report explicitly confirmed as zero business", () => {
    expect(
      validateDataset({
        ...baseInput,
        rows: [],
        emptyState: "confirmed_zero"
      })
    ).toEqual({ ok: true });
  });

  it("quarantines an empty report whose page state is ambiguous", () => {
    expect(
      validateDataset({
        ...baseInput,
        rows: [],
        emptyState: "ambiguous"
      })
    ).toMatchObject({
      ok: false,
      reasonCode: "ambiguous_empty"
    });
  });

  it("rejects a detail sum that differs from the report total", () => {
    expect(
      validateDataset({
        ...baseInput,
        detailTotal: "99.99",
        reportTotal: "100.00"
      })
    ).toMatchObject({
      ok: false,
      reasonCode: "total_mismatch"
    });
  });

  it("rejects duplicate natural keys within one artifact", () => {
    expect(
      validateDataset({
        ...baseInput,
        rows: [...baseInput.rows, { ...baseInput.rows[0]! }]
      })
    ).toMatchObject({
      ok: false,
      reasonCode: "duplicate_key"
    });
  });
});
