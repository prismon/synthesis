import { Tools } from "@synthesis/contracts";
import { db } from "../db/client.js";
import { counterparts, syncPolicies, twinEvents, twins, workspaces, tenants } from "../db/schema.js";
import { runRules } from "../rules/pipeline.js";
import { subjectForTwin } from "../nats/jetstream.js";

import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

function nowIso() {
  return new Date().toISOString();
}
function newId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export type ToolContext = {
  js: { publish: (subj: string, data: Uint8Array) => Promise<{ seq: bigint }> };
  sc: { encode: (s: string) => Uint8Array };
};

export function listTools() {
  return [
    { name: "twin.list", description: "List twins", inputSchema: Tools.twin_list.shape },
    { name: "twin.create", description: "Create a twin", inputSchema: Tools.twin_create.shape },
    { name: "twin.get", description: "Get a twin", inputSchema: Tools.twin_get.shape },
    { name: "twin.getEvents", description: "Get twin events", inputSchema: Tools.twin_getEvents.shape },
    { name: "twin.appendEvent", description: "Append an event to a twin", inputSchema: Tools.twin_appendEvent.shape },
    { name: "counterpart.attach", description: "Attach a counterpart to a twin", inputSchema: Tools.counterpart_attach.shape },
    { name: "syncPolicy.create", description: "Create a sync policy", inputSchema: Tools.syncPolicy_create.shape }
  ];
}

export async function callTool(ctx: ToolContext, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "twin.list": return twinList(args);
    case "twin.create": return twinCreate(ctx, args);
    case "twin.get": return twinGet(args);
    case "twin.getEvents": return twinGetEvents(args);
    case "twin.appendEvent": return twinAppendEvent(ctx, args);
    case "counterpart.attach": return counterpartAttach(ctx, args);
    case "syncPolicy.create": return syncPolicyCreate(args);
    default:
      return { ok: false, error: { code: "TOOL_NOT_FOUND", message: `Unknown tool: ${name}` } };
  }
}

async function ensureTenantWorkspace(tenantId: string, workspaceId: string) {
  const t = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (t.length === 0) {
    await db.insert(tenants).values({ id: tenantId, name: tenantId, createdAt: new Date() });
  }
  const w = await db.select().from(workspaces).where(and(eq(workspaces.id, workspaceId), eq(workspaces.tenantId, tenantId))).limit(1);
  if (w.length === 0) {
    await db.insert(workspaces).values({ id: workspaceId, tenantId, name: workspaceId, createdAt: new Date() });
  }
}

async function twinList(args: Record<string, unknown>) {
  const parsed = Tools.twin_list.safeParse(args);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_ARGS", message: parsed.error.message } };
  const { tenantId, workspaceId } = parsed.data;

  const rows = workspaceId
    ? await db.select().from(twins).where(and(eq(twins.tenantId, tenantId), eq(twins.workspaceId, workspaceId))).orderBy(desc(twins.createdAt))
    : await db.select().from(twins).where(eq(twins.tenantId, tenantId)).orderBy(desc(twins.createdAt));

  return { ok: true, result: { twins: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) } };
}

async function twinCreate(ctx: ToolContext, args: Record<string, unknown>) {
  const parsed = Tools.twin_create.safeParse(args);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_ARGS", message: parsed.error.message } };
  const { tenantId, workspaceId, type, title } = parsed.data;

  await ensureTenantWorkspace(tenantId, workspaceId);

  const twinId = newId("twin");
  const createdAt = new Date();

  await db.insert(twins).values({ id: twinId, tenantId, workspaceId, type, title, createdAt });

  // Append twin.created event
  const append = await appendEvent(ctx, {
    tenantId,
    twinId,
    type: "twin.created",
    payload: {},
    causationId: undefined,
    correlationId: undefined,
    ts: nowIso()
  });

  if (!append.ok) return append;

  return { ok: true, result: { twinId, eventSeq: append.result.seq } };
}

