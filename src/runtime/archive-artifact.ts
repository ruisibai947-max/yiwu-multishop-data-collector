import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

type ArchiveArtifactInput = {
  platform: string;
  accountId: string;
  shopId?: string;
  jobId: string;
  suggestedName: string;
  bytes: Uint8Array;
};

const safeSegmentPattern = /^[a-zA-Z0-9._-]+$/;

function requireSafeSegment(label: string, value: string): string {
  if (!safeSegmentPattern.test(value) || value === "." || value === "..") {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
}

export async function archiveArtifact(
  root: string,
  input: ArchiveArtifactInput
) {
  const sha256 = crypto.createHash("sha256").update(input.bytes).digest("hex");
  const directory = path.join(
    root,
    requireSafeSegment("platform", input.platform),
    requireSafeSegment("accountId", input.accountId),
    requireSafeSegment("shopId", input.shopId ?? "_account"),
    requireSafeSegment("jobId", input.jobId)
  );
  const suggestedName =
    path.basename(input.suggestedName).replaceAll(/[^a-zA-Z0-9._-]/g, "_") ||
    "artifact.bin";
  const filePath = path.join(
    directory,
    `${sha256.slice(0, 12)}-${suggestedName}`
  );

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(filePath, input.bytes);

  return {
    filePath,
    sha256,
    byteSize: input.bytes.byteLength
  };
}
