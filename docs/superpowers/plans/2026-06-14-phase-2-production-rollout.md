# Phase 2 Production Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Phase 1 foundation and approved platform adapters to all frozen shops, run multiple platform workstreams in parallel, publish approved data, and deliver a maintainable Windows production system with source code.

**Architecture:** Shared scheduling, storage, validation, notification, and admin capabilities remain platform-independent. Each platform adapter scales independently from two test shops to its frozen shop list. Development, account waiting, export generation, and seven-day observation overlap across platforms instead of forming a serial pipeline.

**Tech Stack:** The approved Phase 1 stack plus the customer-confirmed Feishu or self-built-system publisher. PostgreSQL is introduced only if measured SQLite write contention, multiple collector machines, or concurrent administration requires it.

---

## One-Month Target Cadence

The one-month period is a target, not an unconditional all-platform promise:

- Days 1～5: freeze the release manifest, finish shared production controls, and start the highest-value platform workstreams.
- Days 6～15: expand shops in controlled batches while implementing other platform adapters during export, authentication, and observation waits.
- Days 16～25: overlap multiple seven-day observations, resolve failures, and complete publisher mappings.
- Days 26～30: finish platform sign-offs that have completed observation, verify backup/restore, train the administrator, and prepare source-code handover.

Any platform blocked by unavailable permissions, unresolved risk control, unapproved paid API cost, or post-freeze scope additions moves to the next milestone without blocking completed platforms.

## Task 1: Freeze the Production Release Manifest

**Files:**
- Create: `config/production-release-manifest.example.json`
- Create: `docs/production/release-manifest-schema.md`

- [ ] **Step 1: Record every frozen dataset**

Each entry must contain:

```json
{
  "platform": "temu",
  "datasetCode": "finance_daily",
  "shopIds": ["customer-local-id-1", "customer-local-id-2"],
  "defaultDateRule": "previous_complete_day",
  "schedule": "02:00 Asia/Shanghai",
  "owner": "finance-owner",
  "acceptanceMetrics": ["gmv", "refund_amount"],
  "publisher": "feishu"
}
```

The actual file stays on the customer machine if it contains real shop identifiers.

Add `config/production-release-manifest.json` to `.gitignore`; only the sanitized example and schema are committed.

- [ ] **Step 2: Reject undeclared production jobs**

The scheduler must not create production jobs for a dataset or shop absent from the release manifest.

- [ ] **Step 3: Commit the schema and sanitized example**

```bash
git add config/production-release-manifest.example.json docs/production/release-manifest-schema.md
git commit -m "docs: define frozen production release manifest"
```

## Task 2: Add Bulk Shop Administration

**Files:**
- Create: `src/api/shop-import-routes.ts`
- Create: `src/services/shop-import.ts`
- Create: `admin/src/pages/ShopImportPage.tsx`
- Test: `tests/integration/shop-import.test.ts`

- [ ] **Step 1: Define import columns**

```csv
platform,account_id,platform_shop_id,shop_name,site_code,currency,timezone,status
```

- [ ] **Step 2: Test dry-run validation**

The dry run returns:

- rows to create,
- rows to update,
- unknown accounts,
- duplicate platform shop IDs,
- invalid currency/timezone values.

- [ ] **Step 3: Implement explicit apply**

No database change occurs during dry run. Apply requires the validated import token returned by the dry run.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- tests/integration/shop-import.test.ts
git add src admin tests
git commit -m "feat: add controlled bulk shop administration"
```

## Task 3: Add Capacity-Aware Scheduling

**Files:**
- Create: `src/collection/capacity-policy.ts`
- Modify: `src/collection/scheduler.ts`
- Test: `tests/unit/capacity-policy.test.ts`

- [ ] **Step 1: Encode measured limits**

Support:

- maximum open BitBrowser profiles,
- maximum concurrent jobs by platform,
- no concurrent jobs for the same account,
- optional platform blackout windows,
- per-platform minimum delay between jobs.

- [ ] **Step 2: Test fair job pickup**

Assert that one platform with many queued shops does not permanently starve other platforms.

- [ ] **Step 3: Test account exclusion**

Two jobs under the same login account must never run simultaneously.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- tests/unit/capacity-policy.test.ts
git add src/collection tests/unit/capacity-policy.test.ts
git commit -m "feat: schedule jobs within measured capacity"
```

