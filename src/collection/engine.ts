import type {
  CollectedArtifact,
  PlatformAdapter
} from "../adapters/contracts.js";
import type { ArtifactRepository } from "../db/artifact-repository.js";
import type { JobRecord, JobRepository } from "../db/job-repository.js";
import type { NormalizedRepository } from "../db/normalized-repository.js";
import type { QuarantineRepository } from "../db/quarantine-repository.js";
import type { DatasetParser } from "../parsers/contracts.js";
import { validateDataset } from "../parsers/validation.js";
import type { Publisher } from "../publishers/contracts.js";
import { archiveArtifact } from "../runtime/archive-artifact.js";
import {
  DataValidationError,
  RetryableCollectionError,
  WaitingForAuthError
} from "./errors.js";

type Sleep = (milliseconds: number) => Promise<void>;

export type CollectionEngineOptions = {
  jobs: JobRepository;
  artifacts: ArtifactRepository;
  normalized: NormalizedRepository;
  quarantine: QuarantineRepository;
  archiveRoot: string;
  adapters: Map<string, PlatformAdapter>;
  parsers: Map<string, DatasetParser>;
  publishers?: Publisher[];
  sleep?: Sleep;
  retryDelaysMs?: number[];
};

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorDetails(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof WaitingForAuthError) {
    return { code: "WAITING_FOR_AUTH", message: error.message };
  }
  if (error instanceof DataValidationError) {
    return { code: "data_validation", message: error.message };
  }
  if (error instanceof RetryableCollectionError) {
    return { code: "RETRY_EXHAUSTED", message: error.message };
  }
  if (error instanceof Error) {
    return {
      code: "UNEXPECTED",
      message: error.stack ?? error.message
    };
  }
  return { code: "UNEXPECTED", message: String(error) };
}

export class CollectionEngine {
  private readonly sleep: Sleep;
  private readonly retryDelaysMs: number[];

  constructor(private readonly options: CollectionEngineOptions) {
    this.sleep = options.sleep ?? defaultSleep;
    this.retryDelaysMs = options.retryDelaysMs ?? [30_000, 120_000];
  }

  async run(jobId: string): Promise<JobRecord> {
    const originalJob = this.options.jobs.require(jobId);
    this.options.jobs.update(jobId, {
      status: "running",
      startedAt: originalJob.startedAt ?? new Date().toISOString(),
      finishedAt: null,
      errorCode: null,
      errorMessage: null
    });

    for (let attempt = 1; ; attempt += 1) {
      this.options.jobs.update(jobId, {
        status: "running",
        attemptCount: attempt,
        errorCode: null,
        errorMessage: null
      });

      try {
        const completedJob = this.options.jobs.require(jobId);
        const rowIds = await this.collectOnce(completedJob);
        this.options.jobs.update(jobId, {
          status: "succeeded",
          checkpoint: "stored",
          finishedAt: new Date().toISOString()
        });
        await this.publishBestEffort(completedJob, rowIds);
        return this.options.jobs.require(jobId);
      } catch (error) {
        if (error instanceof RetryableCollectionError) {
          const delay = this.retryDelaysMs[attempt - 1];
          if (delay !== undefined) {
            await this.sleep(delay);
            continue;
          }
        }

        const details = errorDetails(error);
        if (error instanceof WaitingForAuthError) {
          return this.options.jobs.update(jobId, {
            status: "waiting_auth",
            errorCode: details.code,
            errorMessage: details.message
          });
        }

        return this.options.jobs.update(jobId, {
          status: "failed",
          errorCode: details.code,
          errorMessage: details.message,
          finishedAt: new Date().toISOString()
        });
      }
    }
  }

  async ingestArtifact(
    jobId: string,
    collected: CollectedArtifact
  ): Promise<JobRecord> {
    const job = this.options.jobs.require(jobId);
    this.options.jobs.update(jobId, {
      status: "running",
      attemptCount: 1,
      startedAt: job.startedAt ?? new Date().toISOString(),
      finishedAt: null,
      errorCode: null,
      errorMessage: null
    });

    try {
      const currentJob = this.options.jobs.require(jobId);
      const rowIds = await this.processArtifact(currentJob, collected);
      this.options.jobs.update(jobId, {
        status: "succeeded",
        checkpoint: "stored",
        finishedAt: new Date().toISOString()
      });
      await this.publishBestEffort(currentJob, rowIds);
      return this.options.jobs.require(jobId);
    } catch (error) {
      const details = errorDetails(error);
      this.options.jobs.update(jobId, {
        status: "failed",
        errorCode: details.code,
        errorMessage: details.message,
        finishedAt: new Date().toISOString()
      });
      throw error;
    }
  }

