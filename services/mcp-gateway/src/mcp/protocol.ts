import { z } from "zod";

export const MCPToolListResponse = z.object({
  tools: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      inputSchema: z.record(z.unknown())
    })
  )
});

export const MCPToolCallRequest = z.object({
  name: z.string().min(1),
  arguments: z.record(z.unknown()).default({})
});

export const MCPToolCallResponse = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional()
});
