import crypto from "node:crypto";
import type Database from "better-sqlite3";

export type CreateArtifactInput = {
  jobId: string;
  artifactType: "xlsx" | "csv" | "json" | "screenshot";
  filePath: string;
  sha256: string;
  byteSize: number;
  metadata: Record<string, string | number | boolean>;
};

export type ArtifactRecord = CreateArtifactInput & {
  id: string;
  createdAt: string;
};

type ArtifactRow = {
  id: string;
  job_id: string;
  artifact_type: CreateArtifactInput["artifactType"];
  file_path: string;
  sha256: string;
  byte_size: number;
  metadata_json: string;
  created_at: string;
};

function mapArtifact(row: ArtifactRow): ArtifactRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    artifactType: row.artifact_type,
    filePath: row.file_path,
    sha256: row.sha256,
    byteSize: row.byte_size,
    metadata: JSON.parse(row.metadata_json) as ArtifactRecord["metadata"],
    createdAt: row.created_at
  };
}

export class ArtifactRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: CreateArtifactInput): ArtifactRecord {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO raw_artifacts (
          id, job_id, artifact_type, file_path, sha256,
          byte_size, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.jobId,
        input.artifactType,
        input.filePath,
        input.sha256,
        input.byteSize,
        JSON.stringify(input.metadata),
        createdAt
      );
    return this.require(id);
  }

  get(id: string): ArtifactRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM raw_artifacts WHERE id = ?")
      .get(id) as ArtifactRow | undefined;
    return row ? mapArtifact(row) : undefined;
  }

  require(id: string): ArtifactRecord {
    const artifact = this.get(id);
    if (!artifact) {
      throw new Error(`Raw artifact not found: ${id}`);
    }
    return artifact;
  }

  count(): number {
    return (
      this.db.prepare("SELECT COUNT(*) AS count FROM raw_artifacts").get() as {
        count: number;
      }
    ).count;
  }
}