async function twinGet(args: Record<string, unknown>) {
  const parsed = Tools.twin_get.safeParse(args);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_ARGS", message: parsed.error.message } };
  const { tenantId, twinId } = parsed.data;

  const row = await db.select().from(twins).where(and(eq(twins.tenantId, tenantId), eq(twins.id, twinId))).limit(1);
  if (row.length === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Twin not found" } };

  return { ok: true, result: { twin: { ...row[0], createdAt: row[0].createdAt.toISOString() } } };
}

async function twinGetEvents(args: Record<string, unknown>) {
  const parsed = Tools.twin_getEvents.safeParse(args);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_ARGS", message: parsed.error.message } };
  const { tenantId, twinId, fromSeq = 1, limit = 100 } = parsed.data;

  const rows = await db
    .select()
    .from(twinEvents)
    .where(and(eq(twinEvents.tenantId, tenantId), eq(twinEvents.twinId, twinId), sql`${twinEvents.seq} >= ${fromSeq}`))
    .orderBy(twinEvents.seq)
    .limit(limit);

  return {
    ok: true,
    result: {
      events: rows.map((r) => ({
        tenantId: r.tenantId,
        twinId: r.twinId,
        seq: r.seq,
        type: r.eventType,
        event: r.eventJson,
        createdAt: r.createdAt.toISOString()
      })),
      nextSeq: rows.length ? rows[rows.length - 1].seq + 1 : fromSeq
    }
  };
}

async function twinAppendEvent(ctx: ToolContext, args: Record<string, unknown>) {
  const parsed = Tools.twin_appendEvent.safeParse(args);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_ARGS", message: parsed.error.message } };

  const { tenantId, twinId, type, payload, causationId, correlationId } = parsed.data;
  const env = { tenantId, twinId, type: type as any, payload, causationId, correlationId, ts: nowIso() };
  return appendEvent(ctx, env);
}

async function counterpartAttach(ctx: ToolContext, args: Record<string, unknown>) {
  const parsed = Tools.counterpart_attach.safeParse(args);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_ARGS", message: parsed.error.message } };
  const { tenantId, twinId, kind, resourceUri, role, syncPolicyId } = parsed.data;

  const counterpartId = newId("cp");
  await db.insert(counterparts).values({
    id: counterpartId,
    tenantId,
    twinId,
    kind,
    resourceUri,
    role,
    syncPolicyId: syncPolicyId ?? null,
    createdAt: new Date()
  });

  const env = {
    tenantId,
    twinId,
    type: "counterpart.attached" as const,
    payload: { counterpartId, kind, resourceUri, role, syncPolicyId },
    ts: nowIso(),
    causationId: undefined,
    correlationId: undefined
  };

  const append = await appendEvent(ctx, env);
  if (!append.ok) return append;

  return { ok: true, result: { counterpartId, eventSeq: append.result.seq } };
}

async function syncPolicyCreate(args: Record<string, unknown>) {
  const parsed = Tools.syncPolicy_create.safeParse(args);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_ARGS", message: parsed.error.message } };
  const { tenantId, name, policy } = parsed.data;

  const id = newId("sp");
  await db.insert(syncPolicies).values({ id, tenantId, name, policyJson: policy, createdAt: new Date() });
  return { ok: true, result: { syncPolicyId: id } };
}

async function appendEvent(
  ctx: ToolContext,
  env: { tenantId: string; twinId: string; type: any; payload: unknown; ts: string; causationId?: string; correlationId?: string }
) {
  const decision = runRules(env as any);
  if (decision.kind === "deny") {
    return { ok: false, error: { code: decision.code, message: decision.message } };
  }

  const maxSeq = await db
    .select({ max: sql<number>`COALESCE(MAX(${twinEvents.seq}), 0)` })
    .from(twinEvents)
    .where(and(eq(twinEvents.tenantId, env.tenantId), eq(twinEvents.twinId, env.twinId)));

  const nextSeq = (maxSeq[0]?.max ?? 0) + 1;

  await db.insert(twinEvents).values({
    tenantId: env.tenantId,
    twinId: env.twinId,
    seq: nextSeq,
    eventType: env.type,
    eventJson: env,
    causationId: env.causationId ?? null,
    correlationId: env.correlationId ?? null,
    createdAt: new Date()
  });

  const subject = subjectForTwin(env.tenantId, env.twinId);
  await ctx.js.publish(subject, ctx.sc.encode(JSON.stringify({ seq: nextSeq, event: env })));

  return { ok: true, result: { seq: nextSeq, event: env } };
}
