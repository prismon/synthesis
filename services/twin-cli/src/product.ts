import type { MCPClient } from "./mcp-client.js";

type TwinListResult = {
  twins: Array<{ id: string; type: string; title: string; createdAt: string }>;
};

type TwinCreateResult = { twinId: string; eventSeq: number };
type CounterpartAttachResult = { counterpartId: string; eventSeq: number };

type TwinEventsResult = {
  events: Array<{
    seq: number;
    type: string;
    event: Record<string, unknown>;
    createdAt: string;
  }>;
};

// --- Product ---

export async function productCreate(
  client: MCPClient,
  tenantId: string,
  workspaceId: string,
  title: string,
  description?: string
): Promise<string> {
  const result = await client.callTool<TwinCreateResult>("twin.create", {
    tenantId,
    workspaceId,
    type: "product",
    title,
  });

  if (description) {
    await client.callTool("twin.appendEvent", {
      tenantId,
      twinId: result.twinId,
      type: "characteristic.set",
      payload: { path: "product.description", value: description, valueType: "string" },
    });
  }

  return result.twinId;
}

export async function productList(
  client: MCPClient,
  tenantId: string
): Promise<TwinListResult["twins"]> {
  const result = await client.callTool<TwinListResult>("twin.list", { tenantId });
  return result.twins.filter((t) => t.type === "product");
}

// --- Feature ---

export async function featureCreate(
  client: MCPClient,
  tenantId: string,
  workspaceId: string,
  productTwinId: string,
  title: string,
  description?: string,
  status: string = "proposed"
): Promise<string> {
  const result = await client.callTool<TwinCreateResult>("twin.create", {
    tenantId,
    workspaceId,
    type: "feature",
    title,
  });

  const featureId = result.twinId;

  // Link feature to product via counterpart
  await client.callTool<CounterpartAttachResult>("counterpart.attach", {
    tenantId,
    twinId: featureId,
    kind: "twin",
    resourceUri: `mcp://synthesis/tenant/${tenantId}/twin/${productTwinId}`,
    role: "product",
  });

  // Set initial status
  await client.callTool("twin.appendEvent", {
    tenantId,
    twinId: featureId,
    type: "characteristic.set",
    payload: { path: "feature.status", value: status, valueType: "string" },
  });

  if (description) {
    await client.callTool("twin.appendEvent", {
      tenantId,
      twinId: featureId,
      type: "characteristic.set",
      payload: { path: "feature.description", value: description, valueType: "string" },
    });
  }

  return featureId;
}

export async function featureList(
  client: MCPClient,
  tenantId: string,
  productTwinId?: string
): Promise<Array<{ id: string; title: string; createdAt: string; productTwinId?: string }>> {
  const result = await client.callTool<TwinListResult>("twin.list", { tenantId });
  const features = result.twins.filter((t) => t.type === "feature");

  if (!productTwinId) {
    return features;
  }

  // Filter to features linked to the given product by reading their events
  const matched: Array<{ id: string; title: string; createdAt: string; productTwinId?: string }> = [];
  const productUri = `mcp://synthesis/tenant/${tenantId}/twin/${productTwinId}`;

  for (const f of features) {
    const events = await client.callTool<TwinEventsResult>("twin.getEvents", {
      tenantId,
      twinId: f.id,
    });

    for (const ev of events.events) {
      if (ev.type === "counterpart.attached") {
        const payload = (ev.event as Record<string, unknown>).payload as
          | Record<string, unknown>
          | undefined;
        if (payload && payload.kind === "twin" && payload.resourceUri === productUri) {
          matched.push({ ...f, productTwinId });
          break;
        }
      }
    }
  }

  return matched;
}

export async function featureSetStatus(
  client: MCPClient,
  tenantId: string,
  featureTwinId: string,
  status: string
): Promise<void> {
  await client.callTool("twin.appendEvent", {
    tenantId,
    twinId: featureTwinId,
    type: "characteristic.set",
    payload: { path: "feature.status", value: status, valueType: "string" },
  });
}
