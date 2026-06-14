import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { archiveArtifact } from "../../src/runtime/archive-artifact.js";

const temporaryDirectories: string[] = [];

function createRoot() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "archive-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("archiveArtifact", () => {
  it("writes bytes and returns a stable sha256", async () => {
    const root = createRoot();
    const bytes = new TextEncoder().encode("a,b\n1,2\n");
    const first = await archiveArtifact(root, {
      platform: "mock",
      accountId: "account-1",
      shopId: "shop-1",
      jobId: "job-1",
      suggestedName: "report.csv",
      bytes
    });
    const second = await archiveArtifact(root, {
      platform: "mock",
      accountId: "account-1",
      shopId: "shop-1",
      jobId: "job-2",
      suggestedName: "report-copy.csv",
      bytes
    });

    expect(first.sha256).toBe(second.sha256);
    expect(first.byteSize).toBe(bytes.byteLength);
    expect(fs.readFileSync(first.filePath)).toEqual(Buffer.from(bytes));
  });

  it("keeps suggested filenames inside the job directory", async () => {
    const root = createRoot();
    const result = await archiveArtifact(root, {
      platform: "mock",
      accountId: "account-1",
      shopId: "shop-1",
      jobId: "job-1",
      suggestedName: "../../outside.csv",
      bytes: new TextEncoder().encode("safe")
    });

    expect(result.filePath).toContain(
      path.join("mock", "account-1", "shop-1", "job-1")
    );
    expect(path.basename(result.filePath)).toMatch(/-outside\.csv$/);
  });
});
