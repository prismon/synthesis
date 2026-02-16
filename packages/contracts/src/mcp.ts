import { z } from "zod";
import { TenantId, WorkspaceId, TwinId } from "./events.js";

export const MCPToolName = z.enum([
  "twin.list",
  "twin.create",
  "twin.getState",
  "twin.getEvents",
  "twin.appendEvent",
  "counterpart.attach",
  "syncPolicy.create"
]);

export const MCPToolCall = z.object({
  name: MCPToolName,
  arguments: z.record(z.unknown()).default({})
});

export type MCPToolCall = z.infer<typeof MCPToolCall>;

export const Tools = {
  twin_list: z.object({ tenantId: TenantId, workspaceId: WorkspaceId.optional() }),
  twin_create: z.object({ tenantId: TenantId, workspaceId: WorkspaceId, type: z.string().min(1), title: z.string().min(1) }),
  twin_getState: z.object({ tenantId: TenantId, twinId: TwinId }),
  twin_getEvents: z.object({ tenantId: TenantId, twinId: TwinId, fromSeq: z.number().int().min(1).optional(), limit: z.number().int().min(1).max(500).optional() }),
  twin_appendEvent: z.object({ tenantId: TenantId, twinId: TwinId, type: z.string().min(1), payload: z.unknown(), causationId: z.string().optional(), correlationId: z.string().optional() }),
  counterpart_attach: z.object({ tenantId: TenantId, twinId: TwinId, kind: z.string().min(1), resourceUri: z.string().min(1), role: z.string().min(1), syncPolicyId: z.string().optional() }),
  syncPolicy_create: z.object({ tenantId: TenantId, name: z.string().min(1), policy: z.record(z.unknown()) })
};
