import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { FastifyInstance } from "fastify";
import type { JobRepository } from "../db/job-repository.js";
import {
  datasetIsSupported,
  JobInputSchema,
  resolveActiveTarget
} from "./job-input.js";

export type JobRouteOptions = {
  db: Database.Database;
  jobs: JobRepository;
  supportedDatasets: Map<string, Set<string>>;
};

export function registerJobRoutes(
  app: FastifyInstance,
  options: JobRouteOptions
): void {
  app.post("/api/jobs", async (request, reply) => {
    const parsed = JobInputSchema.safeParse(request.body);
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

    return reply.code(201).send(job);
  });
}
