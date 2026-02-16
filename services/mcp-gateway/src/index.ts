import Fastify from "fastify";
import { config } from "./config.js";
import { connectJetStream } from "./nats/jetstream.js";
import { MCPToolCallRequest } from "./mcp/protocol.js";
import { callTool, listTools } from "./mcp/tools.js";
import { readResource } from "./mcp/resources.js";
import { pool } from "./db/client.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

async function runMigrations() {
  const distDir = path.dirname(fileURLToPath(import.meta.url));
  const migDir = path.resolve(distDir, "db/migrations");
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migDir, f), "utf8");
    await pool.query(sql);
  }
}

async function main() {
  await runMigrations();

  const { nc, js, sc } = await connectJetStream();

  const app = Fastify({ logger: true });

  app.get("/healthz", async () => ({ ok: true }));

  app.post("/mcp/tools/list", async () => {
    return { tools: listTools() };
  });

  app.post("/mcp/tools/call", async (req, reply) => {
    const parsed = MCPToolCallRequest.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: { code: "INVALID_REQUEST", message: parsed.error.message } };
    }
    const res = await callTool({ js, sc }, parsed.data.name, parsed.data.arguments);
    return res;
  });

  app.get("/mcp/resources/:encodedUri", async (req: any, reply) => {
    const encodedUri = req.params.encodedUri as string;
    const uri = decodeURIComponent(encodedUri);
    const res = await readResource(uri);
    if (!res.ok) reply.code(404);
    return res;
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
