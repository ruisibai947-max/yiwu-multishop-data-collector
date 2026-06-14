import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { registerAccountRoutes } from "./api/account-routes.js";
import { registerArtifactRoutes } from "./api/artifact-routes.js";
import { registerJobRoutes } from "./api/job-routes.js";
import { registerManualArtifactRoutes } from "./api/manual-artifact-routes.js";
import { registerShopRoutes } from "./api/shop-routes.js";
import {
  JobPickupControl,
  registerStatusRoutes
} from "./api/status-routes.js";
import { ArtifactRepository } from "./db/artifact-repository.js";
import { JobRepository } from "./db/job-repository.js";
import type { CollectionEngine } from "./collection/engine.js";

export type BuildAppOptions = {
  db?: Database.Database;
  runtimeDir?: string;
  adminDistDir?: string;
  collection?: {
    engine: CollectionEngine;
    supportedDatasets: Map<string, Set<string>>;
    maxFileBytes: number;
    runCreatedJobs?: boolean;
  };
};

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));

  if (options.db && options.runtimeDir) {
    const jobs = new JobRepository(options.db);
    const artifacts = new ArtifactRepository(options.db);
    const control = new JobPickupControl();
    const inFlight = new Set<string>();
    const runJob = (jobId: string) => {
      if (
        options.collection?.runCreatedJobs &&
        !control.status().jobPickupPaused &&
        !inFlight.has(jobId)
      ) {
        inFlight.add(jobId);
        setImmediate(() => {
          if (!control.status().jobPickupPaused) {
            void options.collection?.engine
              .run(jobId)
              .finally(() => inFlight.delete(jobId));
          } else {
            inFlight.delete(jobId);
          }
        });
      }
    };
    const runQueuedJobs = () => {
      for (const job of jobs.listByStatus("queued")) {
        runJob(job.id);
      }
    };
    registerAccountRoutes(app, options.db);
    registerShopRoutes(app, options.db);
    registerStatusRoutes(
      app,
      options.db,
      jobs,
      control,
      runJob,
      runQueuedJobs
    );
    registerArtifactRoutes(app, options.db, artifacts, options.runtimeDir);
    if (options.collection) {
      registerJobRoutes(app, {
        db: options.db,
        jobs,
        supportedDatasets: options.collection.supportedDatasets,
        onJobCreated: runJob
      });
      registerManualArtifactRoutes(app, {
        db: options.db,
        jobs,
        engine: options.collection.engine,
        supportedDatasets: options.collection.supportedDatasets,
        maxFileBytes: options.collection.maxFileBytes
      });
    }
    if (options.collection?.runCreatedJobs) {
      setImmediate(runQueuedJobs);
    }
  }

  const adminDistDir = options.adminDistDir ?? path.resolve("admin/dist");
  if (fs.existsSync(path.join(adminDistDir, "index.html"))) {
    app.register(fastifyStatic, {
      root: adminDistDir,
      index: ["index.html"]
    });
  }

  return app;
}
