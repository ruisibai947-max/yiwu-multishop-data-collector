import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { FastifyInstance } from "fastify";
import type { ArtifactRepository } from "../db/artifact-repository.js";

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  );
}

export function registerArtifactRoutes(
  app: FastifyInstance,
  db: Database.Database,
  artifacts: ArtifactRepository,
  runtimeDir: string
): void {
  app.get("/api/jobs/:jobId/artifacts", async (request) => {
    const jobId = (request.params as { jobId: string }).jobId;
    const rows = db
      .prepare(
        `SELECT id, job_id, artifact_type, sha256, byte_size,
                metadata_json, created_at
         FROM raw_artifacts
         WHERE job_id = ?
         ORDER BY created_at`
      )
      .all(jobId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      artifactType: row.artifact_type,
      sha256: row.sha256,
      byteSize: row.byte_size,
      metadata: JSON.parse(String(row.metadata_json)) as Record<
        string,
        unknown
      >,
      createdAt: row.created_at,
      downloadUrl: `/api/artifacts/${String(row.id)}/download`
    }));
  });

  app.get("/api/artifacts/:id/download", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const artifact = artifacts.get(id);
    if (!artifact) {
      return reply.code(404).send({ error: "ARTIFACT_NOT_FOUND" });
    }

    let realRoot: string;
    let realFile: string;
    try {
      realRoot = fs.realpathSync(runtimeDir);
      realFile = fs.realpathSync(artifact.filePath);
    } catch {
      return reply.code(404).send({ error: "ARTIFACT_FILE_NOT_FOUND" });
    }
    if (!isInside(realRoot, realFile)) {
      return reply.code(403).send({ error: "ARTIFACT_OUTSIDE_RUNTIME" });
    }

    reply.header(
      "content-disposition",
      `attachment; filename="${path.basename(realFile).replaceAll('"', "_")}"`
    );
    return reply.type("application/octet-stream").send(fs.createReadStream(realFile));
  });
}