## Task 4: Add Operational Data Retention and Backups

**Files:**
- Create: `src/runtime/retention.ts`
- Create: `src/api/retention-routes.ts`
- Modify: `scripts/windows/backup.ps1`
- Test: `tests/unit/retention.test.ts`

- [ ] **Step 1: Encode the signed retention values in configuration**

Configure separate durations for:

- raw reports,
- screenshots,
- application logs,
- database backups.

- [ ] **Step 2: Implement dry-run cleanup**

The UI shows file count and bytes before deletion. A cleanup never deletes:

- artifacts referenced by unresolved quarantine,
- artifacts inside the active acceptance window,
- the latest successful backup.

- [ ] **Step 3: Test restore**

Restore a backup into a temporary runtime directory and run migration plus health checks.

- [ ] **Step 4: Commit**

```bash
git add src/runtime src/api scripts/windows tests
git commit -m "ops: add retention and verified backups"
```

## Task 5: Finalize the Production Publisher

**Files:**
- Create: `src/publishers/production.ts`
- Modify: `src/publishers/feishu.ts` when Feishu is confirmed
- Create: `src/publishers/customer-system.ts` when the customer's own system is confirmed
- Create: `tests/integration/production-publisher.test.ts`
- Create: `docs/production/publisher-mapping.md`

- [ ] **Step 1: Freeze destination tables and keys**

For every destination table document:

- source dataset,
- destination table,
- unique row key,
- field mapping,
- update behavior,
- deletion behavior,
- owner.

- [ ] **Step 2: Test idempotent publication**

Publishing the same batch twice must not duplicate rows. Publishing a changed local record must update the existing destination row.

- [ ] **Step 3: Test rate-limit recovery**

Simulate destination throttling. The publisher must back off and resume without rerunning platform collection.

- [ ] **Step 4: Commit**

```bash
git add src/publishers tests/integration/production-publisher.test.ts docs/production/publisher-mapping.md
git commit -m "feat: finalize production data publishing"
```

## Task 6: Harden Platform Change Detection

**Files:**
- Create: `src/adapters/temu/page-contract.ts`
- Create: `src/adapters/shein/page-contract.ts`
- Create: `src/adapters/tiktok-shop/page-contract.ts`
- Create: `src/adapters/jd/page-contract.ts`
- Create: `src/adapters/jushuitan/page-contract.ts`
- Test: `tests/integration/temu-page-contract.test.ts`
- Test: `tests/integration/shein-page-contract.test.ts`
- Test: `tests/integration/tiktok-shop-page-contract.test.ts`
- Test: `tests/integration/jd-page-contract.test.ts`
- Test: `tests/integration/jushuitan-page-contract.test.ts`

- [ ] **Step 1: Define page/report contracts**

Each contract contains:

- expected URL pattern,
- required controls,
- expected export columns,
- known empty-state marker,
- account and shop identity marker.

- [ ] **Step 2: Fail closed**

If a required control or report column disappears:

- preserve evidence,
- mark the dataset failed with `page_changed`,
- do not write normalized rows,
- notify the administrator.

- [ ] **Step 3: Run all contract tests**

