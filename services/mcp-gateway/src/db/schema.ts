import { pgTable, text, timestamp, integer, jsonb, primaryKey } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const twins = pgTable("twins", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const syncPolicies = pgTable("sync_policies", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  policyJson: jsonb("policy_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const counterparts = pgTable("counterparts", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  twinId: text("twin_id").notNull(),
  kind: text("kind").notNull(),
  resourceUri: text("mcp_resource_uri").notNull(),
  role: text("role").notNull(),
  syncPolicyId: text("sync_policy_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const twinEvents = pgTable(
  "twin_events",
  {
    tenantId: text("tenant_id").notNull(),
    twinId: text("twin_id").notNull(),
    seq: integer("seq").notNull(),
    eventType: text("event_type").notNull(),
    eventJson: jsonb("event_json").notNull(),
    causationId: text("causation_id"),
    correlationId: text("correlation_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.twinId, t.seq] })
  })
);
