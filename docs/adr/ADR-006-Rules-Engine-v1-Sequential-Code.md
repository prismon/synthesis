# ADR-006: Rules Engine v1 as Sequential Compiled Code

## Status
Accepted

## Context
We need deterministic enforcement of schemas, tenancy constraints, namespace ownership, and basic policy checks from day one. We explicitly do not want RETE or a declarative inference engine in v1.

## Decision
Implement Rules Engine v1 as an ordered pipeline of compiled TypeScript functions:
- `rules: Rule[]`
- executed sequentially on:
  - event append
  - proposal creation (Phase >0)
  - apply execution (Phase >0)
  - post-apply verification (Phase >0)

Each rule can:
- allow
- deny with reason
- transform (canonicalize) the event
- annotate with required-approval flags (future)

## Consequences
### Positive
- Predictable, debuggable, testable.
- Fast to build and evolve.
- Works well with LLM-generated code under strict tests.

### Negative / Risks
- Limited expressiveness vs a dedicated rule language.

### Mitigations
- Keep rule surface small and composable.
- Introduce a DSL later only if proven necessary.