  private async collectOnce(job: JobRecord): Promise<string[]> {
    const adapter = this.options.adapters.get(job.platform);
    if (!adapter) {
      throw new DataValidationError(
        `No adapter registered for platform: ${job.platform}`
      );
    }
    if (!job.shopId) {
      throw new DataValidationError(
        `Dataset ${job.datasetCode} requires a shop`
      );
    }

    const request = {
      jobId: job.id,
      platform: job.platform,
      accountId: job.accountId,
      shopId: job.shopId,
      datasetCode: job.datasetCode,
      businessFrom: job.businessFrom,
      businessTo: job.businessTo
    };
    const probe = await adapter.probeSession(request);
    if (probe.status === "waiting_auth") {
      throw new WaitingForAuthError(probe.reason);
    }
    this.options.jobs.update(job.id, { checkpoint: "session_ready" });

    let artifactCount = 0;
    const rowIds: string[] = [];
    for await (const collected of adapter.collect(request)) {
      artifactCount += 1;
      rowIds.push(...(await this.processArtifact(job, collected)));
    }

    if (artifactCount === 0) {
      throw new DataValidationError("Adapter returned no artifacts");
    }
    return rowIds;
  }

  private async processArtifact(
    job: JobRecord,
    collected: CollectedArtifact
  ): Promise<string[]> {
    const parser = this.options.parsers.get(job.datasetCode);
    if (!parser) {
      throw new DataValidationError(
        `No parser registered for dataset: ${job.datasetCode}`
      );
    }
    if (!job.shopId) {
      throw new DataValidationError(
        `Dataset ${job.datasetCode} requires a shop`
      );
    }

    const archived = await archiveArtifact(this.options.archiveRoot, {
      platform: job.platform,
      accountId: job.accountId,
      shopId: job.shopId,
      jobId: job.id,
      suggestedName: collected.suggestedName,
      bytes: collected.bytes
    });
    const artifact = this.options.artifacts.create({
      jobId: job.id,
      artifactType: collected.type,
      filePath: archived.filePath,
      sha256: archived.sha256,
      byteSize: archived.byteSize,
      metadata: collected.metadata
    });
    this.options.jobs.update(job.id, {
      checkpoint: "artifact_archived"
    });

    let rows;
    try {
      rows = await parser.parse(artifact.filePath);
    } catch (error) {
      if (error instanceof DataValidationError) {
        this.options.quarantine.create({
          jobId: job.id,
          datasetCode: job.datasetCode,
          reasonCode: "invalid_values",
          details: { message: error.message }
        });
      }
      throw error;
    }
    this.options.jobs.update(job.id, { checkpoint: "parsed" });
    const validation = validateDataset({
      ...(await parser.validationContext(artifact.filePath, rows)),
      rows
    });
    if (!validation.ok) {
      this.options.quarantine.create({
        jobId: job.id,
        datasetCode: job.datasetCode,
        reasonCode: validation.reasonCode,
        details: validation.details
      });
      throw new DataValidationError(validation.reasonCode);
    }
    const rowIds: string[] = [];
    for (const row of rows) {
      rowIds.push(
        this.options.normalized.upsert({
          platform: job.platform,
          datasetCode: job.datasetCode,
          accountId: job.accountId,
          shopId: job.shopId,
          businessDate: row.businessDate,
          naturalKey: row.naturalKey,
          ...(row.currency ? { currency: row.currency } : {}),
          payload: row.payload,
          metrics: row.metrics,
          sourceArtifactId: artifact.id
        }).id
      );
    }
    this.options.jobs.update(job.id, { checkpoint: "stored" });
    return rowIds;
  }

  private async publishBestEffort(
    job: JobRecord,
    rowIds: string[]
  ): Promise<void> {
    const publishers = this.options.publishers ?? [];
    if (publishers.length === 0) {
      return;
    }
    const batch = {
      batchKey: [
        job.datasetCode,
        job.businessFrom,
        job.businessTo,
        job.shopId ?? job.accountId
      ].join(":"),
      datasetCode: job.datasetCode,
      rowIds
    };
    let allSucceeded = true;
    for (const publisher of publishers) {
      try {
        await publisher.publish(batch);
      } catch {
        allSucceeded = false;
      }
    }
    if (allSucceeded) {
      this.options.jobs.update(job.id, { checkpoint: "published" });
    }
  }
}
