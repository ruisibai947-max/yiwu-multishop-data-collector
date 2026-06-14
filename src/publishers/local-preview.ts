import fs from "node:fs/promises";
import path from "node:path";
import type { NormalizedRepository } from "../db/normalized-repository.js";
import type { PublicationBatch, Publisher } from "./contracts.js";
import { loadPublishableRows } from "./rows.js";

function safeSegment(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}

export class LocalPreviewPublisher implements Publisher {
  readonly destination = "local_preview";

  constructor(
    private readonly runtimeRoot: string,
    private readonly normalized: NormalizedRepository
  ) {}

  async publish(batch: PublicationBatch): Promise<void> {
    const rows = loadPublishableRows(
      this.normalized,
      batch.batchKey,
      batch.rowIds
    );
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = `${row.businessDate}\u001f${row.shopId}`;
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }

    const directory = path.join(
      this.runtimeRoot,
      "preview",
      safeSegment(batch.datasetCode)
    );
    await fs.mkdir(directory, { recursive: true });
    for (const group of groups.values()) {
      const first = group[0];
      if (!first) {
        continue;
      }
      const filePath = path.join(
        directory,
        `${safeSegment(first.businessDate)}-${safeSegment(first.shopId)}.json`
      );
      const temporaryPath = `${filePath}.tmp`;
      await fs.writeFile(
        temporaryPath,
        `${JSON.stringify(group, null, 2)}\n`,
        "utf8"
      );
      await fs.rename(temporaryPath, filePath);
    }
  }
}
