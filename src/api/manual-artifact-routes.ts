import crypto from "node:crypto";
import path from "node:path";
import multipart from "@fastify/multipart";
import type Database from "better-sqlite3";
import type { FastifyInstance } from "fastify";
import type { CollectedArtifact } from "../adapters/contracts.js";
import type { CollectionEngine } from "../collection/engine.js";
import { DataValidationError } from "../collection/errors.js";
import type { JobRepository } from "../db/job-repository.js";
import {
  datasetIsSupported,
  JobInputSchema,
  resolveActiveTarget
} from "./job-input.js";

export type ManualArtifactRouteOptions = {
  db: Database.Database;
  jobs: JobRepository;
  engine: CollectionEngine;
  supportedDatasets: Map<string, Set<string>>;
  maxFileBytes: number;
};

const extensionTypes = new Map<
  string,
  Exclude<CollectedArtifact["type"], "screenshot">
>([
  [".csv", "csv"],
  [".xlsx", "xlsx"],
  [".json", "json"]
]);

export function registerManualArtifactRoutes(
  app: FastifyInstance,
  options: ManualArtifactRouteOptions
): void {
  app.register(multipart, {
    limits: {
      files: 1,
      fileSize: options.maxFileBytes,
      fields: 10
    }
  });

  app.post("/api/manual-artifacts", async (request, reply) => {
    const fields: Record<string, string> = {};
    let upload:
      | {
          filename: string;
          type: Exclude<CollectedArtifact["type"], "screenshot">;
          bytes: Buffer;
        }
      | undefined;

    try {
      for await (const part of request.parts()) {
        if (part.type === "field") {
          fields[part.fieldname] = String(part.value);
          continue;
        }

        const extension = path.extname(part.filename).toLowerCase();
        const type = extensionTypes.get(extension);
        if (!type) {
          part.file.resume();
          return reply.code(400).send({ error: "UNSUPPORTED_FILE_TYPE" });
        }
        upload = {
          filename: part.filename,
          type,
          bytes: await part.toBuffer()
        };
      }
    } catch (error) {
      if (app.multipartErrors.RequestFileTooLargeError instanceof Function &&
          error instanceof app.multipartErrors.RequestFileTooLargeError) {
        return reply.code(413).send({ error: "FILE_TOO_LARGE" });
      }
      throw error;
    }

    if (!upload) {
      return reply.code(400).send({ error: "FILE_REQUIRED" });
    }
    const parsed = JobInputSchema.safeParse(fields);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_JOB_INPUT",
        issues: parsed.error.issues
      });
    }
    const target = resolveActiveTarget(options.db, parsed.data);
    if (!target) {
      return reply.code(404).send({
        error: "ACTIVE_ACCOUNT_OR_SHOP_NOT_FOUND"
      });
    }
    if (
      !datasetIsSupported(
        options.supportedDatasets,
        target.platform,
        parsed.data.datasetCode
      )
    ) {
      return reply.code(400).send({ error: "UNSUPPORTED_DATASET" });
    }

    const job = options.jobs.create({
      id: crypto.randomUUID(),
      platform: target.platform,
      accountId: parsed.data.accountId,
      shopId: parsed.data.shopId,
      datasetCode: parsed.data.datasetCode,
      businessFrom: parsed.data.businessFrom,
      businessTo: parsed.data.businessTo,
      triggerType: "manual"
    });

    try {
      const completed = await options.engine.ingestArtifact(job.id, {
        type: upload.type,
        bytes: upload.bytes,
        suggestedName: upload.filename,
        metadata: {
          source: "manual_upload",
          originalName: upload.filename
        }
      });
      return reply.code(201).send(completed);
    } catch (error) {
      if (error instanceof DataValidationError) {
        return reply.code(422).send({
          error: "REPORT_VALIDATION_FAILED",
          message: error.message,
          jobId: job.id
        });
      }
      throw error;
    }
  });
}
