#!/usr/bin/env node

import { MCPClient } from "./mcp-client.js";
import {
  productCreate,
  productList,
  featureCreate,
  featureList,
  featureSetStatus,
} from "./product.js";

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";
const TENANT_ID = process.env.TENANT_ID ?? "default";
const WORKSPACE_ID = process.env.WORKSPACE_ID ?? "default";

function usage(): never {
  console.error(`Usage: twin-cli <domain> <command> [options]

Product commands:
  product create --title <name> [--description <text>]
  product list

Feature commands:
  feature create  --product <twinId> --title <name> [--description <text>] [--status <status>]
  feature list    [--product <twinId>]
  feature set-status --twin <twinId> --status <status>

Environment:
  GATEWAY_URL    MCP gateway URL (default: http://localhost:8080)
  TENANT_ID      Tenant ID (default: default)
  WORKSPACE_ID   Workspace ID (default: default)`);
  process.exit(1);
}

function requireArg(args: string[], flag: string): string {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) {
    console.error(`Missing required argument: ${flag}`);
    process.exit(1);
  }
  return args[idx + 1]!;
}

function optionalArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1]!;
}

async function withClient<T>(fn: (client: MCPClient) => Promise<T>): Promise<T> {
  const client = new MCPClient(GATEWAY_URL);
  try {
    await client.initialize();
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 2) usage();

  const [domain, command] = args;

  switch (domain) {
    case "product": {
      switch (command) {
        case "create": {
          const title = requireArg(args, "--title");
          const description = optionalArg(args, "--description");
          await withClient(async (client) => {
            const id = await productCreate(client, TENANT_ID, WORKSPACE_ID, title, description);
            console.log(`Created product twin: ${id}`);
          });
          break;
        }
        case "list": {
          await withClient(async (client) => {
            const products = await productList(client, TENANT_ID);
            if (products.length === 0) {
              console.log("No products found.");
              return;
            }
            console.log(`Products (${products.length}):\n`);
            for (const p of products) {
              console.log(`  ${p.id}  ${p.title}  (${p.createdAt})`);
            }
          });
          break;
        }
        default:
          console.error(`Unknown product command: ${command}`);
          usage();
      }
      break;
    }

    case "feature": {
      switch (command) {
        case "create": {
          const productTwinId = requireArg(args, "--product");
          const title = requireArg(args, "--title");
          const description = optionalArg(args, "--description");
          const status = optionalArg(args, "--status") ?? "proposed";
          await withClient(async (client) => {
            const id = await featureCreate(client, TENANT_ID, WORKSPACE_ID, productTwinId, title, description, status);
            console.log(`Created feature twin: ${id} (status: ${status})`);
          });
          break;
        }
        case "list": {
          const productTwinId = optionalArg(args, "--product");
          await withClient(async (client) => {
            const features = await featureList(client, TENANT_ID, productTwinId);
            if (features.length === 0) {
              console.log("No features found.");
              return;
            }
            const label = productTwinId ? `Features for ${productTwinId}` : "All features";
            console.log(`${label} (${features.length}):\n`);
            for (const f of features) {
              console.log(`  ${f.id}  ${f.title}  (${f.createdAt})`);
            }
          });
          break;
        }
        case "set-status": {
          const twinId = requireArg(args, "--twin");
          const status = requireArg(args, "--status");
          await withClient(async (client) => {
            await featureSetStatus(client, TENANT_ID, twinId, status);
            console.log(`Set status of ${twinId} to: ${status}`);
          });
          break;
        }
        default:
          console.error(`Unknown feature command: ${command}`);
          usage();
      }
      break;
    }

    default:
      console.error(`Unknown domain: ${domain}`);
      usage();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
