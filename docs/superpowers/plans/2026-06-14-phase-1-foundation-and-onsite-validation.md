# Phase 1 Foundation and Onsite Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the platform-independent collection foundation, deploy it on the customer's Windows machine, capture the real workflows for five platforms, and validate the Phase 1 minimum loops with two shops per platform plus Temu product-link collection.

**Architecture:** A Node.js/TypeScript service runs collection jobs against BitBrowser-managed account environments through Playwright. Platform adapters emit raw artifacts, dataset parsers normalize them into SQLite, and publishers send approved batches to local preview or Feishu. A lightweight React admin UI manages accounts, shops, jobs, manual runs, errors, and raw artifacts.

**Tech Stack:** Node.js 24 LTS, TypeScript, Fastify 5, Playwright Core, BitBrowser Local API, better-sqlite3, Zod, ExcelJS, csv-parse, React, Vite, Vitest, React Testing Library, Pino.

**Version note:** As of June 14, 2026, [Node.js 24](https://nodejs.org/en/about/previous-releases) is the latest LTS line. Fastify's [current documented line is v5](https://fastify.io/docs/latest/), [Vite supports the Node.js versions used here](https://vite.dev/guide/), and [Playwright supports general-purpose Chromium automation](https://playwright.dev/docs/library). Pin exact package releases in `package-lock.json` when Task 1 is executed.

---

## Scope Decomposition

This project contains independent platform adapters whose URLs, selectors, report formats, permissions, and metric definitions are unavailable before the onsite visit. This plan therefore covers:

1. The shared collection foundation that can be built and tested without customer credentials.
2. The onsite discovery and evidence workflow.
3. The exact gate for producing one follow-up implementation plan per platform after its workflow is frozen.
4. Phase 1 acceptance and reporting.

Do not implement a real Temu, Shein, TikTok Shop, JD, or Jushuitan selector before its onsite workflow record and report samples exist. Use the mock adapter to prove the shared system first.

## Target Repository Structure

```text
.
├── admin/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── api/client.ts
│       ├── components/
│       ├── pages/
│       ├── App.tsx
│       └── main.tsx
├── config/
│   └── app.example.json
├── docs/
│   ├── fieldwork/
│   │   ├── pre-onsite-checklist.md
│   │   ├── onsite-runbook.md
│   │   └── templates/
│   └── superpowers/
│       ├── plans/
│       └── specs/
├── migrations/
│   └── 001_initial.sql
├── scripts/
│   └── windows/
│       ├── install.ps1
│       ├── start.ps1
│       ├── stop.ps1
│       ├── backup.ps1
│       └── register-task.ps1
├── src/
│   ├── adapters/
│   │   ├── contracts.ts
│   │   ├── registry.ts
│   │   └── mock/
│   ├── api/
│   ├── bitbrowser/
│   ├── collection/
│   ├── config/
│   ├── db/
│   ├── notifications/
│   ├── parsers/
│   ├── publishers/
│   ├── runtime/
│   ├── app.ts
│   └── server.ts
├── tests/
│   ├── fixtures/
│   ├── integration/
│   └── unit/
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Task 1: Scaffold the TypeScript Service and Test Runner

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/app.ts`
- Create: `src/server.ts`
- Test: `tests/unit/app.test.ts`

- [ ] **Step 1: Create the root package and lock current compatible releases**

Run these commands with Node.js 24 LTS:

```bash
npm init -y
npm pkg set name=yiwu-multishop-collector
npm pkg set private=true --json
npm pkg set version=0.1.0
npm pkg set type=module
npm pkg set engines.node=">=24 <25"
npm pkg set scripts.dev="tsx watch src/server.ts"
npm pkg set scripts.build="tsc -p tsconfig.json"
npm pkg set scripts.start="node dist/server.js"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm pkg set scripts.lint="tsc -p tsconfig.json --noEmit"
npm install @fastify/static fastify@5 better-sqlite3 csv-parse exceljs pino playwright-core zod
npm install -D @types/better-sqlite3 @types/node tsx typescript vitest
```

Expected: `package.json` contains the scripts and Node engine above, and `package-lock.json` pins the exact dependency versions used by the build.

- [ ] **Step 2: Create strict TypeScript configuration**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": ".",
    "outDir": "dist",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    restoreMocks: true
  }
});
```

- [ ] **Step 3: Write the failing health-route test**

```ts
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

describe("health route", () => {
  it("returns ok", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });
});
```

- [ ] **Step 4: Run the test and verify failure**

Run: `npm install && npm test -- tests/unit/app.test.ts`

Expected: FAIL because `src/app.ts` does not exist.

- [ ] **Step 5: Implement the minimal Fastify app**

```ts
import Fastify from "fastify";

export function buildApp() {
  const app = Fastify({ logger: false });
  app.get("/health", async () => ({ status: "ok" }));
  return app;
}
```

```ts
import { buildApp } from "./app.js";

const app = buildApp();
await app.listen({ host: "127.0.0.1", port: 4310 });
```

- [ ] **Step 6: Run tests and type checking**

Run: `npm test && npm run lint`

Expected: all tests PASS and TypeScript exits with code 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/app.ts src/server.ts tests/unit/app.test.ts
git commit -m "chore: scaffold collection service"
```

## Task 2: Add Runtime Configuration and Local Directory Layout

**Files:**
- Create: `config/app.example.json`
- Create: `src/config/schema.ts`
- Create: `src/config/load-config.ts`
- Create: `src/config/secret-store.ts`
- Create: `src/runtime/paths.ts`
- Create: `scripts/windows/set-secret.ps1`
- Test: `tests/unit/config.test.ts`

- [ ] **Step 1: Write failing configuration tests**

```ts
import { describe, expect, it } from "vitest";
import { parseAppConfig } from "../../src/config/schema.js";

describe("app config", () => {
  it("requires an absolute runtime directory", () => {
    expect(() =>
      parseAppConfig({
        runtimeDir: "runtime",
        databaseFile: "collector.db",
        api: { host: "127.0.0.1", port: 4310 },
        bitBrowser: { baseUrl: "http://127.0.0.1:54345" }
      })
    ).toThrow(/absolute/);
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- tests/unit/config.test.ts`

