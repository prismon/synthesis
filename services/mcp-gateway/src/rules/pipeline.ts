import type { TwinEventEnvelope } from "@synthesis/contracts";
import { ruleTenantBasic } from "./rules/rule_tenant_basic.js";
import { ruleEventSchema } from "./rules/rule_event_schema.js";
import { ruleNormalizeTimestamp } from "./rules/rule_normalize_timestamp.js";

export type RuleDecision =
  | { kind: "allow"; event: TwinEventEnvelope }
  | { kind: "deny"; code: string; message: string };

export type Rule = (event: TwinEventEnvelope) => RuleDecision;

const RULES: Rule[] = [
  ruleTenantBasic,
  ruleEventSchema,
  ruleNormalizeTimestamp
];

export function runRules(event: TwinEventEnvelope): RuleDecision {
  let current = event;
  for (const rule of RULES) {
    const d = rule(current);
    if (d.kind === "deny") return d;
    current = d.event;
  }
  return { kind: "allow", event: current };
}
