import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import ExcelJS from "exceljs";
import type { Browser, Page, Request } from "playwright-core";
import { chromium } from "playwright-core";
import type { BitBrowserClient } from "../../bitbrowser/client.js";
import { WaitingForAuthError } from "../../collection/errors.js";
import type {
  CollectedArtifact,
  JobRequest,
  PlatformAdapter,
  SessionProbe
} from "../contracts.js";

const reconciliationUrl = "https://seller.kuajingmaihuo.com/labor/bill";
const authLandingUrl = "https://agentseller.temu.com/";
const text = {
  accountLogin: "\u8d26\u53f7\u767b\u5f55",
  scanLogin: "\u626b\u7801\u767b\u5f55",
  enterAccount: "\u8bf7\u8f93\u5165\u8d26\u53f7",
  verificationCode: "\u9a8c\u8bc1\u7801",
  login: "\u767b\u5f55",
  confirmAuthorizeAndGo: "\u786e\u8ba4\u6388\u6743\u5e76\u524d\u5f80",
  enter: "\u8fdb\u5165",
  reconciliationCenter: "\u5bf9\u8d26\u4e2d\u5fc3",
  selectPlaceholder: "\u8bf7\u9009\u62e9",
  query: "\u67e5\u8be2",
  export: "\u5bfc\u51fa",
  exportList: "\u5bfc\u51fa\u5217\u8868",
  accountDetails: "\u8d26\u52a1\u8be6\u60c5",
  confirm: "\u786e\u8ba4",
  ok: "\u786e\u5b9a",
  iKnow: "\u6211\u77e5\u9053\u4e86",
  known: "\u77e5\u9053\u4e86",
  close: "\u5173\u95ed",
  exportHistory: "\u5bfc\u51fa\u5386\u53f2",
  downloadLedgerDetail: "\u4e0b\u8f7d\u8d26\u52a1\u660e\u7ec6",
  downloadDataReport: "\u4e0b\u8f7d\u6570\u636e\u62a5\u8868",
  noData: "\u6682\u65e0\u6570\u636e",
  prompt: "\u63d0\u793a",
  noBillDetail:
    "\u5f53\u524d\u5e97\u94fa\u65e0\u8d26\u5355\u53ef\u4f9b\u5bfc\u51fa\u660e\u7ec6"
};

type BitBrowserSessionClient = Pick<
  BitBrowserClient,
  "openProfile" | "closeProfile"
>;

type BrowserConnector = (websocketEndpoint: string) => Promise<Browser>;

type TemuTarget = {
  accountName: string;
  shopName: string;
  externalProfileId: string;
};

type DownloadedReport = {
  suggestedName: string;
  bytes: Buffer;
  regionLabel: string;
};

type TemuApiHeaders = {
  antiContent: string;
  mallId: string;
};

type ApiResponse<T> = {
  success: boolean;
  errorCode?: number;
  errorMsg?: string | null;
  result?: T;
};

type FundDetailQueryResult = {
  total?: number;
  resultList?: FundDetailRow[];
};

type FundDetailRow = {
  transactionTime?: string;
  createTime?: string;
  fundTypeDesc?: string;
  currencyType?: string;
  amount?: string;
  amountFormat?: {
    symbol?: string;
    digitalText?: string;
  };
  moneyChangeType?: number;
  remark?: string;
};

type ExportHistoryResult = {
  merchantMerchantFileExportHistoryList?: ExportHistoryRecord[];
};

type ExportHistoryRecord = {
  id: number;
  status: number;
  searchExportTimeBegin: number;
  searchExportTimeEnd: number;
  fundDetailExport: boolean;
};

type DownloadResult = {
  fileUrl?: string;
};

export type TemuReconciliationAdapterOptions = {
  db: Database.Database;
  bitBrowser: BitBrowserSessionClient;
  connect?: BrowserConnector;
  tmpRoot?: string;
};

const defaultConnect: BrowserConnector = (websocketEndpoint) =>
  chromium.connectOverCDP(websocketEndpoint);
const fundDetailTaskType = 19;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function openProfileWithRetry(
  bitBrowser: BitBrowserSessionClient,
  profileId: string
): Promise<{ websocketEndpoint: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await bitBrowser.openProfile(profileId);
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await sleep(1_500 * attempt);
      }
    }
  }
  throw lastError;
}

function safeName(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._\-\u4e00-\u9fa5]/g, "_");
}

function monthRangeIsSupported(from: string, to: string): boolean {
  return from.slice(0, 7) === to.slice(0, 7);
}

function businessDayStart(value: string): number {
  return new Date(`${value}T00:00:00+08:00`).getTime();
}

