import type { NormalizedRepository } from "../db/normalized-repository.js";
import type { PublicationRepository } from "../db/publication-repository.js";
import type { PublicationBatch, Publisher } from "./contracts.js";
import {
  loadPublishableRows,
  type PublishableRow
} from "./rows.js";

export type FeishuPublisherConfig = {
  appToken: string;
  tableId: string;
  enabled: boolean;
};

export type FeishuTransportRequest = {
  config: FeishuPublisherConfig;
  batchKey: string;
  datasetCode: string;
  rows: PublishableRow[];
};

export interface FeishuTransport {
  publish(request: FeishuTransportRequest): Promise<void>;
}

export class FeishuPublisher implements Publisher {
  readonly destination = "feishu";

  constructor(
    private readonly config: FeishuPublisherConfig,
    private readonly publications: PublicationRepository,
    private readonly normalized: NormalizedRepository,
    private readonly transport: FeishuTransport
  ) {}

  async publish(batch: PublicationBatch): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    this.publications.getOrCreate({
      destination: this.destination,
      datasetCode: batch.datasetCode,
      batchKey: batch.batchKey
    });
    this.publications.markRunning(this.destination, batch.batchKey);

    try {
      await this.transport.publish({
        config: this.config,
        batchKey: batch.batchKey,
        datasetCode: batch.datasetCode,
        rows: loadPublishableRows(
          this.normalized,
          batch.batchKey,
          batch.rowIds
        )
      });
      this.publications.markSucceeded(this.destination, batch.batchKey);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.publications.markFailed(
        this.destination,
        batch.batchKey,
        message
      );
      throw error;
    }
  }
}
