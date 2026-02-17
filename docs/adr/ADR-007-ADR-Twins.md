# ADR-007: ADR Twins — Representing Architecture Decisions as Digital Twins

## Status
Proposed

## Context
Architecture Decision Records (ADRs) in `docs/adr/` are static markdown files. They guide the system's design but have no runtime presence — we cannot attach events, track lifecycle changes, or associate behavior with individual decisions. As the project grows, we need ADRs to be first-class entities so that:

- Changes to an ADR (superseded, amended, deprecated) produce observable events.
- Rules can reference which ADR governs a particular behavior.
- Agents can reason about architectural constraints by reading twin state.
- Counterparts link each twin back to the canonical markdown file.

## Decision
Each ADR file gets a **digital twin** of type `adr`. The twin is created via a CLI tool (`twin-cli`) that:

1. **Scans** `docs/adr/` for `ADR-*.md` files.
2. **Parses** front-matter / heading to extract the ADR number, title, and status.
3. **Creates a twin** (type: `adr`, title: e.g. `ADR-001: TypeScript as Core Implementation Language`).
4. **Attaches a counterpart** (kind: `file`, resourceUri: `file://docs/adr/ADR-001-TypeScript-Core.md`, role: `source`).
5. **Appends a `characteristic.set` event** recording the parsed status (`accepted`, `proposed`, `superseded`, etc.) at path `adr.status`.
6. Is **idempotent** — re-running skips ADRs that already have a twin (matched by counterpart resourceUri).

### CLI surface

```
twin-cli adr sync                           # scan + create/update all ADR twins
twin-cli adr sync --file ADR-007-...md      # sync a single ADR
twin-cli adr list                           # list ADR twins and their status
```

The CLI communicates with mcp-gateway over MCP Streamable HTTP, using the same tools the macOS client uses. It does not access the database directly.

### Twin structure for an ADR

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| type          | `adr`                                              |
| title         | `ADR-001: TypeScript as Core Implementation Language` |
| counterpart   | kind=`file`, resourceUri=`file://docs/adr/ADR-001-TypeScript-Core.md`, role=`source` |
| characteristics | `adr.status` = `accepted`, `adr.number` = `1`   |

### Future behavior hooks (Phase >0)

- A rule that enforces "twins of type `adr` require `adr.status` to be a known enum value."
- An agent that watches for `characteristic.set` events on `adr.status` and notifies when an ADR is superseded.
- Cross-referencing: when a rule references an ADR, the rule's twin can have a counterpart pointing to the ADR twin.

## Consequences

### Positive
- ADRs become observable, queryable, event-sourced entities.
- The CLI tool doubles as a template for future twin-creation workflows.
- Counterpart linkage keeps the twin grounded to the real artifact.

### Negative / Risks
- Requires running `twin-cli adr sync` after adding/changing ADRs (manual step).
- Parsing ADR markdown is fragile if the format drifts.

### Mitigations
- Keep the ADR markdown format simple and documented.
- The sync command is idempotent and safe to run from CI or hooks.
- Validate parsed data through the existing rules pipeline.
