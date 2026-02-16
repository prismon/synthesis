import type { RuleDecision } from "../pipeline.js";
import type { TwinEventEnvelope } from "@synthesis/contracts";

/**
 * Phase 0 placeholder:
 * - In real deployment, tenant authorization comes from authn/authz layer.
 * - Here we just ensure tenantId exists (non-empty).
 */
export function ruleTenantBasic(event: TwinEventEnvelope): RuleDecision {
  if (!event.tenantId || event.tenantId.trim().length === 0) {
    return { kind: "deny", code: "TENANT_MISSING", message: "tenantId is required" };
  }
  return { kind: "allow", event };
}
