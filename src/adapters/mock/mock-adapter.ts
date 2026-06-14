import type {
  CollectedArtifact,
  JobRequest,
  PlatformAdapter,
  SessionProbe
} from "../contracts.js";

export type MockAdapterOptions = {
  waitingAccountIds?: Set<string>;
  collectFailures?: Error[];
  csvContent?: string;
};

const defaultCsv = [
  "business_date,natural_key,currency,gmv,refund",
  "2026-06-14,summary,USD,100.00,5.00"
].join("\n");

export class MockAdapter implements PlatformAdapter {
  readonly platform = "mock";
  private readonly waitingAccountIds: Set<string>;
  private readonly collectFailures: Error[];
  private readonly csvContent: string;

  constructor(options: MockAdapterOptions = {}) {
    this.waitingAccountIds = options.waitingAccountIds ?? new Set();
    this.collectFailures = [...(options.collectFailures ?? [])];
    this.csvContent = options.csvContent ?? defaultCsv;
  }

  async probeSession(request: JobRequest): Promise<SessionProbe> {
    if (this.waitingAccountIds.has(request.accountId)) {
      return {
        status: "waiting_auth",
        reason: "login page detected"
      };
    }
    return {
      status: "ready",
      accountLabel: request.accountId
    };
  }

  async *collect(_request: JobRequest): AsyncGenerator<CollectedArtifact> {
    const failure = this.collectFailures.shift();
    if (failure) {
      throw failure;
    }

    yield {
      type: "csv",
      bytes: Buffer.from(this.csvContent, "utf8"),
      suggestedName: "finance-daily.csv",
      metadata: {
        source: "mock",
        rowCount: 1
      }
    };
  }
}
