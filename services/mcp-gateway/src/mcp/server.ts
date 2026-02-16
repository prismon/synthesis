import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Tools } from "@synthesis/contracts";
import type { ToolContext } from "./tools.js";
import {
  twinList,
  twinCreate,
  twinGetState,
  twinGetEvents,
  twinAppendEvent,
  counterpartAttach,
  syncPolicyCreate
} from "./tools.js";
import { readTwinResource, readTwinCounterparts } from "./resources.js";

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

export function createMcpServer(ctx: ToolContext) {
  const server = new McpServer(
    { name: "synthesis", version: "0.0.1" },
    { capabilities: { tools: {}, resources: {} } }
  );

  // --- Tools ---

  server.tool(
    "twin.list",
    "List twins for a tenant, optionally filtered by workspace",
    Tools.twin_list.shape,
    async (args) => textResult(await twinList(args))
  );

  server.tool(
    "twin.create",
    "Create a new twin",
    Tools.twin_create.shape,
    async (args) => textResult(await twinCreate(ctx, args))
  );

  server.tool(
    "twin.getState",
    "Get a twin's current state",
    Tools.twin_getState.shape,
    async (args) => textResult(await twinGetState(args))
  );

  server.tool(
    "twin.getEvents",
    "Get events for a twin",
    Tools.twin_getEvents.shape,
    async (args) => textResult(await twinGetEvents(args))
  );

  server.tool(
    "twin.appendEvent",
    "Append an event to a twin",
    Tools.twin_appendEvent.shape,
    async (args) => textResult(await twinAppendEvent(ctx, args))
  );

  server.tool(
    "counterpart.attach",
    "Attach a counterpart to a twin",
    Tools.counterpart_attach.shape,
    async (args) => textResult(await counterpartAttach(ctx, args))
  );

  server.tool(
    "syncPolicy.create",
    "Create a sync policy",
    Tools.syncPolicy_create.shape,
    async (args) => textResult(await syncPolicyCreate(args))
  );

  // --- Resources ---

  server.resource(
    "twin",
    new ResourceTemplate("mcp://synthesis/tenant/{tenantId}/twin/{twinId}", {
      list: undefined
    }),
    async (uri, variables) => {
      const data = await readTwinResource(variables.tenantId as string, variables.twinId as string);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(data) }] };
    }
  );

  server.resource(
    "twin-counterparts",
    new ResourceTemplate("mcp://synthesis/tenant/{tenantId}/twin/{twinId}/counterparts", {
      list: undefined
    }),
    async (uri, variables) => {
      const data = await readTwinCounterparts(variables.tenantId as string, variables.twinId as string);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(data) }] };
    }
  );

  return server;
}
