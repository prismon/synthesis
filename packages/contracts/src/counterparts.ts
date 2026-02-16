import { z } from "zod";
import { TenantId, TwinId } from "./events.js";

export const Counterpart = z.object({
  id: z.string().min(1),
  tenantId: TenantId,
  twinId: TwinId,
  kind: z.string().min(1),
  resourceUri: z.string().min(1),
  role: z.string().min(1),
  syncPolicyId: z.string().min(1).optional(),
  createdAt: z.string().datetime()
});

export type Counterpart = z.infer<typeof Counterpart>;
