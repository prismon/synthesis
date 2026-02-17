import fs from "node:fs";
import path from "node:path";
import type { MCPClient } from "./mcp-client.js";

export type ParsedADR = {
  number: number;
  title: string;
  status: string;
  filename: string;
  filePath: string;
};

/**
 * Parse an ADR markdown file to extract number, title, and status.
 *
 * Expected format:
 *   # ADR-NNN: Title Here
 *   ## Status
 *   Accepted
 */
export function parseADRFile(filePath: string): ParsedADR | null {
  const content = fs.readFileSync(filePath, "utf8");
  const filename = path.basename(filePath);

  // Extract ADR number from filename: ADR-001-Something.md
  const numMatch = filename.match(/^ADR-(\d+)/i);
  if (!numMatch) return null;
  const adrNumber = parseInt(numMatch[1]!, 10);

  // Extract title from first H1
  const titleMatch = content.match(/^#\s+ADR-\d+:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1]!.trim() : filename.replace(/\.md$/, "");

  // Extract status from the line after "## Status"
  const statusMatch = content.match(/^##\s+Status\s*\n+(.+)$/m);
  const status = statusMatch ? statusMatch[1]!.trim().toLowerCase() : "unknown";

  return {
    number: adrNumber,
    title: `ADR-${String(adrNumber).padStart(3, "0")}: ${title}`,
    status,
    filename,
    filePath,
  };
}

/**
 * Scan the ADR directory and return all parsed ADRs.
 */
export function scanADRDirectory(adrDir: string): ParsedADR[] {
  if (!fs.existsSync(adrDir)) {
    throw new Error(`ADR directory not found: ${adrDir}`);
  }
  const files = fs.readdirSync(adrDir).filter((f) => /^ADR-\d+.*\.md$/i.test(f)).sort();
  const results: ParsedADR[] = [];
  for (const f of files) {
    const parsed = parseADRFile(path.join(adrDir, f));
    if (parsed) results.push(parsed);
  }
  return results;
}

function resourceUriForADR(filename: string): string {
  return `file://docs/adr/${filename}`;
}

type TwinListResult = {
  twins: Array<{ id: string; type: string; title: string; createdAt: string }>;
};

type TwinCreateResult = { twinId: string; eventSeq: number };
type CounterpartAttachResult = { counterpartId: string; eventSeq: number };

/**
 * Sync a single ADR: create twin + counterpart + status characteristic if it doesn't exist.
 * Returns true if a new twin was created, false if it already existed.
 */
export async function syncOneADR(
  client: MCPClient,
  tenantId: string,
  workspaceId: string,
  adr: ParsedADR,
  existingTwins: Map<string, string> // resourceUri -> twinId
): Promise<{ created: boolean; twinId: string }> {
  const uri = resourceUriForADR(adr.filename);

  // Check if a twin already exists for this ADR (matched by counterpart URI)
  const existingTwinId = existingTwins.get(uri);
  if (existingTwinId) {
    return { created: false, twinId: existingTwinId };
  }

  // Create the twin
  const createResult = await client.callTool<TwinCreateResult>("twin.create", {
    tenantId,
    workspaceId,
    type: "adr",
    title: adr.title,
  });

  const twinId = createResult.twinId;

  // Attach counterpart pointing to the file
  await client.callTool<CounterpartAttachResult>("counterpart.attach", {
    tenantId,
    twinId,
    kind: "file",
    resourceUri: uri,
    role: "source",
  });

  // Set adr.number characteristic
  await client.callTool("twin.appendEvent", {
    tenantId,
    twinId,
    type: "characteristic.set",
    payload: { path: "adr.number", value: adr.number, valueType: "number" },
  });

  // Set adr.status characteristic
  await client.callTool("twin.appendEvent", {
    tenantId,
    twinId,
    type: "characteristic.set",
    payload: { path: "adr.status", value: adr.status, valueType: "string" },
  });

  return { created: true, twinId };
}

/**
 * Build a lookup of counterpart resourceUri -> twinId for all existing 'adr' twins.
 * Reads counterpart.attached events from each adr twin's event stream.
 */
export async function buildExistingADRIndexFromEvents(
  client: MCPClient,
  tenantId: string
): Promise<Map<string, string>> {
  const index = new Map<string, string>();

  const listResult = await client.callTool<TwinListResult>("twin.list", { tenantId });
  const adrTwins = listResult.twins.filter((t) => t.type === "adr");

  for (const twin of adrTwins) {
    const eventsResult = await client.callTool<{
      events: Array<{ type: string; event: { payload?: { resourceUri?: string; kind?: string } } }>;
    }>("twin.getEvents", { tenantId, twinId: twin.id });

    for (const ev of eventsResult.events) {
      if (ev.type === "counterpart.attached" && ev.event.payload?.kind === "file" && ev.event.payload.resourceUri) {
        index.set(ev.event.payload.resourceUri, twin.id);
      }
    }
  }

  return index;
}
