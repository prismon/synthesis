# ADR-003: Postgres as the Canonical Event Store

## Status
Accepted

## Context
Twins are event-sourced and versioned. The system requires multi-tenant isolation, strong auditability, deterministic replay, and straightforward operational support.

## Decision
Use PostgreSQL as the canonical persistence layer for:
- Twin registry
- Counterpart registry + sync policy references
- Append-only twin event streams
- Derived snapshots/projections (optional in Phase 0)
- Basic authn/authz metadata (Phase 0 scope)

## Consequences
### Positive
- Strong transactional semantics and mature operations.
- Clear audit trail and support for append-only patterns.
- Easy multi-tenant enforcement (tenant_id everywhere; optional RLS later).

### Negative / Risks
- Heavy fan-out workloads can stress DB if used as a queue.

### Mitigations
- Use NATS JetStream for event distribution (ADR-005).
- Batch inserts and add snapshotting/projections as needed.
