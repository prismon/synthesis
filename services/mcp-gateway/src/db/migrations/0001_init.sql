CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS twins (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  policy_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS counterparts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  twin_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  mcp_resource_uri TEXT NOT NULL,
  role TEXT NOT NULL,
  sync_policy_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS twin_events (
  tenant_id TEXT NOT NULL,
  twin_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_json JSONB NOT NULL,
  causation_id TEXT NULL,
  correlation_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, twin_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_twin_events_lookup ON twin_events (tenant_id, twin_id, created_at);
