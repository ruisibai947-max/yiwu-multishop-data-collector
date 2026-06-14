CREATE TABLE IF NOT EXISTS quarantined_batches (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES collection_jobs(id),
  dataset_code TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_quarantined_batches_job
  ON quarantined_batches(job_id, created_at);