Expected: FAIL because `parseAppConfig` is missing.

- [ ] **Step 3: Implement the configuration schema**

```ts
import path from "node:path";
import { z } from "zod";

const AppConfigSchema = z.object({
  runtimeDir: z.string().refine(path.isAbsolute, "runtimeDir must be absolute"),
  databaseFile: z.string().min(1),
  api: z.object({
    host: z.string().default("127.0.0.1"),
    port: z.number().int().positive().default(4310)
  }),
  bitBrowser: z.object({
    baseUrl: z.string().url()
  })
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export const parseAppConfig = (value: unknown): AppConfig =>
  AppConfigSchema.parse(value);
```

```ts
import fs from "node:fs";
import { parseAppConfig, type AppConfig } from "./schema.js";

export function loadConfig(file: string): AppConfig {
  return parseAppConfig(JSON.parse(fs.readFileSync(file, "utf8")));
}
```

Define secret references instead of secret values:

```ts
export interface SecretStore {
  get(name: string): Promise<string>;
}
```

`app.local.json` may contain names such as `feishu_app_secret`, but never the secret value. `set-secret.ps1` prompts with `Read-Host -AsSecureString` and stores a same-user, same-machine DPAPI-protected credential file under `C:\YiwuCollector\runtime\secrets`. The Windows implementation of `SecretStore` decrypts it only when the service process requests that named secret. Browser account passwords remain managed by the corresponding BitBrowser profile unless the customer explicitly approves another local credential flow.

```ts
import path from "node:path";
import type { AppConfig } from "../config/schema.js";

export function runtimePaths(config: AppConfig) {
  return {
    database: path.join(config.runtimeDir, config.databaseFile),
    raw: path.join(config.runtimeDir, "raw"),
    screenshots: path.join(config.runtimeDir, "screenshots"),
    logs: path.join(config.runtimeDir, "logs"),
    backups: path.join(config.runtimeDir, "backups")
  };
}
```

- [ ] **Step 4: Add the example Windows configuration**

```json
{
  "runtimeDir": "C:\\YiwuCollector\\runtime",
  "databaseFile": "collector.db",
  "api": {
    "host": "127.0.0.1",
    "port": 4310
  },
  "bitBrowser": {
    "baseUrl": "http://127.0.0.1:54345"
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/unit/config.test.ts && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add config src/config src/runtime tests/unit/config.test.ts
git commit -m "feat: add runtime configuration"
```

## Task 3: Create the SQLite Schema and Migration Runner

**Files:**
- Create: `migrations/001_initial.sql`
- Create: `src/db/open-database.ts`
- Create: `src/db/migrate.ts`
- Test: `tests/integration/database.test.ts`

- [ ] **Step 1: Define the initial schema**

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS browser_profiles (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_profile_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  UNIQUE(provider, external_profile_id)
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  account_name TEXT NOT NULL,
  browser_profile_id TEXT NOT NULL REFERENCES browser_profiles(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'waiting_auth', 'paused'))
);

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  platform_shop_id TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  site_code TEXT,
  currency TEXT,
  timezone TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  UNIQUE(account_id, platform_shop_id)
);

CREATE TABLE IF NOT EXISTS collection_jobs (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  shop_id TEXT REFERENCES shops(id),
  dataset_code TEXT NOT NULL,
  business_from TEXT NOT NULL,
  business_to TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual', 'retry')),
  status TEXT NOT NULL CHECK (
    status IN ('queued', 'running', 'waiting_auth', 'failed', 'succeeded', 'cancelled')
  ),
  checkpoint TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS raw_artifacts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES collection_jobs(id),
  artifact_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS normalized_rows (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  dataset_code TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  shop_id TEXT NOT NULL REFERENCES shops(id),
  business_date TEXT NOT NULL,
  natural_key TEXT NOT NULL,
  currency TEXT,
  payload_json TEXT NOT NULL,
  row_hash TEXT NOT NULL,
  source_artifact_id TEXT NOT NULL REFERENCES raw_artifacts(id),
  updated_at TEXT NOT NULL,
  UNIQUE(platform, dataset_code, shop_id, business_date, natural_key)
);

CREATE TABLE IF NOT EXISTS metric_facts (
  normalized_row_id TEXT NOT NULL REFERENCES normalized_rows(id) ON DELETE CASCADE,
  metric_code TEXT NOT NULL,
  numeric_value TEXT NOT NULL,
  unit TEXT NOT NULL,
  currency TEXT,
  PRIMARY KEY(normalized_row_id, metric_code)
);

CREATE TABLE IF NOT EXISTS publications (
  id TEXT PRIMARY KEY,
  destination TEXT NOT NULL,
  dataset_code TEXT NOT NULL,
  batch_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'failed', 'succeeded')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(destination, batch_key)
);
```

- [ ] **Step 2: Write the failing migration test**

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/db/open-database.js";
import { migrate } from "../../src/db/migrate.js";

describe("database migrations", () => {
  it("creates the initial tables", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "collector-")), "test.db");
    const db = openDatabase(file);
    migrate(db, path.resolve("migrations"));

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row: any) => row.name);

    expect(tables).toContain("collection_jobs");
    expect(tables).toContain("normalized_rows");
    db.close();
  });
});
```

- [ ] **Step 3: Run the test and verify failure**

Run: `npm test -- tests/integration/database.test.ts`

Expected: FAIL because database helpers are missing.

- [ ] **Step 4: Implement database opening and migration**

```ts
import Database from "better-sqlite3";

export function openDatabase(file: string) {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
```

```ts
import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

export function migrate(db: Database.Database, migrationDir: string) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const files = fs.readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort();
  const applied = db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?");
  const insert = db.prepare(
    "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)"
  );

  for (const file of files) {
    if (applied.get(file)) continue;
    const sql = fs.readFileSync(path.join(migrationDir, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      insert.run(file, new Date().toISOString());
    })();
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/integration/database.test.ts && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add migrations src/db tests/integration/database.test.ts
git commit -m "feat: add sqlite collection schema"
```