Run: `npm test -- tests/integration/*-page-contract.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit one platform at a time**

```bash
git commit -m "test(temu): detect finance page contract changes"
```

## Task 7: Run Parallel Platform Expansion

**Files:**
- Fill customer-local production release manifest
- Fill platform rollout scorecards

- [ ] **Step 1: Expand multiple workstreams**

Use this operating rule:

- one platform may be under active coding,
- another may be waiting for manual account verification,
- another may be generating asynchronous exports,
- several may be in seven-day observation.

Switch to available work instead of waiting for one platform to finish.

- [ ] **Step 2: Add shops in controlled batches**

For each platform:

1. two Phase 1 shops,
2. next small batch representing other account/site variants,
3. remaining frozen shops,
4. capacity adjustment only after measured runs.

- [ ] **Step 3: Reconcile each new variant**

Do not manually reconcile every identical shop forever. Reconcile every distinct:

- account structure,
- site/currency,
- report version,
- data path.

Continue automated totals and completeness checks for all shops.

- [ ] **Step 4: Start observation immediately**

As soon as a platform's frozen shop list is enabled, start its seven-day observation. Observation periods across platforms may overlap.

## Task 8: Seven-Day Platform Acceptance

**Files:**
- Create: `customer-local-deliverables/temu-production-acceptance.md`
- Create: `customer-local-deliverables/shein-production-acceptance.md`
- Create: `customer-local-deliverables/tiktok-shop-production-acceptance.md`
- Create: `customer-local-deliverables/jd-production-acceptance.md`
- Create: `customer-local-deliverables/jushuitan-production-acceptance.md`

- [ ] **Step 1: Verify seven consecutive scheduled days**

Every frozen shop must have either:

- successful approved data, or
- a documented legitimate zero-business result.

- [ ] **Step 2: Verify failure recovery**

Confirm:

- alert delivery,
- waiting-auth recovery,
- retry from safe checkpoint,
- no duplicate after retry,
- publication retry without recollection.

- [ ] **Step 3: Verify administrator operations**

The customer administrator performs:

- add one test shop,
- pause it,
- resume it,
- trigger one manual collection,
- inspect one raw artifact,
- resolve one waiting-auth state.

- [ ] **Step 4: Obtain platform owner sign-off**

Finance owner signs requirement 1 platform outputs. Temu operations owner signs product-link outputs.

## Task 9: Decide Whether SQLite Remains Sufficient

**Files:**
- Create: `customer-local-deliverables/database-capacity-assessment.md`

- [ ] **Step 1: Measure SQLite**

Record:

- database size,
- daily row growth,
- maximum concurrent writers,
- lock wait count,
- slowest management queries,
- backup duration.

- [ ] **Step 2: Keep SQLite unless a measured trigger exists**

Keep SQLite when:

- one collector machine is used,
- writes are serialized or low concurrency,
- no recurring lock failures exist,
- backup and queries meet the operational window.

- [ ] **Step 3: Create a separate PostgreSQL migration plan only when required**

Triggers:

- multiple collector machines,
- recurring write contention,
- multiple concurrent administration clients,
- database operations exceed the agreed window.

Do not install PostgreSQL speculatively.

## Task 10: Final Delivery and Source-Code Handover

**Files:**
- Create: `docs/operations/operator-manual.md`
- Create: `docs/operations/troubleshooting.md`
- Create: `docs/operations/backup-and-restore.md`
- Create: `docs/development/architecture.md`
- Create: `docs/development/adding-a-platform-adapter.md`
- Create: `RELEASE_NOTES.md`

- [ ] **Step 1: Prepare the release**

Run:

```bash
npm ci
npm test
npm run lint
npm run build
cd admin
npm ci
npm test
npm run build
```

Expected: all commands PASS.

- [ ] **Step 2: Verify clean-machine deployment**

Install from the tagged source release on the customer Windows computer using only documented scripts.

- [ ] **Step 3: Verify backup and restore**

Restore the latest backup into a separate runtime directory and confirm:

- database opens,
- migrations are current,
- admin UI loads,
- historical tasks and data preview are visible.

- [ ] **Step 4: Scan the source release for secrets**

Run:

```bash
git grep -n -I -E "(password|cookie|authorization|webhook|token)" -- . ':!package-lock.json'
git status --short
```

Review every hit. The release must contain no customer secret, real raw report, screenshot, or unmasked business data.

- [ ] **Step 5: Tag the release**

```bash
git tag -a v1.0.0 -m "Production handover"
git show --stat v1.0.0
```

- [ ] **Step 6: Conduct handover**

Deliver:

- running system,
- complete source code,
- release tag,
- deployment instructions,
- operator manual,
- troubleshooting guide,
- backup/restore guide,
- data and publisher mapping,
- platform automation-level and limitation register.

## Final Verification Gate

- [ ] All frozen shops are represented in the production manifest.
- [ ] Multiple platform development and observation workstreams overlapped where possible.
- [ ] Every platform passed its own seven-day acceptance period.
- [ ] Administrators can add, pause, resume, and manually run shops.
- [ ] Failures alert, isolate, retry, and recover without duplicate data.
- [ ] Publication is idempotent and independent from collection.
- [ ] Backup restore was demonstrated.
- [ ] SQLite/PostgreSQL decision is based on measurements.
- [ ] Source release contains no customer secrets or real raw data.
- [ ] Complete source code and technical documentation were handed over.