function businessDayEnd(value: string): number {
  return new Date(`${value}T23:59:59+08:00`).getTime();
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function createEmptyReportBytes(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");
  worksheet.addRow([text.prompt]);
  worksheet.addRow([text.noBillDetail]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function createReportBytesFromRows(rows: FundDetailRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");
  worksheet.addRow([
    "\u8d26\u52a1\u660e\u7ec6\u5217\u8868"
  ]);
  worksheet.addRow([
    "\u8d26\u52a1\u65f6\u95f4",
    "\u8d26\u52a1\u7c7b\u578b",
    "\u5e01\u79cd",
    "\u6536\u652f\u91d1\u989d",
    "\u5907\u6ce8"
  ]);
  for (const row of rows) {
    const amountSign = row.moneyChangeType === 2 ? "-" : "+";
    const amountText =
      row.amountFormat?.digitalText && row.amountFormat.symbol
        ? `${amountSign}${row.amountFormat.symbol}${row.amountFormat.digitalText}`
        : row.amount ?? "";
    worksheet.addRow([
      row.transactionTime ?? row.createTime ?? "",
      row.fundTypeDesc ?? "",
      row.currencyType ?? "",
      amountText,
      row.remark ?? ""
    ]);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function startApiHeaderCapture(page: Page): {
  current: () => TemuApiHeaders | undefined;
  wait: () => Promise<TemuApiHeaders>;
  stop: () => void;
} {
  let captured: TemuApiHeaders | undefined;
  let resolveCaptured: (headers: TemuApiHeaders) => void = () => undefined;
  const waitPromise = new Promise<TemuApiHeaders>((resolve) => {
    resolveCaptured = resolve;
  });
  const handler = (request: Request) => {
    if (!request.url().includes("/api/merchant/fund/detail/pageSearch")) {
      return;
    }
    const headers = request.headers();
    const antiContent = headers["anti-content"];
    const mallId = headers.mallid;
    if (antiContent && mallId) {
      captured = { antiContent, mallId };
      resolveCaptured(captured);
    }
  };
  page.on("request", handler);
  return {
    current: () => captured,
    wait: () => waitPromise,
    stop: () => page.off("request", handler)
  };
}

async function resolveApiHeaders(page: Page): Promise<TemuApiHeaders> {
  const capture = startApiHeaderCapture(page);
  try {
    await page.waitForTimeout(5_000);
    if (!capture.current()) {
      await clickFirstVisible(page, [text.query], 2_000).catch(() => undefined);
    }
    const headers =
      capture.current() ??
      (await Promise.race([
        capture.wait(),
        sleep(8_000).then(() => capture.current())
      ]));
    if (!headers) {
      throw new Error("Could not capture Temu API headers");
    }
    return headers;
  } finally {
    capture.stop();
  }
}

async function temuApiPost<T>(
  page: Page,
  headers: TemuApiHeaders,
  apiPath: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = (await page.evaluate(
    async ({ apiPath, headers, body }) => {
      const result = await fetch(apiPath, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "anti-content": headers.antiContent,
          mallid: headers.mallId
        },
        body: JSON.stringify(body)
      });
      return (await result.json()) as unknown;
    },
    { apiPath, headers, body }
  )) as ApiResponse<T>;
  if (!response.success) {
    throw new Error(
      `Temu API failed: ${response.errorCode ?? "unknown"} ${
        response.errorMsg ?? ""
      }`.trim()
    );
  }
  return response.result as T;
}

async function queryFundDetails(
  page: Page,
  headers: TemuApiHeaders,
  beginTime: number,
  endTime: number
): Promise<FundDetailQueryResult> {
  return await temuApiPost<FundDetailQueryResult>(
    page,
    headers,
    "/api/merchant/fund/detail/pageSearch",
    {
      beginTime,
      endTime,
      pageSize: 20,
      pageNum: 1
    }
  );
}

async function queryExportHistory(
  page: Page,
  headers: TemuApiHeaders
): Promise<ExportHistoryRecord[]> {
  const history = await temuApiPost<ExportHistoryResult>(
    page,
    headers,
    "/api/merchant/file/export/history/page",
    {
      taskType: fundDetailTaskType,
      pageSize: 10,
      pageNum: 1
    }
  );
  return history.merchantMerchantFileExportHistoryList ?? [];
}

async function requestApiExport(
  page: Page,
  headers: TemuApiHeaders,
  beginTime: number,
  endTime: number
): Promise<void> {
  await temuApiPost<null>(page, headers, "/api/merchant/file/export", {
    fundDetailExport: true,
    taskType: fundDetailTaskType,
    beginTime,
    endTime
  });
}

function matchingExport(
  records: ExportHistoryRecord[],
  beginTime: number,
  endTime: number
): ExportHistoryRecord | undefined {
  return records.find(
    (record) =>
      record.fundDetailExport &&
      record.searchExportTimeBegin === beginTime &&
      record.searchExportTimeEnd === endTime
  );
}

async function waitForReadyExport(
  page: Page,
  headers: TemuApiHeaders,
  beginTime: number,
  endTime: number
): Promise<ExportHistoryRecord> {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const record = matchingExport(
      await queryExportHistory(page, headers),
      beginTime,
      endTime
    );
    if (record?.status === 2) {
      return record;
    }
    if (record?.status === -1) {
      throw new Error("Temu export task failed");
    }
    await sleep(10_000);
  }
  throw new Error("Temu export task did not finish in time");
}

async function downloadSellerCenterReport(
  page: Page,
  headers: TemuApiHeaders,
  record: ExportHistoryRecord
): Promise<Buffer> {
  const download = await temuApiPost<DownloadResult>(
    page,
    headers,
    "/api/merchant/file/export/download",
    {
      id: record.id,
      taskType: fundDetailTaskType
    }
  );
  if (!download.fileUrl) {
    throw new Error("Temu seller center download URL missing");
  }
  const response = await fetch(download.fileUrl);
  if (!response.ok) {
    throw new Error(`Temu seller center download failed: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function clickFirstVisible(
  page: Page,
  names: string[],
  timeout = 5_000
): Promise<boolean> {
  for (const name of names) {
    const locator = page.getByRole("button", { name }).first();
    if (await locator.isVisible({ timeout }).catch(() => false)) {
      await locator.click();
      return true;
    }
  }
  for (const name of names) {
    const locator = page.getByText(name, { exact: true }).first();
    if (await locator.isVisible({ timeout }).catch(() => false)) {
      await locator.click();
      return true;
    }
  }
  return false;
}

async function clickRequiredVisible(
  page: Page,
  names: string[],
  description: string,
  timeout = 5_000
): Promise<void> {
  if (!(await clickFirstVisible(page, names, timeout))) {
    throw new Error(`Could not find ${description}`);
  }
}

async function assertLoggedIn(page: Page): Promise<void> {
  const bodyText = compactText(
    await page.locator("body").innerText({ timeout: 10_000 })
  );
  const url = page.url();
  if (
    /login/i.test(url) ||
    bodyText.includes(text.accountLogin) ||
    bodyText.includes(text.scanLogin) ||
    bodyText.includes(text.enterAccount)
  ) {
    throw new WaitingForAuthError("Temu account is on the login page");
  }
  if (bodyText.includes(text.verificationCode) && bodyText.includes(text.login)) {
    throw new WaitingForAuthError("Temu account requires verification");
  }
}

async function enterSellerCenterIfNeeded(page: Page): Promise<void> {
  await clickFirstVisible(page, [text.confirmAuthorizeAndGo], 2_000).catch(
    () => undefined
  );
  await clickFirstVisible(page, [text.enter], 2_000).catch(() => undefined);
}

async function dismissBlockingModal(page: Page): Promise<void> {
  const modal = page.locator('[data-testid="beast-core-modal"]').last();
  if (!(await modal.isVisible({ timeout: 2_000 }).catch(() => false))) {
    return;
  }

  for (const name of [text.iKnow, text.known, text.ok, text.confirm, text.close]) {
    const button = modal.getByRole("button", { name }).last();
    if (await button.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await button.click();
      await modal.waitFor({ state: "hidden", timeout: 5_000 }).catch(
        () => undefined
      );
      return;
    }
  }

  const closeIcon = modal
    .locator('[aria-label="Close"], [aria-label="close"], [class*="close"], [class*="Close"]')
    .last();
  if (await closeIcon.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await closeIcon.click({ force: true });
    await modal.waitFor({ state: "hidden", timeout: 5_000 }).catch(
      () => undefined
    );
    return;
  }

  await page.keyboard.press("Escape");
  await modal.waitFor({ state: "hidden", timeout: 5_000 }).catch(
    () => undefined
  );
}

async function ensureReconciliationPage(page: Page): Promise<void> {
  await page.goto(reconciliationUrl, { waitUntil: "domcontentloaded" });
  await enterSellerCenterIfNeeded(page);
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
  await assertLoggedIn(page);
  if (!page.url().includes("/labor/bill")) {
    await page.goto(reconciliationUrl, { waitUntil: "domcontentloaded" });
  }
  await page
    .getByText(text.reconciliationCenter)
    .first()
    .waitFor({ timeout: 20_000 });
}

async function setDateRange(
  page: Page,
  businessFrom: string,
  businessTo: string
): Promise<void> {
  const rangeText = `${businessFrom} ~ ${businessTo}`;
  const dateInput = page
    .locator(`input[placeholder="${text.selectPlaceholder}"]`)
    .first();
  await dateInput.waitFor({ timeout: 15_000 });
  await dateInput.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type(rangeText);
  await page.keyboard.press("Enter");
}

async function queryReconciliation(page: Page): Promise<void> {
  await clickRequiredVisible(page, [text.query], "query button");
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(
    () => undefined
  );
}

async function hasNoData(page: Page): Promise<boolean> {
  return page
    .getByText(text.noData, { exact: true })
    .first()
    .isVisible({ timeout: 2_000 })
    .catch(() => false);
}

async function requestExport(page: Page): Promise<void> {
  await clickRequiredVisible(page, [text.export], "export button");
  const exportOptionPattern = new RegExp(
    `${escapeRegExp(text.exportList)}\\s*\\+\\s*${escapeRegExp(
      text.accountDetails
    )}`
  );
  await page.getByText(exportOptionPattern).first().click({ timeout: 10_000 });
  await clickRequiredVisible(page, [text.confirm], "confirm button");
  await page.waitForTimeout(1_000);
  await dismissBlockingModal(page);
}

async function openExportHistory(page: Page): Promise<void> {
  await dismissBlockingModal(page);
  const history = page.getByText(text.exportHistory, { exact: true }).last();
  await history.click({ timeout: 10_000 });
  await page.getByText(text.downloadLedgerDetail).first().waitFor({
    timeout: 120_000
  });
}

async function downloadAvailableReports(
  page: Page,
  directory: string,
  shopName: string,
  businessFrom: string,
  businessTo: string
): Promise<DownloadedReport[]> {
  const results: DownloadedReport[] = [];
  const reportTextPattern = new RegExp(
    `${escapeRegExp(text.downloadLedgerDetail)}|${escapeRegExp(
      text.downloadDataReport
    )}`
  );
  const roleButtons = page.getByRole("button", { name: reportTextPattern });
  const buttons =
    (await roleButtons.count()) > 0
      ? roleButtons
      : page.getByText(reportTextPattern);
  const count = await buttons.count();

  for (let index = 0; index < count; index += 1) {
    if (results.length >= 4) {
      break;
    }
    const button = buttons.nth(index);
    if (!(await button.isVisible().catch(() => false))) {
      continue;
    }
    const disabled = await button
      .evaluate((element) => {
        const el = element as HTMLElement;
        return (
          el.getAttribute("aria-disabled") === "true" ||
          el.className.includes("disabled") ||
          el.closest("[disabled]") !== null
        );
      })
      .catch(() => true);
    if (disabled) {
      continue;
    }

    const label = `${compactText(await button.innerText())}-${results.length + 1}`;

    const downloadPromise = page.waitForEvent("download", {
      timeout: 60_000
    });
    await button.click();
    const download = await downloadPromise;
    const suggested = download.suggestedFilename();
    const filename = [
      safeName(shopName),
      safeName(businessFrom),
      safeName(businessTo),
      safeName(label),
      safeName(suggested)
    ].join("-");
    const filePath = path.join(directory, filename);
    await download.saveAs(filePath);
    results.push({
      suggestedName: filename,
      bytes: await fs.readFile(filePath),
      regionLabel: label
    });
  }

  return results;
}

export class TemuReconciliationAdapter implements PlatformAdapter {
  readonly platform = "temu";
  private readonly connect: BrowserConnector;
  private readonly tmpRoot: string;

  constructor(private readonly options: TemuReconciliationAdapterOptions) {
    this.connect = options.connect ?? defaultConnect;
    this.tmpRoot = options.tmpRoot ?? os.tmpdir();
  }

  async probeSession(request: JobRequest): Promise<SessionProbe> {
    const target = this.loadTarget(request);
    const { websocketEndpoint } = await openProfileWithRetry(
      this.options.bitBrowser,
      target.externalProfileId
    );
    let browser: Browser | undefined;
    try {
      browser = await this.connect(websocketEndpoint);
      const page = await this.firstPage(browser);
      await page.goto(authLandingUrl, { waitUntil: "domcontentloaded" });
      await enterSellerCenterIfNeeded(page);
      await assertLoggedIn(page);
      return { status: "ready", accountLabel: target.accountName };
    } catch (error) {
      if (error instanceof WaitingForAuthError) {
        return { status: "waiting_auth", reason: error.message };
      }
      throw error;
    } finally {
      await browser?.close().catch(() => undefined);
      await this.options.bitBrowser.closeProfile(target.externalProfileId);
    }
  }

  async *collect(request: JobRequest): AsyncGenerator<CollectedArtifact> {
    if (request.datasetCode !== "temu_reconciliation_statement") {
      throw new Error(`Unsupported Temu dataset: ${request.datasetCode}`);
    }
    if (!monthRangeIsSupported(request.businessFrom, request.businessTo)) {
      throw new Error("Temu reconciliation export supports one month at a time");
    }

    const target = this.loadTarget(request);
    const tempDirectory = await fs.mkdtemp(
      path.join(this.tmpRoot, "temu-reconciliation-")
    );
    try {
      const reports = await this.downloadReports(request, target, tempDirectory);
      if (reports.length === 0) {
        throw new Error("Temu export returned no reports");
      }
      for (const report of reports) {
        yield {
          type: "xlsx",
          bytes: report.bytes,
          suggestedName: report.suggestedName,
          metadata: {
            source:
              report.regionLabel === "confirmed_zero"
                ? "temu_reconciliation_confirmed_zero"
                : report.regionLabel === "api_exact"
                  ? "temu_reconciliation_api_exact"
                : "temu_reconciliation_export",
            shopName: target.shopName,
            regionLabel: report.regionLabel,
            businessFrom: request.businessFrom,
            businessTo: request.businessTo
          }
        };
      }
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  private loadTarget(request: JobRequest): TemuTarget {
    const row = this.options.db
      .prepare(
        `SELECT accounts.account_name,
                shops.shop_name,
                browser_profiles.external_profile_id
         FROM accounts
         JOIN shops ON shops.account_id = accounts.id
         JOIN browser_profiles ON browser_profiles.id = accounts.browser_profile_id
         WHERE accounts.id = ? AND shops.id = ?
           AND accounts.platform = 'temu'
           AND accounts.status = 'active'
           AND shops.status = 'active'
           AND browser_profiles.status = 'active'`
      )
      .get(request.accountId, request.shopId) as
      | {
          account_name: string;
          shop_name: string;
          external_profile_id: string;
        }
      | undefined;

    if (!row) {
      throw new Error("Active Temu account/shop/browser profile not found");
    }
    return {
      accountName: row.account_name,
      shopName: row.shop_name,
      externalProfileId: row.external_profile_id
    };
  }

  private async firstPage(browser: Browser): Promise<Page> {
    const context = browser.contexts()[0] ?? (await browser.newContext());
    return context.pages()[0] ?? (await context.newPage());
  }

  private async downloadReports(
    request: JobRequest,
    target: TemuTarget,
    tempDirectory: string
  ): Promise<DownloadedReport[]> {
    const { websocketEndpoint } = await openProfileWithRetry(
      this.options.bitBrowser,
      target.externalProfileId
    );
    let browser: Browser | undefined;
    try {
      browser = await this.connect(websocketEndpoint);
      const page = await this.firstPage(browser);
      page.setDefaultTimeout(20_000);
      await ensureReconciliationPage(page);
      const apiHeaders = await resolveApiHeaders(page);
      const beginTime = businessDayStart(request.businessFrom);
      const endTime = businessDayEnd(request.businessTo);
      const query = await queryFundDetails(page, apiHeaders, beginTime, endTime);
      if ((query.total ?? 0) === 0) {
        return [
          {
            suggestedName: [
              safeName(target.shopName),
              safeName(request.businessFrom),
              safeName(request.businessTo),
              "confirmed-zero.xlsx"
            ].join("-"),
            bytes: await createEmptyReportBytes(),
            regionLabel: "confirmed_zero"
          }
        ];
      }

      let record = matchingExport(
        await queryExportHistory(page, apiHeaders),
        beginTime,
        endTime
      );
      if (record?.status !== 2) {
        await requestApiExport(page, apiHeaders, beginTime, endTime);
        await waitForReadyExport(page, apiHeaders, beginTime, endTime);
      }
      return [
        {
          suggestedName: [
            safeName(target.shopName),
            safeName(request.businessFrom),
            safeName(request.businessTo),
            "api-exact.xlsx"
          ].join("-"),
          bytes: await createReportBytesFromRows(query.resultList ?? []),
          regionLabel: "api_exact"
        }
      ];
    } finally {
      await browser?.close().catch(() => undefined);
      await this.options.bitBrowser.closeProfile(target.externalProfileId);
    }
  }
}
