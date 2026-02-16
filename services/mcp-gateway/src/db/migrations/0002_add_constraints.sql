-- Add foreign key constraints (idempotent)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_workspaces_tenant') THEN
    ALTER TABLE workspaces ADD CONSTRAINT fk_workspaces_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_twins_tenant') THEN
    ALTER TABLE twins ADD CONSTRAINT fk_twins_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_twins_workspace') THEN
    ALTER TABLE twins ADD CONSTRAINT fk_twins_workspace
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_counterparts_twin') THEN
    ALTER TABLE counterparts ADD CONSTRAINT fk_counterparts_twin
      FOREIGN KEY (twin_id) REFERENCES twins(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_counterparts_sync_policy') THEN
    ALTER TABLE counterparts ADD CONSTRAINT fk_counterparts_sync_policy
      FOREIGN KEY (sync_policy_id) REFERENCES sync_policies(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_twin_events_twin') THEN
    ALTER TABLE twin_events ADD CONSTRAINT fk_twin_events_twin
      FOREIGN KEY (twin_id) REFERENCES twins(id);
  END IF;
END $$;
