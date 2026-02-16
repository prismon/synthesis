import type { RuleDecision } from "../pipeline.js";
import { TwinEventEnvelope, validateTypedEvent } from "@synthesis/contracts";

export function ruleEventSchema(event: unknown): RuleDecision {
  const parsed = TwinEventEnvelope.safeParse(event);
  if (!parsed.success) {
    return { kind: "deny", code: "EVENT_INVALID", message: parsed.error.message };
  }
  const typed = validateTypedEvent(parsed.data);
  if (!typed.ok) {
    return { kind: "deny", code: "PAYLOAD_INVALID", message: typed.error.message };
  }
  return { kind: "allow", event: parsed.data };
}
