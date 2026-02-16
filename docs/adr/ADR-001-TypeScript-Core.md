# ADR-001: TypeScript as the Core Implementation Language

## Status
Accepted

## Context
Synthesis requires rapid iteration on an event-sourced twin core, micro-agent orchestration, MCP-first integration, and a web-notebook experience. Most development will be produced via LLM coding agents, which benefits from a high-leverage language and strong contract tooling.

## Decision
Use TypeScript (Node.js) as the primary implementation language for all backend services and the web UI.

## Consequences
### Positive
- Fast iteration velocity and strong ecosystem for collaboration/editors (Yjs, TipTap/Lexical).
- Excellent fit for MCP tool/resource modeling and schema-driven development.
- LLM coding agents produce reliable TS patterns quickly, especially with Zod + strict linting.

### Negative / Risks
- Runtime type safety requires discipline.
- Performance tuning may be required for high ingest or heavy projections.

### Mitigations
- Enforce contract-driven boundaries (Zod schemas) for all events and tool payloads.
- Strict TS config, exhaustive checks, no implicit any, and CI gating.
- Use NATS JetStream + batching to avoid DB thrash; introduce optimized “islands” only if proven necessary.
