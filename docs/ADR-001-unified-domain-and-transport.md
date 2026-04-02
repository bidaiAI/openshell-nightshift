# ADR-001 — Unified domain model and provider-agnostic worker transport

## Status
Accepted on 2026-03-26.

## Context
OpenShell NightShift started with multiple competing models:
- API persistence entities
- worker transport entities
- web display entities
- ad-hoc compatibility mappings

That made it hard to evolve the project toward:
1. a Midnight-oriented task marketplace,
2. a future libp2p transport,
3. multi-provider LLM execution on worker nodes,
4. repeated security review and interface verification.

## Decision
We standardize on a **single canonical domain layer in** `packages/common/src/domain.ts`, plus explicit adjacent layers:
- `packages/common/src/execution.ts`
- `packages/common/src/transport.ts`
- `packages/common/src/presentation.ts`

### Domain invariants
Canonical lifecycle states:
- task: `open | assigned | submitted | settled | disputed | cancelled`
- bid: `sealed | selected | rejected | withdrawn`
- assignment: `queued | accepted | in_progress | submitted | cancelled | completed`
- receipt: `generated | submitted | verified | rejected`

### Boundary rules
- API storage returns canonical domain records.
- worker polling uses canonical assignment records, not a renamed shadow shape.
- web is allowed to keep a display adapter, but it should not invent new source-of-truth lifecycle states.
- any UI-only labels, such as displaying `submitted` as `Delivered`, belong in presentation mapping only.

## Options considered
### Option A — Keep separate web/api/worker models with more compat shims
Pros:
- minimal short-term edits

Cons:
- preserves model drift
- makes contract bugs harder to detect
- increases security review surface
- makes libp2p migration noisier later

### Option B — Canonical domain + explicit transport/presentation layers
Pros:
- smallest durable design
- easier to reason about invariants
- cleaner path from HTTP poller to libp2p
- clean place to insert model-provider capability matching

Cons:
- requires coordinated cross-layer refactor
- some UI display helpers still need adapters

## Decision outcome
Choose **Option B**.

## Consequences
### Positive
- API, worker, and contract discussions now use the same nouns.
- provider-agnostic LLM routing can hang off `execution` requirements without changing marketplace entities.
- security checks become easier because trust boundaries are named.

### Negative
- some older helper types still exist for draft splitting and public/private commitments.
- web still has a thin display adapter that should continue shrinking over time.

## Evidence of rollout
- `packages/common/src/domain.ts`
- `packages/common/src/execution.ts`
- `packages/common/src/transport.ts`
- `apps/api/src/domain.ts`
- `apps/api/src/store.ts`
- `packages/worker/src/runtime.ts`

## Rollback path
If this abstraction proves too heavy for the current beta, keep the canonical domain intact and only simplify the presentation adapter. Do **not** reintroduce a second worker-specific assignment model.