## Task 4: Define Platform Adapter, Parser, and Publisher Contracts

**Files:**
- Create: `src/adapters/contracts.ts`
- Create: `src/parsers/contracts.ts`
- Create: `src/publishers/contracts.ts`
- Test: `tests/unit/contracts.test.ts`

- [ ] **Step 1: Add the domain contracts**

```ts
export type JobRequest = {
  jobId: string;
  platform: string;
  accountId: string;
  shopId?: string;
  datasetCode: string;
  businessFrom: string;
  businessTo: string;
};

export type SessionProbe =
  | { status: "ready"; accountLabel: string }
  | { status: "waiting_auth"; reason: string };

export type CollectedArtifact = {
  type: "xlsx" | "csv" | "json" | "screenshot";
  bytes: Uint8Array;
  suggestedName: string;
  metadata: Record<string, string | number | boolean>;
};

export interface PlatformAdapter {
  readonly platform: string;
  probeSession(request: JobRequest): Promise<SessionProbe>;
  collect(request: JobRequest): AsyncGenerator<CollectedArtifact>;
}
```

```ts
export type NormalizedRow = {
  naturalKey: string;
  businessDate: string;
  currency?: string;
  payload: Record<string, unknown>;
  metrics: Array<{
    code: string;
    value: string;
    unit: "money" | "count" | "ratio";
    currency?: string;
  }>;
};

export interface DatasetParser {
  readonly datasetCode: string;
  parse(filePath: string): Promise<NormalizedRow[]>;
}
```

```ts
export type PublicationBatch = {
  batchKey: string;
  datasetCode: string;
  rowIds: string[];
};

export interface Publisher {
  readonly destination: string;
  publish(batch: PublicationBatch): Promise<void>;
}
```

- [ ] **Step 2: Add a compile-time contract test**

```ts
import { expectTypeOf, it } from "vitest";
import type { PlatformAdapter } from "../../src/adapters/contracts.js";

it("requires adapters to expose a platform", () => {
  expectTypeOf<PlatformAdapter["platform"]>().toEqualTypeOf<string>();
});
```

- [ ] **Step 3: Run tests and commit**

Run: `npm test -- tests/unit/contracts.test.ts && npm run lint`

Expected: PASS.

```bash
git add src/adapters src/parsers src/publishers tests/unit/contracts.test.ts
git commit -m "feat: define collection extension contracts"
```

## Task 5: Implement Raw Artifact Archiving and SHA-256 Deduplication

**Files:**
- Create: `src/runtime/archive-artifact.ts`
- Test: `tests/unit/archive-artifact.test.ts`

- [ ] **Step 1: Write the failing archive test**

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { archiveArtifact } from "../../src/runtime/archive-artifact.js";

describe("archiveArtifact", () => {
  it("writes bytes and returns a stable sha256", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "archive-"));
    const first = await archiveArtifact(root, {
      platform: "mock",
      accountId: "account-1",
      shopId: "shop-1",
      jobId: "job-1",
      suggestedName: "report.csv",
      bytes: new TextEncoder().encode("a,b\n1,2\n")
    });
    const second = await archiveArtifact(root, {
      platform: "mock",
      accountId: "account-1",
      shopId: "shop-1",
      jobId: "job-1",
      suggestedName: "report-copy.csv",
      bytes: new TextEncoder().encode("a,b\n1,2\n")
    });

    expect(first.sha256).toBe(second.sha256);
    expect(fs.existsSync(first.filePath)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- tests/unit/archive-artifact.test.ts`

Expected: FAIL because `archiveArtifact` is missing.

- [ ] **Step 3: Implement deterministic archiving**

```ts
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

type Input = {
  platform: string;
  accountId: string;
  shopId?: string;
  jobId: string;
  suggestedName: string;
  bytes: Uint8Array;
};

export async function archiveArtifact(root: string, input: Input) {
  const sha256 = crypto.createHash("sha256").update(input.bytes).digest("hex");
  const directory = path.join(
    root,
    input.platform,
    input.accountId,
    input.shopId ?? "_account",
    input.jobId
  );
  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${sha256.slice(0, 12)}-${input.suggestedName}`);
  await fs.writeFile(filePath, input.bytes);
  return { filePath, sha256, byteSize: input.bytes.byteLength };
}
```

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- tests/unit/archive-artifact.test.ts`

Expected: PASS.

```bash
git add src/runtime/archive-artifact.ts tests/unit/archive-artifact.test.ts
git commit -m "feat: archive raw collection artifacts"
```

## Task 6: Implement the BitBrowser Local API Client

**Files:**
- Create: `src/bitbrowser/client.ts`
- Create: `src/bitbrowser/session.ts`
- Test: `tests/unit/bitbrowser-client.test.ts`

- [ ] **Step 1: Write a failing API-client test using a stub fetch**

```ts
import { describe, expect, it, vi } from "vitest";
import { BitBrowserClient } from "../../src/bitbrowser/client.js";

describe("BitBrowserClient", () => {
  it("opens a profile and returns the debugging address", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(
        JSON.stringify({ success: true, data: { ws: "ws://127.0.0.1/devtools/browser/1" } }),
        { status: 200 }
      )
    );
    const client = new BitBrowserClient("http://127.0.0.1:54345", fetchFn as typeof fetch);

    await expect(client.openProfile("profile-1")).resolves.toEqual({
      websocketEndpoint: "ws://127.0.0.1/devtools/browser/1"
    });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/bitbrowser-client.test.ts`

Expected: FAIL because the client is missing.

- [ ] **Step 3: Implement the client with endpoint paths isolated in one file**

```ts
import { z } from "zod";

const OpenResponse = z.object({
  success: z.boolean(),
  data: z.object({ ws: z.string().url() })
});

export class BitBrowserClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  async openProfile(profileId: string) {
    const response = await this.fetchFn(`${this.baseUrl}/browser/open`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: profileId })
    });
    if (!response.ok) throw new Error(`BitBrowser open failed: ${response.status}`);
    const body = OpenResponse.parse(await response.json());
    if (!body.success) throw new Error("BitBrowser open returned unsuccessful status");
    return { websocketEndpoint: body.data.ws };
  }

  async closeProfile(profileId: string) {
    const response = await this.fetchFn(`${this.baseUrl}/browser/close`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: profileId })
    });
    if (!response.ok) throw new Error(`BitBrowser close failed: ${response.status}`);
  }
}
```

The official BitBrowser documentation defines `POST /browser/open` and returns WebSocket and HTTP debugging addresses. Onsite, compare the installed BitBrowser version's response with the fixture. If response field names differ, change only `src/bitbrowser/client.ts` and its fixture test.

- [ ] **Step 4: Add Playwright CDP connection**

```ts
import { chromium, type Browser } from "playwright-core";
import type { BitBrowserClient } from "./client.js";

