import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { connectJetStream } from "./nats/jetstream.js";
import { createMcpServer } from "./mcp/server.js";
import { pool } from "./db/client.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

async function runMigrations() {
  const distDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationDirs = [
    path.resolve(distDir, "db/migrations"),
    path.resolve(distDir, "../src/db/migrations")
  ];
  const migDir = migrationDirs.find((dir) => fs.existsSync(dir));
  if (!migDir) {
    throw new Error(`No migrations directory found. Checked: ${migrationDirs.join(", ")}`);
  }
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migDir, f), "utf8");
    await pool.query(sql);
  }
}

async function main() {
  await runMigrations();

  const { nc, js, sc } = await connectJetStream();
  const toolCtx = { js, sc };

  const transports = new Map<string, StreamableHTTPServerTransport>();

  const app = Fastify({ logger: true });

  app.get("/healthz", async () => ({ ok: true }));

  // --- MCP Streamable HTTP endpoint ---

  app.post("/mcp", async (req, reply) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)! as StreamableHTTPServerTransport;
      reply.hijack();
      await transport.handleRequest(req.raw, reply.raw, req.body);
      return;
    }

    // New session — create server + transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport);
      }
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
      }
    };

    const server = createMcpServer(toolCtx);
    await server.connect(transport as Parameters<typeof server.connect>[0]);

    reply.hijack();
    await transport.handleRequest(req.raw, reply.raw, req.body);
  });

  app.get("/mcp", async (req, reply) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      reply.code(400).send({ error: "Invalid or missing session ID" });
      return;
    }
    const transport = transports.get(sessionId)! as StreamableHTTPServerTransport;
    reply.hijack();
    await transport.handleRequest(req.raw, reply.raw);
  });

  app.delete("/mcp", async (req, reply) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      reply.code(400).send({ error: "Invalid or missing session ID" });
      return;
    }
    const transport = transports.get(sessionId)! as StreamableHTTPServerTransport;
    reply.hijack();
    await transport.handleRequest(req.raw, reply.raw);
  });

  await app.listen({ host: "0.0.0.0", port: Number(config.PORT) });
  app.log.info(`MCP Gateway listening on ${config.PORT}`);

  process.on("SIGINT", async () => {
    await app.close();
    await pool.end();
    await nc.drain();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
