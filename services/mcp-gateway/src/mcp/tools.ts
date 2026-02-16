import { z } from "zod";
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
  js: { publish: (subj: string, data: Uint8Array) => Promise<{ seq: number }> };
  sc: { encode: (s: string) => Uint8Array };
};

export async function twinList(args: z.infer<typeof Tools.twin_list>) {
  const { tenantId, workspaceId } = args;

  const rows = workspaceId
    ? await db.select().from(twins).where(and(eq(twins.tenantId, tenantId), eq(twins.workspaceId, workspaceId))).orderBy(desc(twins.createdAt))
    : await db.select().from(twins).where(eq(twins.tenantId, tenantId)).orderBy(desc(twins.createdAt));

  return { twins: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
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

export async function twinCreate(ctx: ToolContext, args: z.infer<typeof Tools.twin_create>) {
  const { tenantId, workspaceId, type, title } = args;

  await ensureTenantWorkspace(tenantId, workspaceId);

  const twinId = newId("twin");
  const createdAt = new Date();

  await db.insert(twins).values({ id: twinId, tenantId, workspaceId, type, title, createdAt });

  const append = await appendEvent(ctx, {
    tenantId,
    twinId,
    type: "twin.created",
    payload: {},
    ts: nowIso()
  });

  if (!append.ok) throw new Error(append.error.message);

  return { twinId, eventSeq: append.result.seq };
}

export async function twinGetState(args: z.infer<typeof Tools.twin_getState>) {
  const { tenantId, twinId } = args;

  const row = await db.select().from(twins).where(and(eq(twins.tenantId, tenantId), eq(twins.id, twinId))).limit(1);
  if (row.length === 0) throw new Error("Twin not found");

  return { twin: { ...row[0]!, createdAt: row[0]!.createdAt.toISOString() } };
}

export async function twinGetEvents(args: z.infer<typeof Tools.twin_getEvents>) {
  const { tenantId, twinId, fromSeq = 1, limit = 100 } = args;

  const rows = await db
    .select()
    .from(twinEvents)
    .where(and(eq(twinEvents.tenantId, tenantId), eq(twinEvents.twinId, twinId), sql`${twinEvents.seq} >= ${fromSeq}`))
    .orderBy(twinEvents.seq)
    .limit(limit);

  return {
    events: rows.map((r) => ({
      tenantId: r.tenantId,
      twinId: r.twinId,
      seq: r.seq,
      type: r.eventType,
      event: r.eventJson,
      createdAt: r.createdAt.toISOString()
    })),
    nextSeq: rows.length ? rows[rows.length - 1]!.seq + 1 : fromSeq
  };
}

export async function twinAppendEvent(ctx: ToolContext, args: z.infer<typeof Tools.twin_appendEvent>) {
  const { tenantId, twinId, type, payload, causationId, correlationId } = args;
  const env = { tenantId, twinId, type: type as any, payload, causationId, correlationId, ts: nowIso() };
  const result = await appendEvent(ctx, env);
  if (!result.ok) throw new Error(result.error.message);
  return { seq: result.result.seq, event: result.result.event };
}

export async function counterpartAttach(ctx: ToolContext, args: z.infer<typeof Tools.counterpart_attach>) {
  const { tenantId, twinId, kind, resourceUri, role, syncPolicyId } = args;

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
    ts: nowIso()
  };

  const append = await appendEvent(ctx, env);
  if (!append.ok) throw new Error(append.error.message);

  return { counterpartId, eventSeq: append.result.seq };
}

export async function syncPolicyCreate(args: z.infer<typeof Tools.syncPolicy_create>) {
  const { tenantId, name, policy } = args;

  const id = newId("sp");
  await db.insert(syncPolicies).values({ id, tenantId, name, policyJson: policy, createdAt: new Date() });
  return { syncPolicyId: id };
}

async function appendEvent(
  ctx: ToolContext,
  env: { tenantId: string; twinId: string; type: any; payload: unknown; ts: string; causationId?: string | undefined; correlationId?: string | undefined }
) {
  const decision = runRules(env as any);
  if (decision.kind === "deny") {
    return { ok: false as const, error: { code: decision.code, message: decision.message } };
  }

  // Use the potentially-transformed event from the rules pipeline
  const event = decision.event;

  const inserted = await db.execute(sql`
    INSERT INTO twin_events (tenant_id, twin_id, seq, event_type, event_json, causation_id, correlation_id, created_at)
    SELECT
      ${event.tenantId},
      ${event.twinId},
      COALESCE(MAX(seq), 0) + 1,
      ${event.type},
      ${JSON.stringify(event)}::jsonb,
      ${event.causationId ?? null},
      ${event.correlationId ?? null},
      NOW()
    FROM twin_events
    WHERE tenant_id = ${event.tenantId} AND twin_id = ${event.twinId}
    RETURNING seq
  `);

  const nextSeq = Number((inserted.rows[0] as Record<string, unknown>).seq);

  const subject = subjectForTwin(event.tenantId, event.twinId);
  await ctx.js.publish(subject, ctx.sc.encode(JSON.stringify({ seq: nextSeq, event })));

  return { ok: true as const, result: { seq: nextSeq, event } };
}