export async function withBitBrowser<T>(
  client: BitBrowserClient,
  profileId: string,
  action: (browser: Browser) => Promise<T>
) {
  const { websocketEndpoint } = await client.openProfile(profileId);
  const browser = await chromium.connectOverCDP(websocketEndpoint);
  try {
    return await action(browser);
  } finally {
    await browser.close();
    await client.closeProfile(profileId);
  }
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- tests/unit/bitbrowser-client.test.ts && npm run lint`

Expected: PASS.

```bash
git add src/bitbrowser tests/unit/bitbrowser-client.test.ts
git commit -m "feat: integrate bitbrowser local api"
```

## Task 7: Build Job Repositories and Idempotent Normalized Writes

**Files:**
- Create: `src/db/job-repository.ts`
- Create: `src/db/normalized-repository.ts`
- Test: `tests/integration/repositories.test.ts`

- [ ] **Step 1: Write failing idempotency tests**

```ts
it("updates an existing natural key instead of inserting a duplicate", () => {
  const first = repository.upsert({
    platform: "mock",
    datasetCode: "finance_daily",
    accountId: "account-1",
    shopId: "shop-1",
    businessDate: "2026-06-14",
    naturalKey: "summary",
    currency: "USD",
    payload: { gmv: "100.00" },
    sourceArtifactId: "artifact-1"
  });
  const second = repository.upsert({
    platform: "mock",
    datasetCode: "finance_daily",
    accountId: "account-1",
    shopId: "shop-1",
    businessDate: "2026-06-14",
    naturalKey: "summary",
    currency: "USD",
    payload: { gmv: "110.00" },
    sourceArtifactId: "artifact-2"
  });

  expect(first.id).toBe(second.id);
  expect(repository.count()).toBe(1);
  expect(repository.get(first.id)?.payload).toEqual({ gmv: "110.00" });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/integration/repositories.test.ts`

Expected: FAIL because repositories are missing.

- [ ] **Step 3: Implement `upsert` with a transaction**

The implementation must:

1. Canonically serialize `payload` with sorted keys.
2. Compute `row_hash` from that canonical JSON.
3. Insert on a new unique key.
4. Update `payload_json`, `row_hash`, `source_artifact_id`, and `updated_at` on conflict.
5. Replace metric facts in the same transaction.

Use this conflict target exactly:

```sql
ON CONFLICT(platform, dataset_code, shop_id, business_date, natural_key)
DO UPDATE SET
  currency = excluded.currency,
  payload_json = excluded.payload_json,
  row_hash = excluded.row_hash,
  source_artifact_id = excluded.source_artifact_id,
  updated_at = excluded.updated_at
```

- [ ] **Step 4: Run repository tests**

Run: `npm test -- tests/integration/repositories.test.ts`

Expected: PASS with one row after two writes.

- [ ] **Step 5: Commit**

```bash
git add src/db/job-repository.ts src/db/normalized-repository.ts tests/integration/repositories.test.ts
git commit -m "feat: add idempotent collection repositories"
```

## Task 8: Implement the Collection Engine and Local Failure Isolation

**Files:**
- Create: `src/collection/errors.ts`
- Create: `src/collection/engine.ts`
- Create: `src/adapters/mock/mock-adapter.ts`
- Create: `src/parsers/mock-finance-parser.ts`
- Test: `tests/integration/collection-engine.test.ts`

- [ ] **Step 1: Write the failing successful-run test**

Test a mock job that:

- probes as ready,
- emits a CSV artifact,
- archives it,
- parses one finance row,
- writes one normalized row,
- marks the job succeeded.

Expected assertions:

```ts
expect(jobRepository.get(jobId)?.status).toBe("succeeded");
expect(normalizedRepository.count()).toBe(1);
expect(artifactRepository.count()).toBe(1);
```

- [ ] **Step 2: Write the failing waiting-auth test**

Configure the mock adapter to return:

```ts
{ status: "waiting_auth", reason: "login page detected" }
```

Assert:

```ts
expect(jobRepository.get(jobId)?.status).toBe("waiting_auth");
expect(nextIndependentJob.status).toBe("succeeded");
```

- [ ] **Step 3: Run tests and verify failure**

Run: `npm test -- tests/integration/collection-engine.test.ts`

Expected: FAIL because the engine is missing.

- [ ] **Step 4: Implement the state transition**

The engine must use these checkpoints:

```text
session_ready
artifact_archived
parsed
stored
published
```

It must never mark a job succeeded before `stored`. A publisher failure leaves the collection job succeeded and creates a failed publication record.

- [ ] **Step 5: Add bounded retry classification**

Create explicit errors:

```ts
export class WaitingForAuthError extends Error {}
export class RetryableCollectionError extends Error {}
export class DataValidationError extends Error {}
```

Rules:

- `WaitingForAuthError` -> job `waiting_auth`, no automatic retry.
- `RetryableCollectionError` -> retry up to 2 times with 30 and 120 second delays.
- `DataValidationError` -> job `failed`, preserve artifacts, do not publish.
- unknown error -> job `failed`, preserve stack in local logs.

- [ ] **Step 6: Run tests**

Run: `npm test -- tests/integration/collection-engine.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/collection src/adapters/mock src/parsers tests/integration/collection-engine.test.ts
git commit -m "feat: add isolated collection job engine"
```

## Task 9: Add Daily Scheduling and Manual Job Creation

**Files:**
- Create: `src/collection/scheduler.ts`
- Create: `src/api/job-routes.ts`
- Create: `src/api/manual-artifact-routes.ts`
- Test: `tests/unit/scheduler.test.ts`
- Test: `tests/integration/job-routes.test.ts`
- Test: `tests/integration/manual-artifact-routes.test.ts`

- [ ] **Step 1: Write a failing schedule test**

Given three active shops and a daily configuration, assert that one job per shop and dataset is inserted only once for the same business window.

- [ ] **Step 2: Implement schedule deduplication**

Add a unique scheduler key derived from:

```text
platform + account_id + shop_id + dataset_code + business_from + business_to + trigger_type
```

Running the scheduler twice must not create duplicate jobs.

- [ ] **Step 3: Write a failing manual-route test**

```ts
const response = await app.inject({
  method: "POST",
  url: "/api/jobs",
  payload: {
    accountId: "account-1",
    shopId: "shop-1",
    datasetCode: "finance_daily",
    businessFrom: "2026-06-14",
    businessTo: "2026-06-14"
  }
});

expect(response.statusCode).toBe(201);
expect(response.json().triggerType).toBe("manual");
```

- [ ] **Step 4: Implement manual creation and input validation**

Reject:

- unknown account or shop,
- inactive shop,
- `businessFrom` after `businessTo`,
- dataset not supported by the selected platform adapter.

- [ ] **Step 5: Implement the manual-export fallback**

`POST /api/manual-artifacts` accepts:

- account ID,
- shop ID,
- approved dataset code,
- business date range,
- one Excel, CSV, or JSON file.

The route creates a manual job, archives the uploaded bytes, invokes the same approved parser and validation path, writes through the same idempotent repository, and publishes through the same publisher. It must reject unsupported extensions, files larger than the configured limit, unknown dataset codes, and files whose parser contract does not match.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- tests/unit/scheduler.test.ts tests/integration/job-routes.test.ts tests/integration/manual-artifact-routes.test.ts`

Expected: PASS.

```bash
git add src/collection/scheduler.ts src/api/job-routes.ts src/api/manual-artifact-routes.ts tests
git commit -m "feat: schedule and trigger collection jobs"
```

## Task 10: Add Dataset Validation and Quarantine

**Files:**
- Create: `src/parsers/validation.ts`
- Create: `src/db/quarantine-repository.ts`
- Create: `migrations/002_quarantine.sql`
- Test: `tests/unit/validation.test.ts`

- [ ] **Step 1: Add the quarantine migration**

```sql
CREATE TABLE IF NOT EXISTS quarantined_batches (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES collection_jobs(id),
  dataset_code TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
```

- [ ] **Step 2: Write validation tests**

Cover:

- required columns missing,
- empty report explicitly confirmed as valid zero business,
- empty report with ambiguous page state,
- detail sum different from report total,
- duplicate natural key within one artifact.

- [ ] **Step 3: Implement a reusable validation result**

```ts
export type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      reasonCode:
        | "missing_columns"
        | "ambiguous_empty"
        | "total_mismatch"
        | "duplicate_key";
      details: Record<string, unknown>;
    };
```

- [ ] **Step 4: Integrate validation before normalized writes**

If validation fails:

- preserve raw artifact,
- create quarantine row,
- mark collection job failed with `error_code = "data_validation"`,
- create no normalized rows,
- create no publication.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- tests/unit/validation.test.ts tests/integration/collection-engine.test.ts`

Expected: PASS.

```bash
git add migrations src/parsers src/db/quarantine-repository.ts tests
git commit -m "feat: quarantine invalid collection batches"
```

## Task 11: Add Local Preview Publisher and Feishu Publisher Boundary

**Files:**
- Create: `src/publishers/local-preview.ts`
- Create: `src/publishers/feishu.ts`
- Create: `src/db/publication-repository.ts`
- Test: `tests/unit/publishers.test.ts`

- [ ] **Step 1: Implement and test local preview**

`LocalPreviewPublisher` writes approved rows to:

```text
C:\YiwuCollector\runtime\preview\finance_daily\2026-06-14-shop-1.json
```

The output contains only normalized business fields, not passwords, cookies, screenshots, or raw response headers.

- [ ] **Step 2: Define Feishu configuration**

```ts
export type FeishuPublisherConfig = {
  appToken: string;
  tableId: string;
  enabled: boolean;
};
```

- [ ] **Step 3: Implement Feishu as a replaceable publisher**

For Phase 1, support:

- disabled mode, which creates no publication,
- test mode against a customer-provided test Base,
- idempotent writes keyed by `batchKey` and row natural key,
- failed publication status without rerunning collection.

Do not hard-code a Feishu table schema before the onsite display decision.

- [ ] **Step 4: Test publication retry**

Stub the Feishu transport to fail once and succeed once. Assert that:

- normalized row count stays unchanged,
- publication attempt count becomes 2,
- final publication status is succeeded.

- [ ] **Step 5: Commit**

```bash
git add src/publishers src/db/publication-repository.ts tests/unit/publishers.test.ts
git commit -m "feat: add replaceable data publishers"
```

## Task 12: Add Feishu Failure Notifications

**Files:**
- Create: `src/notifications/contracts.ts`
- Create: `src/notifications/feishu-webhook.ts`
- Test: `tests/unit/notifications.test.ts`

- [ ] **Step 1: Define the safe notification payload**

```ts
export type FailureNotification = {
  platform: string;
  accountName: string;
  shopName?: string;
  failedAt: string;
  category: "waiting_auth" | "network" | "page_changed" | "data_validation" | "publish";
  action: string;
};
```

- [ ] **Step 2: Test that secrets cannot be supplied**

The notification type and serializer must expose no fields for password, cookie, verification code, raw response headers, or full report rows.

- [ ] **Step 3: Implement the webhook sender**

On non-2xx response, record a local log error. Notification failure must not overwrite the original collection or publication status.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- tests/unit/notifications.test.ts`

Expected: PASS.

```bash
git add src/notifications tests/unit/notifications.test.ts
git commit -m "feat: notify collection failures through feishu"
```

## Task 13: Build the Admin API

**Files:**
- Create: `src/api/account-routes.ts`
- Create: `src/api/shop-routes.ts`
- Create: `src/api/status-routes.ts`
- Create: `src/api/artifact-routes.ts`
- Modify: `src/app.ts`
- Test: `tests/integration/admin-api.test.ts`

- [ ] **Step 1: Add API tests for the required operations**

Cover:

- create and pause browser profile,
- create account bound to one profile,
- create and pause shops under an account,
- list jobs with platform, shop, status, checkpoint, and timestamps,
- retry failed or waiting-auth job,
- list artifacts by job,
- reject raw-file path traversal,
- pause new job pickup through `POST /api/system/pause`,
- resume job pickup through `POST /api/system/resume`,
- expose pause state through `GET /api/system/status`.

- [ ] **Step 2: Implement Zod request schemas**

All create/update routes reject unknown fields and invalid status values.

- [ ] **Step 3: Implement artifact download safely**

Resolve the requested artifact ID through the database. Never accept a file path directly from the URL. Verify the resolved path is inside configured `runtimeDir`.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- tests/integration/admin-api.test.ts`

Expected: PASS.

```bash
git add src/api src/app.ts tests/integration/admin-api.test.ts
git commit -m "feat: expose collection administration api"
```

## Task 14: Build the Lightweight React Admin UI

**Files:**
- Create: `admin/package.json`
- Create: `admin/vite.config.ts`
- Create: `admin/src/api/client.ts`
- Create: `admin/src/App.tsx`
- Create: `admin/src/pages/ShopsPage.tsx`
- Create: `admin/src/pages/JobsPage.tsx`
- Create: `admin/src/pages/JobDetailPage.tsx`
- Create: `admin/src/pages/ManualRunPage.tsx`
- Create: `admin/src/pages/ManualArtifactPage.tsx`
- Test: `admin/src/pages/JobsPage.test.tsx`

- [ ] **Step 1: Create the admin package**

Run:

```bash
npm create vite@latest admin -- --template react-ts --no-interactive
cd admin
npm install react-router-dom
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
npm pkg set scripts.test="vitest run"
```

Configure `admin/vite.config.ts` to use `jsdom` for tests and proxy `/api` to `http://127.0.0.1:4310`. The production build must output to `admin/dist`.

- [ ] **Step 2: Write the failing jobs-page test**

Render these statuses:

```text
Temu / Shop A / succeeded / stored
Shein / Shop B / waiting_auth / session_ready
JD / Shop C / failed / artifact_archived
```

Assert that waiting-auth and failed rows expose a retry action, while succeeded rows expose artifact and preview actions.

- [ ] **Step 3: Implement the four Phase 1 pages**

`ShopsPage`:

- platform,
- account,
- shop,
- BitBrowser profile,
- active or paused status.

`JobsPage`:

- scheduled/manual trigger,
- progress checkpoint,
- started/finished times,
- success/failure/waiting-auth filters.

`JobDetailPage`:

- safe error message,
- screenshot links,
- raw artifact links,
- parsing and publication status.

`ManualRunPage`:

- account,
- shop,
- dataset,
- date range,
- submit button.

`ManualArtifactPage`:

- account,
- shop,
- approved dataset,
- business date range,
- file picker,
- upload and parse status,
- validation failure details.

- [ ] **Step 4: Run UI tests and build**

Run: `cd admin && npm install && npm test && npm run build`

Expected: PASS and `admin/dist/index.html` exists.

- [ ] **Step 5: Serve the UI from Fastify**

Add static-file support so `http://127.0.0.1:4310/` opens the admin UI.

- [ ] **Step 6: Commit**

```bash
git add admin src/app.ts package.json package-lock.json
git commit -m "feat: add local collection admin ui"
```

## Task 15: Prove the Shared System with the Mock Adapter

**Files:**
- Create: `tests/fixtures/mock/finance-daily.csv`
- Create: `tests/integration/mock-end-to-end.test.ts`
- Modify: `src/adapters/registry.ts`

- [ ] **Step 1: Add a deterministic fixture**

```csv
business_date,shop_id,gmv,refund,ad_spend,currency
2026-06-14,shop-1,1000.00,50.00,120.00,USD
```

- [ ] **Step 2: Write one end-to-end test**

The test must:

1. migrate a temporary database,
2. create browser profile, account, and shop,
3. create a manual mock job,
4. run the engine,
5. archive the CSV,
6. parse and write finance metrics,
7. publish local preview,
8. rerun the same job window,
9. assert one normalized business row and one logical publication.

- [ ] **Step 3: Run the complete test suite**

Run: `npm test && npm run lint && npm run build`

Expected: all commands PASS.

- [ ] **Step 4: Commit**

```bash
git add src/adapters/registry.ts tests/fixtures tests/integration/mock-end-to-end.test.ts
git commit -m "test: prove collection foundation end to end"
```

## Task 16: Add Windows Installation, Startup, Backup, and Scheduled-Task Scripts

**Files:**
- Create: `scripts/windows/install.ps1`
- Create: `scripts/windows/start.ps1`
- Create: `scripts/windows/stop.ps1`
- Create: `scripts/windows/backup.ps1`
- Create: `scripts/windows/register-task.ps1`
- Create: `docs/fieldwork/windows-deployment.md`

- [ ] **Step 1: Implement `install.ps1`**

The script must:

- verify Windows PowerShell,
- verify Node.js 24 LTS,
- run `npm ci`,
- run `npm run build`,
- run the admin build,
- create `C:\YiwuCollector\runtime` subdirectories,
- copy `config/app.example.json` to `config/app.local.json` only when the local file is absent,
- run database migrations,
- write no credentials.

- [ ] **Step 2: Implement process scripts**

`start.ps1` starts the built server and writes a PID file under runtime.

`stop.ps1` reads the PID file, stops only that process, and removes the PID file.

- [ ] **Step 3: Implement backup**

`backup.ps1`:

- calls `POST /api/system/pause` and waits until no job is running,
- copies SQLite using its backup API or a consistent checkpoint,
- copies configuration without credentials,
- copies migration and report-definition files,
- writes to `runtime\backups\yyyyMMdd-HHmmss`,
- calls `POST /api/system/resume`.

- [ ] **Step 4: Register Windows Task Scheduler**

`register-task.ps1` creates:

- one startup task for the service,
- one daily backup task,
- no per-shop Windows tasks because scheduling belongs inside the application.

- [ ] **Step 5: Verify on a clean Windows user**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\windows\start.ps1
Invoke-RestMethod http://127.0.0.1:4310/health
```

Expected:

```text
status
------
ok
```

- [ ] **Step 6: Commit**

```bash
git add scripts/windows docs/fieldwork/windows-deployment.md
git commit -m "ops: add windows deployment scripts"
```

## Task 17: Create the Onsite Fieldwork Pack

**Files:**
- Create: `docs/fieldwork/pre-onsite-checklist.md`
- Create: `docs/fieldwork/onsite-runbook.md`
- Create: `docs/fieldwork/templates/account-shop-environment-inventory.csv`
- Create: `docs/fieldwork/templates/report-field-metric-catalog.csv`
- Create: `docs/fieldwork/templates/manual-workflow-record.md`
- Create: `docs/fieldwork/templates/reconciliation-record.csv`
- Create: `docs/fieldwork/templates/platform-validation-scorecard.md`
- Create: `docs/fieldwork/templates/phase-1-feasibility-report.md`

- [ ] **Step 1: Create the account/shop/environment inventory columns**

```csv
platform,backend_type,site,login_account,account_owner,login_method,browser_provider,browser_profile_id,shop_id,shop_name,currency,timezone,can_migrate,employee_concurrent_use,test_shop,notes
```

- [ ] **Step 2: Create the report and metric catalog columns**

```csv
platform,dataset_code,backend_menu,report_name,source_type,download_format,date_field,date_granularity,timezone,currency,field_name,field_meaning,aggregation_rule,required_phase1,manual_total_location,data_delay,owner_approved
```

- [ ] **Step 3: Create the reconciliation columns**

```csv
platform,account,shop,dataset_code,business_from,business_to,timezone,currency,filter_summary,metric_code,manual_value,automatic_value,difference,result,confirmed_by,confirmed_at,evidence_path
```

- [ ] **Step 4: Define the onsite workflow record**

For every dataset, record:

- starting URL and menu path,
- login and shop-switch behavior,
- filter names and selected values,
- export or query action,
- asynchronous export behavior,
- file name and format,
- normal empty-state behavior,
- page totals used for reconciliation,
- screenshots and recording path,
- observed network request only when needed,
- captcha or risk prompts,
- maximum IDs, rows, pages, and date range.

- [ ] **Step 5: Define the Phase 1 scorecard**

Each platform gets explicit values for:

- official API availability and cost,
- chosen collection method,
- two test shops,
- actual automation level,
- two-day scheduled result,
- manual-run result,
- reconciliation result,
- mean shop duration,
- observed safe concurrency,
- risk and fallback method,
- Phase 2 estimate basis.

- [ ] **Step 6: Commit**

```bash
git add docs/fieldwork
git commit -m "docs: add onsite validation fieldwork pack"
```

## Task 18: Execute Onsite Day 1 Discovery

**Files:**
- Fill: `docs/fieldwork/templates/account-shop-environment-inventory.csv`
- Fill: `docs/fieldwork/templates/report-field-metric-catalog.csv`
- Create one workflow record per dataset under: `customer-local-evidence/workflows/`

- [ ] **Step 1: Verify the customer machine**

Record:

- Windows edition and build,
- CPU, RAM, free disk,
- BitBrowser version,
- existing profile count,
- Node and Codex access,
- remote-access method,
- backup location,
- whether endpoint security blocks Playwright or Local API.

- [ ] **Step 2: Build the complete account map**

Do not assume one shop equals one account. Confirm every account-to-shop relationship and the fixed BitBrowser profile that owns its session.

- [ ] **Step 3: Observe one complete manual run before coding**

The finance owner demonstrates every current daily export. The Temu operator demonstrates:

- how the last-30-day new-product list is obtained,
- where link IDs are copied,
- where batches of IDs are submitted,
- how results are displayed or exported.

- [ ] **Step 4: Select test shops**

For each platform choose two real shops that maximize meaningful variation:

- different login/account structure,
- different site or currency,
- different report version,
- different browser environment.

- [ ] **Step 5: Save evidence locally**

All screenshots, recordings, reports, HAR-like evidence, and real data remain on the customer machine under `C:\YiwuCollector\runtime\evidence`. Do not copy them to the developer's personal computer.

## Task 19: Execute Onsite Day 2 Technical Probes and Freeze Phase 1 Scope

**Files:**
- Fill: report/metric catalog
- Create: `customer-local-evidence/api-capability-matrix.csv`
- Create: `customer-local-evidence/risk-register.csv`

- [ ] **Step 1: Check official API capability first**

For each platform record:

- official documentation source,
- account eligibility,
- authorization process,
- price,
- rate limit,
- datasets and fields covered,
- whether the owner approves cost.

- [ ] **Step 2: Probe BitBrowser control**

For each selected account:

1. open the fixed profile through Local API,
2. connect with Playwright,
3. read current URL and visible account identity,
4. open the target menu without changing account data,
5. close and reopen the same profile,
6. verify session persistence.

- [ ] **Step 3: Probe the least risky collection path**

Use this order:

1. official API,
2. official report export,
3. passive page-response observation,
4. page DOM extraction,
5. low-frequency internal-request reuse,
6. manual export plus automatic processing.

- [ ] **Step 4: Freeze the Phase 1 dataset list**

The finance owner signs the exact minimum datasets, fields, filters, dates, timezone, currency, and totals. The Temu owner signs the product-link inputs, outputs, date window, and product granularity.

- [ ] **Step 5: Create platform-specific implementation plans**

For each platform whose workflow is frozen, invoke `superpowers:writing-plans` and create:

```text
docs/superpowers/plans/2026-06-14-temu-adapter.md
docs/superpowers/plans/2026-06-14-shein-adapter.md
docs/superpowers/plans/2026-06-14-tiktok-shop-adapter.md
docs/superpowers/plans/2026-06-14-jd-adapter.md
docs/superpowers/plans/2026-06-14-jushuitan-adapter.md
```

Each adapter plan must contain the actual observed:

- URL or menu entry,
- stable selectors or response match rule,
- filter values,
- export behavior,
- parser fixture column names,
- validation totals,
- empty-state rule,
- session-expiry detection,
- two selected shops,
- exact test commands.

Do not use generic selectors such as `.button` or translated button text if a stable role, test ID, URL pattern, or response signature exists.

## Task 20: Implement Platform Adapters in Parallel Workflows

**Files:**
- Create: `src/adapters/temu/`, `src/adapters/shein/`, `src/adapters/tiktok-shop/`, `src/adapters/jd/`, `src/adapters/jushuitan/`
- Create: `src/parsers/temu/`, `src/parsers/shein/`, `src/parsers/tiktok-shop/`, `src/parsers/jd/`, `src/parsers/jushuitan/`
- Create: `tests/fixtures/temu/`, `tests/fixtures/shein/`, `tests/fixtures/tiktok-shop/`, `tests/fixtures/jd/`, `tests/fixtures/jushuitan/`
- Test: `tests/integration/temu-adapter.test.ts`, `tests/integration/shein-adapter.test.ts`, `tests/integration/tiktok-shop-adapter.test.ts`, `tests/integration/jd-adapter.test.ts`, `tests/integration/jushuitan-adapter.test.ts`

- [ ] **Step 1: Prioritize Temu but do not block other platform work**

Start Temu finance and product-link adapters first. While waiting for export generation, account verification, or two-day observation, implement the next platform adapter.

- [ ] **Step 2: Follow each approved adapter plan using TDD**

For each dataset:

1. add a sanitized fixture,
2. write parser tests,
3. write session-expiry detection tests,
4. write collection-flow tests against recorded/stubbed responses where possible,
5. implement the minimum adapter,
6. run one real test shop manually,
7. add the second test shop,
8. enable scheduling only after reconciliation.

- [ ] **Step 3: Keep adapters isolated**

Platform-specific selectors, URLs, field maps, and request signatures stay inside that platform directory. Shared engine files may change only when the requirement is genuinely cross-platform.

- [ ] **Step 4: Commit each dataset independently**

Examples:

```bash
git commit -m "feat(temu): collect finance daily report"
git commit -m "feat(temu): collect product link metrics"
git commit -m "feat(shein): collect approved finance report"
```

## Task 21: Complete Phase 1 Two-Day Validation

**Files:**
- Fill reconciliation records
- Fill platform scorecards
- Generate local management-page evidence

- [ ] **Step 1: Run scheduled collection for two consecutive days**

For every platform:

- both test shops run,
- raw artifacts exist,
- normalized rows exist,
- no duplicate natural keys,
- local preview is generated,
- actual run times are recorded.

- [ ] **Step 2: Run one manual collection**

Use the same engine and a clearly recorded date range. Confirm repeated execution does not duplicate data.

- [ ] **Step 3: Reconcile every approved metric**

Use identical shop, date range, timezone, currency, filters, and platform data-update time. Any difference is a failure until its reason is documented and approved.

- [ ] **Step 4: Test one controlled failure**

Use a test account or mock condition to verify:

- waiting-auth pauses only the related account,
- other account jobs continue,
- Feishu failure notice contains no secret,
- human login recovery resumes from a safe checkpoint.

- [ ] **Step 5: Verify Temu requirement 2**

For two shops and at least two links per shop:

- automatic last-30-day new-product input is tested,
- manual link-ID input is tested,
- daily metrics are stored,
- results match the operator's manual query.

## Task 22: Produce and Sign Off the Phase 1 Feasibility Report

**Files:**
- Create from template: `customer-local-deliverables/phase-1-feasibility-report.md`
- Create: `customer-local-deliverables/phase-1-acceptance-evidence-index.csv`

- [ ] **Step 1: Summarize each platform**

Include:

- selected shops,
- chosen method,
- automation level,
- exact datasets and fields,
- two-day result,
- manual-run result,
- reconciliation result,
- duration and safe concurrency,
- known risk and fallback.

- [ ] **Step 2: Separate proven facts from Phase 2 assumptions**

Do not claim that two shops prove hundred-shop performance. State the measured per-shop duration and compute a capacity range with its assumptions.

- [ ] **Step 3: Record the frozen Phase 2 order**

Use business value, current manual effort, technical risk, and measured effort. Temu is expected but not automatically forced to be first if onsite evidence shows a blocking risk.

- [ ] **Step 4: Obtain owner confirmation**

Finance owner signs requirement 1 results. Temu operations owner signs requirement 2 results. Record unresolved items as explicit scope or risk, not verbal follow-up.

- [ ] **Step 5: Commit only non-sensitive code and documentation**

Do not commit customer credentials, cookies, raw reports, screenshots, real shop IDs, or unmasked financial data.

Run:

```bash
git status --short
git grep -n -I -E "(cookie|password|token|authorization|验证码)" -- . ':!package-lock.json'
```

Expected: only approved configuration keys and documentation references; no real secret values.

## Final Verification Gate

- [ ] `npm test` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Admin UI test and production build pass.
- [ ] Windows health endpoint returns `{"status":"ok"}`.
- [ ] Mock end-to-end test proves idempotency and publication retry.
- [ ] Every platform has an approved adapter plan based on real onsite evidence.
- [ ] Every Phase 1 platform scorecard contains two shops and two scheduled days.
- [ ] Temu requirement 2 contains two shops and at least two links per shop.
- [ ] Reconciliation records show exact equality or an explicitly rejected result.
- [ ] No customer secret or real raw data exists in Git.
