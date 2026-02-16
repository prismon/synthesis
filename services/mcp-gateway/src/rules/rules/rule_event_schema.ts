import type { RuleDecision } from "../pipeline.js";
import type { TwinEventEnvelope } from "@synthesis/contracts";
import { TwinEventEnvelope as TwinEventEnvelopeSchema, validateTypedEvent } from "@synthesis/contracts";

export function ruleEventSchema(event: TwinEventEnvelope): RuleDecision {
  const parsed = TwinEventEnvelopeSchema.safeParse(event);
  if (!parsed.success) {
    return { kind: "deny", code: "EVENT_INVALID", message: parsed.error.message };
  }
  const typed = validateTypedEvent(parsed.data);
  if (!typed.ok) {
    return { kind: "deny", code: "PAYLOAD_INVALID", message: typed.error.message };
  }
  return { kind: "allow", event: parsed.data };
}
