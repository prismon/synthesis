#!/usr/bin/env node

import path from "node:path";
import { MCPClient } from "./mcp-client.js";
import { scanADRDirectory, syncOneADR, buildExistingADRIndexFromEvents } from "./adr.js";

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";
const TENANT_ID = process.env.TENANT_ID ?? "default";
const WORKSPACE_ID = process.env.WORKSPACE_ID ?? "default";

function usage(): never {
  console.error(`Usage: twin-cli <command>

Commands:
  adr sync [--file <filename>]   Sync ADR files to twins
  adr list                       List existing ADR twins

Environment:
  GATEWAY_URL    MCP gateway URL (default: http://localhost:8080)
  TENANT_ID      Tenant ID (default: default)
  WORKSPACE_ID   Workspace ID (default: default)
  ADR_DIR        ADR directory (default: docs/adr relative to cwd)`);
  process.exit(1);
}

function resolveADRDir(): string {
  if (process.env.ADR_DIR) return path.resolve(process.env.ADR_DIR);
  return path.resolve(process.cwd(), "docs/adr");
}

async function cmdADRSync(filterFile?: string): Promise<void> {
  const adrDir = resolveADRDir();
  console.log(`Scanning ${adrDir} for ADRs...`);

  let adrs = scanADRDirectory(adrDir);
  if (filterFile) {
    adrs = adrs.filter((a) => a.filename === filterFile);
    if (adrs.length === 0) {
      console.error(`No ADR found matching filename: ${filterFile}`);
      process.exit(1);
    }
  }

  console.log(`Found ${adrs.length} ADR(s).`);

  const client = new MCPClient(GATEWAY_URL);
  try {
    await client.initialize();

    console.log("Building index of existing ADR twins...");
    const existing = await buildExistingADRIndexFromEvents(client, TENANT_ID);
    console.log(`Found ${existing.size} existing ADR twin(s).`);

    let created = 0;
    let skipped = 0;
    for (const adr of adrs) {
      const result = await syncOneADR(client, TENANT_ID, WORKSPACE_ID, adr, existing);
      if (result.created) {
        console.log(`  + Created twin for ${adr.title} (${result.twinId})`);
        created++;
      } else {
        console.log(`  = Skipped ${adr.title} (already exists: ${result.twinId})`);
        skipped++;
      }
    }

    console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  } finally {
    await client.close();
  }
}

async function cmdADRList(): Promise<void> {
  const client = new MCPClient(GATEWAY_URL);
  try {
    await client.initialize();

    const result = await client.callTool<{
      twins: Array<{ id: string; type: string; title: string; createdAt: string }>;
    }>("twin.list", { tenantId: TENANT_ID });

    const adrTwins = result.twins.filter((t) => t.type === "adr");

    if (adrTwins.length === 0) {
      console.log("No ADR twins found.");
      return;
    }

    console.log(`ADR Twins (${adrTwins.length}):\n`);
    for (const t of adrTwins) {
      console.log(`  ${t.id}  ${t.title}  (${t.createdAt})`);
    }
  } finally {
    await client.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) usage();

  const [domain, command] = args;

  if (domain !== "adr") {
    console.error(`Unknown domain: ${domain}`);
    usage();
  }

  switch (command) {
    case "sync": {
      let filterFile: string | undefined;
      const fileIdx = args.indexOf("--file");
      if (fileIdx !== -1) {
        filterFile = args[fileIdx + 1];
        if (!filterFile) {
          console.error("--file requires a filename argument");
          process.exit(1);
        }
      }
      await cmdADRSync(filterFile);
      break;
    }
    case "list":
      await cmdADRList();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      usage();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
