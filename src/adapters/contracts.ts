export type JobRequest = {
  jobId: string;
  platform: string;
  accountId: string;
  shopId?: string;
  datasetCode: string;
  businessFrom: string;
  businessTo: string;
};

export type SessionProbe =
  | { status: "ready"; accountLabel: string }
  | { status: "waiting_auth"; reason: string };

export type CollectedArtifact = {
  type: "xlsx" | "csv" | "json" | "screenshot";
  bytes: Uint8Array;
  suggestedName: string;
  metadata: Record<string, string | number | boolean>;
};

export interface PlatformAdapter {
  readonly platform: string;
  probeSession(request: JobRequest): Promise<SessionProbe>;
  collect(request: JobRequest): AsyncGenerator<CollectedArtifact>;
}
