# ADR-005: NATS JetStream for Event Distribution

## Status
Accepted

## Context
Micro-agents are designed to be composable and independently schedulable. We need durable, replayable distribution of events to multiple consumers without using the DB as the queue.

## Decision
Use NATS JetStream for:
- durable distribution of twin events
- micro-agent triggers and fan-out
- consumer groups for scaling agent runners
- operational visibility into lag and redelivery

Postgres remains the canonical event store; JetStream is the distribution layer.

## Consequences
### Positive
- Clean separation of concerns: storage vs distribution.
- Scales micro-agent architecture naturally (microservices analogy).
- Supports backpressure, retries, durable consumers.

### Negative / Risks
- Adds an operational dependency early.

### Mitigations
- Containerized dev environment with NATS + Postgres.
- Phase 0 keeps JetStream integration minimal: publish on event append and consume for a single demo worker.
