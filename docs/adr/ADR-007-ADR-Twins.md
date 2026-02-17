# ADR-007: Product and Feature Twins

## Status
Proposed

## Context
Synthesis is itself a product. The system manages digital twins, but we have no twin representing the product being built, nor its features. Without this, there is no structured way to:

- Track which features exist and their lifecycle (proposed, in-progress, shipped, deprecated).
- Link artifacts (ADRs, code, tests) back to the feature they serve.
- Let agents reason about what the product does and what is being worked on.

The natural first-class entities are **Product** (the thing being built) and **Feature** (a capability the product provides). Everything else — ADRs, specs, issues — eventually relates back to a feature of a product.

## Decision

### Product twin

A twin of type `product` represents a product. For Synthesis itself:

| Field       | Value                            |
|-------------|----------------------------------|
| type        | `product`                        |
| title       | `Synthesis`                      |

Characteristics: `product.description`, `product.repo` (git remote URL), etc.

### Feature twin

A twin of type `feature` represents a capability of a product. A feature is linked to its product via a counterpart:

| Field       | Value                            |
|-------------|----------------------------------|
| type        | `feature`                        |
| title       | e.g. `Event-sourced twin store`  |
| counterpart | kind=`twin`, resourceUri=`mcp://synthesis/tenant/{tenantId}/twin/{productTwinId}`, role=`product` |

Characteristics: `feature.status` (`proposed` | `in-progress` | `shipped` | `deprecated`), `feature.description`.

### CLI surface (`twin-cli`)

```
twin-cli product create --title "Synthesis"                    # create product twin
twin-cli product list                                          # list products

twin-cli feature create --product <twinId> --title "..."       # create feature for product
twin-cli feature list   --product <twinId>                     # list features for a product
twin-cli feature set-status --twin <twinId> --status shipped   # update feature status
```

The CLI communicates with mcp-gateway over MCP Streamable HTTP. It does not access the database directly.

### Relationship model

Products and features are both twins. The parent relationship is expressed through a counterpart on the feature twin pointing to the product twin (kind=`twin`, role=`product`). This reuses the existing counterpart mechanism for internal cross-references rather than inventing a new relationship table.

### Future extensions

- **ADR twins** (type `adr`) linked to the product or to a specific feature via counterpart.
- **Spec twins** (type `spec`) attached to a feature.
- Agents that watch for `characteristic.set` on `feature.status` to trigger downstream workflows.

## Consequences

### Positive
- The product and its features are observable, queryable, event-sourced entities from day one.
- Counterpart-based linking is uniform — the same mechanism links to files, APIs, and other twins.
- The CLI establishes a pattern for all future twin-creation workflows.

### Negative / Risks
- The twin-to-twin counterpart convention (kind=`twin`) is informal — nothing in the schema enforces referential integrity between twins.

### Mitigations
- A rules-pipeline rule can validate that counterparts of kind=`twin` reference real twin IDs.
- Keep the feature status enum small and documented; enforce via rules in Phase >0.
