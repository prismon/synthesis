# ADR-002: Swift for macOS (and future Apple clients)

## Status
Accepted

## Context
Primary client targets are macOS and Linux. Windows is not a goal. A native macOS application provides best UX and system integration.

## Decision
Use Swift + SwiftUI for the macOS client application(s).

## Consequences
### Positive
- Best-in-class macOS UX (sidebar/navigation, native performance, OS integration).
- Long-term maintainability and platform alignment.

### Negative / Risks
- Dual-language development across TS backend and Swift client.

### Mitigations
- Unify all client-server interaction through MCP services (see ADR-004).
- Keep client logic thin: render + orchestrate, with business logic in MCP-accessible services.

### Notes
- Linux client strategy is the web client (see ADR-001), not a native application.
