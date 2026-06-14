CREATE TABLE IF NOT EXISTS browser_profiles (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_profile_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  UNIQUE(provider, external_profile_id)
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  account_name TEXT NOT NULL,
  browser_profile_id TEXT NOT NULL REFERENCES browser_profiles(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'waiting_auth', 'paused'))
);

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  platform_shop_id TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  site_code TEXT,
  currency TEXT,
  timezone TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  UNIQUE(account_id, platform_shop_id)
);

CREATE TABLE IF NOT EXISTS collection_jobs (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  shop_id TEXT REFERENCES shops(id),
  dataset_code TEXT NOT NULL,
  business_from TEXT NOT NULL,
  business_to TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (
    trigger_type IN ('scheduled', 'manual', 'retry')
  ),
  status TEXT NOT NULL CHECK (
    status IN (
      'queued',
      'running',
      'waiting_auth',
      'failed',
      'succeeded',
      'cancelled'
    )
  ),
  checkpoint TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS raw_artifacts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES collection_jobs(id),
  artifact_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS normalized_rows (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  dataset_code TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  shop_id TEXT NOT NULL REFERENCES shops(id),
  business_date TEXT NOT NULL,
  natural_key TEXT NOT NULL,
  currency TEXT,
  payload_json TEXT NOT NULL,
  row_hash TEXT NOT NULL,
  source_artifact_id TEXT NOT NULL REFERENCES raw_artifacts(id),
  updated_at TEXT NOT NULL,
  UNIQUE(platform, dataset_code, shop_id, business_date, natural_key)
);

CREATE TABLE IF NOT EXISTS metric_facts (
  normalized_row_id TEXT NOT NULL
    REFERENCES normalized_rows(id) ON DELETE CASCADE,
  metric_code TEXT NOT NULL,
  numeric_value TEXT NOT NULL,
  unit TEXT NOT NULL,
  currency TEXT,
  PRIMARY KEY(normalized_row_id, metric_code)
);

CREATE TABLE IF NOT EXISTS publications (
  id TEXT PRIMARY KEY,
  destination TEXT NOT NULL,
  dataset_code TEXT NOT NULL,
  batch_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'running', 'failed', 'succeeded')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(destination, batch_key)
);

CREATE INDEX IF NOT EXISTS idx_collection_jobs_status_created
  ON collection_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_normalized_rows_shop_date
  ON normalized_rows(shop_id, business_date);
