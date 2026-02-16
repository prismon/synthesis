import { db } from "../db/client.js";
import { counterparts, twins } from "../db/schema.js";
import { eq } from "drizzle-orm";

export async function readResource(uri: string) {
  // Phase 0 resource model:
  // - mcp://synthesis/twin/{twinId}
  // - mcp://synthesis/twin/{twinId}/counterparts

  const u = new URL(uri);
  if (u.protocol !== "mcp:") return { ok: false, error: { code: "BAD_URI", message: "Expected mcp:// URI" } };

  const parts = u.pathname.split("/").filter(Boolean);
  if (parts[0] !== "twin" || !parts[1]) return { ok: false, error: { code: "BAD_URI", message: "Unsupported resource path" } };

  const twinId = parts[1];
  const sub = parts[2];

  if (!sub) {
    const row = await db.select().from(twins).where(eq(twins.id, twinId)).limit(1);
    if (!row.length) return { ok: false, error: { code: "NOT_FOUND", message: "Twin not found" } };
    return { ok: true, result: { twin: { ...row[0], createdAt: row[0].createdAt.toISOString() } } };
  }

  if (sub === "counterparts") {
    const cps = await db.select().from(counterparts).where(eq(counterparts.twinId, twinId));
    return {
      ok: true,
      result: {
        counterparts: cps.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString()
        }))
      }
    };
  }

  return { ok: false, error: { code: "BAD_URI", message: "Unsupported resource" } };
}
