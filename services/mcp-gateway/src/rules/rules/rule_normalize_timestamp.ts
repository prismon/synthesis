import type { RuleDecision } from "../pipeline.js";
import type { TwinEventEnvelope } from "@synthesis/contracts";

/**
 * Transform rule: normalizes `ts` to UTC ISO-8601 (always ending in 'Z').
 * Demonstrates the transform capability described in ADR-006.
 */
export function ruleNormalizeTimestamp(event: TwinEventEnvelope): RuleDecision {
  const d = new Date(event.ts);
  if (isNaN(d.getTime())) {
    return { kind: "deny", code: "TS_INVALID", message: `Cannot parse ts: ${event.ts}` };
  }
  return { kind: "allow", event: { ...event, ts: d.toISOString() } };
}
