import { z } from "zod";

export const TenantId = z.string().min(1);
export const WorkspaceId = z.string().min(1);
export const TwinId = z.string().min(1);

export const CorrelationId = z.string().min(1).optional();
export const CausationId = z.string().min(1).optional();

export const EventType = z.enum([
  "twin.created",
  "counterpart.attached",
  "note.added",
  "characteristic.set"
]);

export const NoteAddedPayload = z.object({
  note: z.string().min(1)
});

export const CharacteristicSetPayload = z.object({
  path: z.string().min(1),
  value: z.unknown(),
  valueType: z.enum(["string", "number", "boolean", "json"])
});

export const EventPayload = z.discriminatedUnion("type", [
  z.object({ type: z.literal("twin.created"), payload: z.object({}) }),
  z.object({
    type: z.literal("counterpart.attached"),
    payload: z.object({
      counterpartId: z.string().min(1),
      kind: z.string().min(1),
      resourceUri: z.string().min(1),
      role: z.string().min(1),
      syncPolicyId: z.string().min(1).optional()
    })
  }),
  z.object({ type: z.literal("note.added"), payload: NoteAddedPayload }),
  z.object({ type: z.literal("characteristic.set"), payload: CharacteristicSetPayload })
]);

export const TwinEventEnvelope = z.object({
  tenantId: TenantId,
  twinId: TwinId,
  type: EventType,
  payload: z.unknown(),
  ts: z.string().datetime(),
  causationId: CausationId,
  correlationId: CorrelationId
});

export type TwinEventEnvelope = z.infer<typeof TwinEventEnvelope>;

export function validateTypedEvent(envelope: TwinEventEnvelope) {
  const typed = EventPayload.safeParse({ type: envelope.type, payload: envelope.payload });
  if (!typed.success) {
    return { ok: false as const, error: typed.error };
  }
  return { ok: true as const };
}
