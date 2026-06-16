import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { validateDataset } from "../../src/parsers/validation.js";
import { TemuReconciliationParser } from "../../src/parsers/temu-reconciliation-parser.js";

const reportTitle = "\u8d26\u52a1\u660e\u7ec6\u5217\u8868";
const ledgerTime = "\u8d26\u52a1\u65f6\u95f4";
const ledgerType = "\u8d26\u52a1\u7c7b\u578b";
const currency = "\u5e01\u79cd";
const amount = "\u6536\u652f\u91d1\u989d";
const remark = "\u5907\u6ce8";
const settlement = "\u7ed3\u7b97";
const settlementRemark = "\u7ed3\u7b97\u6279\u6b21\u53f7\uff1aTEST-BATCH";
const expense = "\u652f\u51fa";
const expenseRemark =
  "\u53d1\u8d27\u5c65\u7ea6\u4fdd\u969c-\u672a\u80fd\u53d1\u8d27";
const promptTitle = "\u63d0\u793a";
const emptyPrompt =
  "\u5f53\u524d\u5e97\u94fa\u65e0\u8d26\u5355\u53ef\u4f9b\u5bfc\u51fa\u660e\u7ec6";

async function writeWorkbook(
  rows: Array<Array<string | number | null>>
): Promise<string> {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "temu-reconciliation-parser-")
  );
  const filePath = path.join(directory, "report.xlsx");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");
  for (const row of rows) {
    worksheet.addRow(row);
  }
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

describe("TemuReconciliationParser", () => {
  it("parses Temu ledger detail rows", async () => {
    const filePath = await writeWorkbook([
      [reportTitle],
      [ledgerTime, ledgerType, currency, amount, remark],
      ["2026-06-15 08:46:35", settlement, "CNY", "+\u00a575.51", settlementRemark],
      ["2026-06-14 15:06:54", expense, "CNY", "-\u00a540.00", expenseRemark]
    ]);
    const parser = new TemuReconciliationParser();

    const rows = await parser.parse(filePath);
    const context = await parser.validationContext(filePath, rows);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.businessDate).toBe("2026-06-15");
    expect(rows[0]?.currency).toBe("CNY");
    expect(rows[0]?.metrics).toEqual([
      {
        code: "cash_flow_amount",
        value: "75.51",
        unit: "money",
        currency: "CNY"
      }
    ]);
    expect(rows[1]?.metrics[0]?.value).toBe("-40.00");
    expect(validateDataset({ ...context, rows })).toEqual({ ok: true });
  });

  it("accepts Temu zero-detail prompt workbooks as confirmed empty", async () => {
    const filePath = await writeWorkbook([[promptTitle], [emptyPrompt]]);
    const parser = new TemuReconciliationParser();

    const rows = await parser.parse(filePath);
    const context = await parser.validationContext(filePath, rows);

    expect(rows).toEqual([]);
    expect(context.emptyState).toBe("confirmed_zero");
    expect(validateDataset({ ...context, rows })).toEqual({ ok: true });
  });
});
