/**
 * Lightweight MCP client that speaks JSON-RPC 2.0 over Streamable HTTP
 * to the mcp-gateway. Follows the same protocol the macOS client uses.
 */

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
};

export class MCPClient {
  private mcpUrl: string;
  private sessionId: string | undefined;
  private nextId = 0;

  constructor(baseUrl: string) {
    this.mcpUrl = baseUrl.replace(/\/$/, "") + "/mcp";
  }

  private async send(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    const body: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: ++this.nextId,
      method,
      params,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    const res = await fetch(this.mcpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const sid = res.headers.get("Mcp-Session-Id");
    if (sid) this.sessionId = sid;

    if (!res.ok) {
      throw new Error(`MCP HTTP ${res.status}: ${await res.text()}`);
    }

    return (await res.json()) as JsonRpcResponse;
  }

  private async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    const body: Record<string, unknown> = { jsonrpc: "2.0", method };
    if (params) body.params = params;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    await fetch(this.mcpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  async initialize(): Promise<void> {
    const resp = await this.send("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "twin-cli", version: "0.0.1" },
    });
    if (resp.error) {
      throw new Error(`MCP initialize failed: ${resp.error.message}`);
    }
    await this.sendNotification("notifications/initialized");
  }

  async callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    const resp = await this.send("tools/call", { name, arguments: args });
    if (resp.error) {
      throw new Error(`MCP tool ${name} failed: ${resp.error.message}`);
    }
    // MCP returns { content: [{ type: "text", text: "..." }] }
    const result = resp.result as { content: Array<{ type: string; text: string }> };
    const text = result.content[0]?.text;
    if (!text) throw new Error(`MCP tool ${name} returned no content`);
    return JSON.parse(text) as T;
  }

  async close(): Promise<void> {
    if (!this.sessionId) return;
    const headers: Record<string, string> = {};
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }
    try {
      await fetch(this.mcpUrl, { method: "DELETE", headers });
    } catch {
      // best-effort cleanup
    }
  }
}
