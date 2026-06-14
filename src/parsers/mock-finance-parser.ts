import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { DataValidationError } from "../collection/errors.js";
import type {
  DatasetParser,
  NormalizedMetric,
  NormalizedRow,
  ParserValidationContext
} from "./contracts.js";

type FinanceCsvRow = {
  business_date?: string;
  shop_id?: string;
  gmv?: string;
  refund?: string;
  ad_spend?: string;
  currency?: string;
};

const requiredColumns = [
  "business_date",
  "shop_id",
  "gmv",
  "refund",
  "ad_spend",
  "currency"
];

function csvColumns(csv: string): string[] {
  const header = parse(csv, {
    to_line: 1,
    skip_empty_lines: true,
    trim: true
  }) as string[][];
  return header[0] ?? [];
}

export class MockFinanceParser implements DatasetParser {
  readonly datasetCode = "finance_daily";

  async parse(filePath: string): Promise<NormalizedRow[]> {
    const csv = await fs.readFile(filePath, "utf8");
    const actualColumns = csvColumns(csv);
    const records = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as FinanceCsvRow[];

    if (requiredColumns.some((column) => !actualColumns.includes(column))) {
      return [];
    }

    return records.map((record) => {
      const businessDate = record.business_date?.trim();
      const naturalKey = record.shop_id?.trim();
      const gmv = record.gmv?.trim();
      const refund = record.refund?.trim();
      const adSpend = record.ad_spend?.trim();
      const currency = record.currency?.trim();
      if (
        !businessDate ||
        !naturalKey ||
        !gmv ||
        !refund ||
        !adSpend ||
        !currency
      ) {
        throw new DataValidationError("Finance CSV contains an empty value");
      }
      const metrics: NormalizedMetric[] = [
        { code: "gmv", value: gmv, unit: "money", currency },
        { code: "refund", value: refund, unit: "money", currency },
        {
          code: "ad_spend",
          value: adSpend,
          unit: "money",
          currency
        }
      ];

      return {
        naturalKey,
        businessDate,
        currency,
        payload: { shopId: naturalKey, gmv, refund, adSpend },
        metrics
      };
    });
  }

  async validationContext(
    filePath: string,
    rows: NormalizedRow[]
  ): Promise<ParserValidationContext> {
    const csv = await fs.readFile(filePath, "utf8");
    return {
      requiredColumns,
      actualColumns: csvColumns(csv),
      emptyState: rows.length > 0 ? "non_empty" : "ambiguous"
    };
  }
}
