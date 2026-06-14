import Fastify from "fastify";
import type Database from "better-sqlite3";
import { registerAccountRoutes } from "./api/account-routes.js";
import { registerArtifactRoutes } from "./api/artifact-routes.js";
import { registerShopRoutes } from "./api/shop-routes.js";
import {
  JobPickupControl,
  registerStatusRoutes
} from "./api/status-routes.js";
import { ArtifactRepository } from "./db/artifact-repository.js";
import { JobRepository } from "./db/job-repository.js";

export type BuildAppOptions = {
  db?: Database.Database;
  runtimeDir?: string;
};

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));

  if (options.db && options.runtimeDir) {
    const jobs = new JobRepository(options.db);
    const artifacts = new ArtifactRepository(options.db);
    const control = new JobPickupControl();
    registerAccountRoutes(app, options.db);
    registerShopRoutes(app, options.db);
    registerStatusRoutes(app, options.db, jobs, control);
    registerArtifactRoutes(app, options.db, artifacts, options.runtimeDir);
  }

  return app;
}
