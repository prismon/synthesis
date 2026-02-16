import { db } from "../db/client.js";
import { counterparts, twins } from "../db/schema.js";
import { and, eq } from "drizzle-orm";

export async function readTwinResource(tenantId: string, twinId: string) {
  const row = await db
    .select()
    .from(twins)
    .where(and(eq(twins.tenantId, tenantId), eq(twins.id, twinId)))
    .limit(1);
  if (!row.length) throw new Error("Twin not found");
  return { twin: { ...row[0]!, createdAt: row[0]!.createdAt.toISOString() } };
}

export async function readTwinCounterparts(tenantId: string, twinId: string) {
  const cps = await db
    .select()
    .from(counterparts)
    .where(and(eq(counterparts.tenantId, tenantId), eq(counterparts.twinId, twinId)));
  return {
    counterparts: cps.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString()
    }))
  };
}
