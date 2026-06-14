import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { DataValidationError } from "../collection/errors.js";
import type {
  DatasetParser,
  NormalizedMetric,
  NormalizedRow
} from "./contracts.js";

type FinanceCsvRow = {
  business_date?: string;
  natural_key?: string;
  currency?: string;
  gmv?: string;
  refund?: string;
};

function requireValue(
  row: FinanceCsvRow,
  key: keyof FinanceCsvRow
): string {
  const value = row[key]?.trim();
  if (!value) {
    throw new DataValidationError(`Missing required CSV field: ${key}`);
  }
  return value;
}

export class MockFinanceParser implements DatasetParser {
  readonly datasetCode = "finance_daily";

  async parse(filePath: string): Promise<NormalizedRow[]> {
    const csv = await fs.readFile(filePath, "utf8");
    const records = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as FinanceCsvRow[];

    if (records.length === 0) {
      throw new DataValidationError("Finance CSV contains no data rows");
    }

    return records.map((record) => {
      const businessDate = requireValue(record, "business_date");
      const naturalKey = requireValue(record, "natural_key");
      const currency = requireValue(record, "currency");
      const gmv = requireValue(record, "gmv");
      const refund = requireValue(record, "refund");
      const metrics: NormalizedMetric[] = [
        { code: "gmv", value: gmv, unit: "money", currency },
        { code: "refund", value: refund, unit: "money", currency }
      ];

      return {
        naturalKey,
        businessDate,
        currency,
        payload: { gmv, refund },
        metrics
      };
    });
  }
}
