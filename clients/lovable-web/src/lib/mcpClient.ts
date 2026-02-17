type JsonObject = Record<string, unknown>;

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export class MCPClient {
  private readonly endpoint: string;
  private sessionId?: string;
  private requestId = 0;
  private isInitialized = false;

  constructor(baseUrl: string) {
    this.endpoint = new URL("/mcp", baseUrl).toString();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.send("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: {
        name: "Synthesis Lovable Web",
        version: "0.0.1"
      }
    });

    await this.send("notifications/initialized", undefined, true);
    this.isInitialized = true;
  }

  async callTool<T>(name: string, args: JsonObject): Promise<T> {
    const result = (await this.send("tools/call", {
      name,
      arguments: args
    })) as { content?: Array<{ type?: string; text?: string }> } | undefined;

    const text = result?.content?.find((item) => item.type === "text")?.text;
    if (!text) {
      throw new Error(`Tool ${name} returned no JSON text payload`);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Tool ${name} returned invalid JSON text payload`);
    }
  }

  private nextRequestId(): number {
    this.requestId += 1;
    return this.requestId;
  }

  private parseSSEPayload(raw: string): string {
    for (const line of raw.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trimStart();
      if (payload.length > 0) return payload;
    }
    throw new Error("SSE response did not include a data payload");
  }

  private async send(method: string, params?: JsonObject, notification = false): Promise<unknown> {
    const body: JsonObject = {
      jsonrpc: "2.0",
      method
    };

    if (!notification) {
      body.id = this.nextRequestId();
    }
    if (params) {
      body.params = params;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream"
    };
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const nextSessionId = response.headers.get("Mcp-Session-Id");
    if (nextSessionId) {
      this.sessionId = nextSessionId;
    }

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(responseText || `HTTP ${response.status}`);
    }

    if (notification) {
      return undefined;
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    const jsonText = contentType.includes("text/event-stream")
      ? this.parseSSEPayload(responseText)
      : responseText;

    let rpc: JsonRpcResponse;
    try {
      rpc = JSON.parse(jsonText) as JsonRpcResponse;
    } catch {
      throw new Error("MCP response is not valid JSON");
    }

    if (rpc.error) {
      throw new Error(rpc.error.message);
    }

    return rpc.result;
  }
}
