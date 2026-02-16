import { z } from "zod";
import { TenantId, WorkspaceId, TwinId } from "./events.js";

export const TwinType = z.string().min(1);

export const Twin = z.object({
  id: TwinId,
  tenantId: TenantId,
  workspaceId: WorkspaceId,
  type: TwinType,
  title: z.string().min(1),
  createdAt: z.string().datetime()
});

export type Twin = z.infer<typeof Twin>;
