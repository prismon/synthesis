# ADR-004: MCP as the Primary Application Protocol for Clients

## Status
Accepted

## Context
Synthesis must support multiple clients (macOS, web, future apps) while preserving a unified tool/resource model. The product also treats MCP as the universal protocol "everywhere" for integrations and internal operations.

## Decision
Use MCP services as the primary interaction model for:
- macOS client
- web client
- internal micro-agents
- counterpart connectors

Clients will primarily call MCP tools and read MCP resources exposed by Synthesis services.

## Consequences
### Positive
- Single protocol for apps, agents, and integrations.
- Uniform authorization, auditing, and policy gating across all operations.
- Simplifies client development: clients are tool/resource consumers.

### Negative / Risks
- MCP client libraries and patterns for Swift may require adapter work.
- Some UI-friendly queries may need dedicated MCP tools for efficient aggregation.

### Mitigations
- Provide a thin "MCP Gateway" service with stable endpoints and well-defined tool schemas.
- Define a small set of high-value read tools (e.g., `twin.getState`, `twin.list`, `twin.getEvents`) and avoid chatty N+1 patterns.
