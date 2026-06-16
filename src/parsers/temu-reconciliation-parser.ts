import ExcelJS from "exceljs";
import crypto from "node:crypto";
import { DataValidationError } from "../collection/errors.js";
import type {
  DatasetParser,
  NormalizedMetric,
  NormalizedRow,
  ParserValidationContext
} from "./contracts.js";

const ledgerTimeColumn = "\u8d26\u52a1\u65f6\u95f4";
const ledgerTypeColumn = "\u8d26\u52a1\u7c7b\u578b";
const currencyColumn = "\u5e01\u79cd";
const amountColumn = "\u6536\u652f\u91d1\u989d";
const remarkColumn = "\u5907\u6ce8";
const ledgerColumns = [
  ledgerTimeColumn,
  ledgerTypeColumn,
  currencyColumn,
  amountColumn,
  remarkColumn
];
const emptyReportColumns = ["\u63d0\u793a"];
const emptyReportPrompt =
  "\u5f53\u524d\u5e97\u94fa\u65e0\u8d26\u5355\u53ef\u4f9b\u5bfc\u51fa\u660e\u7ec6";

type ParsedWorkbook = {
  rows: NormalizedRow[];
  actualColumns: string[];
  emptyState: "non_empty" | "confirmed_zero" | "ambiguous";
};

type HeaderIndexes = {
  ledgerTime: number;
  ledgerType: number;
  currency: number;
  amount: number;
  remark: number;
};

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    if ("result" in value) {
      return cellText(value.result as ExcelJS.CellValue);
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
  }
  return String(value).trim();
}

function rowTexts(row: ExcelJS.Row): string[] {
  const values = Array.isArray(row.values) ? row.values : [];
  return values.slice(1).map((value) => cellText(value as ExcelJS.CellValue));
}

function normalizeDateTime(value: string): string {
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(value.trim());
  if (!match) {
    throw new DataValidationError(`Invalid Temu ledger time: ${value}`);
  }
  const year = match[1];
  const month = match[2];
  const day = match[3];
  if (!year || !month || !day) {
    throw new DataValidationError(`Invalid Temu ledger time: ${value}`);
  }
  return [year, month.padStart(2, "0"), day.padStart(2, "0")].join("-");
}

function parseAmount(value: string): string {
  const normalized = value
    .replaceAll(",", "")
    .replace(/[\u00a5\uffe5]/g, "")
    .replace(/\s+/g, "")
    .trim();
  const match = /^[+-]?\d+(?:\.\d+)?$/.exec(normalized);
  if (!match) {
    throw new DataValidationError(`Invalid Temu amount: ${value}`);
  }
  return normalized.startsWith("+") ? normalized.slice(1) : normalized;
}

function rowHash(values: string[]): string {
  return crypto.createHash("sha256").update(values.join("\u001f")).digest("hex");
}

function headerIndexes(header: string[]): HeaderIndexes {
  const indexes = {
    ledgerTime: header.indexOf(ledgerTimeColumn),
    ledgerType: header.indexOf(ledgerTypeColumn),
    currency: header.indexOf(currencyColumn),
    amount: header.indexOf(amountColumn),
    remark: header.indexOf(remarkColumn)
  };
  if (Object.values(indexes).some((index) => index < 0)) {
    throw new DataValidationError(
      "Temu reconciliation header is missing required columns"
    );
  }
  return indexes;
}

async function parseWorkbook(filePath: string): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  for (const worksheet of workbook.worksheets) {
    const allRows: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      allRows.push(rowTexts(row));
    });

    if (
      allRows.some((row) => row.some((value) => value.includes(emptyReportPrompt)))
    ) {
      return {
        rows: [],
        actualColumns: emptyReportColumns,
        emptyState: "confirmed_zero"
      };
    }

    const headerIndex = allRows.findIndex((row) =>
      ledgerColumns.every((column) => row.includes(column))
    );
    if (headerIndex < 0) {
      continue;
    }

    const header = allRows[headerIndex];
    if (!header) {
      continue;
    }
    const indexes = headerIndexes(header);
    const rows: NormalizedRow[] = [];
    for (const [offset, row] of allRows.slice(headerIndex + 1).entries()) {
      const ledgerTime = row[indexes.ledgerTime]?.trim() ?? "";
      const ledgerType = row[indexes.ledgerType]?.trim() ?? "";
      const currency = row[indexes.currency]?.trim() ?? "";
      const amountText = row[indexes.amount]?.trim() ?? "";
      const remark = row[indexes.remark]?.trim() ?? "";
      if (!ledgerTime && !ledgerType && !currency && !amountText && !remark) {
        continue;
      }
      if (!ledgerTime || !ledgerType || !currency || !amountText) {
        throw new DataValidationError(
          "Temu reconciliation row contains empty required values"
        );
      }
      const businessDate = normalizeDateTime(ledgerTime);
      const amount = parseAmount(amountText);
      const naturalKey = rowHash([
        String(offset + 1),
        ledgerTime,
        ledgerType,
        currency,
        amount,
        remark
      ]);
      const metrics: NormalizedMetric[] = [
        {
          code: "cash_flow_amount",
          value: amount,
          unit: "money",
          currency
        }
      ];
      rows.push({
        naturalKey,
        businessDate,
        currency,
        payload: {
          ledgerTime,
          ledgerType,
          currency,
          amount,
          remark
        },
        metrics
      });
    }
    return {
      rows,
      actualColumns: header,
      emptyState: rows.length > 0 ? "non_empty" : "ambiguous"
    };
  }

  const firstWorksheet = workbook.worksheets[0];
  const firstRow = firstWorksheet ? rowTexts(firstWorksheet.getRow(1)) : [];
  return {
    rows: [],
    actualColumns: firstRow,
    emptyState: "ambiguous"
  };
}

export class TemuReconciliationParser implements DatasetParser {
  readonly datasetCode = "temu_reconciliation_statement";

  async parse(filePath: string): Promise<NormalizedRow[]> {
    return (await parseWorkbook(filePath)).rows;
  }

  async validationContext(
    filePath: string,
    _rows: NormalizedRow[]
  ): Promise<ParserValidationContext> {
    const parsed = await parseWorkbook(filePath);
    return {
      requiredColumns:
        parsed.emptyState === "confirmed_zero"
          ? emptyReportColumns
          : ledgerColumns,
      actualColumns: parsed.actualColumns,
      emptyState: parsed.emptyState
    };
  }
}
