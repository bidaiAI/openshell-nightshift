# OpenShell NightShift — Stack Decision

## Decision

Use a **TypeScript-first monorepo** with one Midnight contract package and three runtime surfaces:

- `contracts/compact` — Compact contracts
- `apps/web` — user-facing dApp (`@nightshift/web`)
- `apps/api` — encrypted metadata + receipt API
- `packages/worker` — local worker runtime
- `packages/common` — shared schemas, commitment helpers, receipt hashing

## Why this stack

### Midnight alignment
Midnight’s current official materials emphasize:

- **privacy-first application design** and **selective disclosure**
- Compact as Midnight’s **TypeScript-like** smart contract language
- small, polished, runnable applications rather than sprawling systems

That makes a TypeScript-first repo the smallest durable choice for the current beta MVP.

## Source constraints

The existing repos point in two different directions:

- `shell-protocol` contributes worker / polling / receipt concepts
- `mortal-platform` contributes product UX / dashboard / create-flow concepts

A TypeScript-first repo is the best place to merge them without inheriting either repo’s chain-specific baggage.

## Concrete choices

### 1. Web app
**Choice:** `apps/web` as the primary product surface, package name `@nightshift/web`

**Reasoning:**
- the web app is the clearest place to show what is public, private, and selectively disclosed
- the strongest reusable UX ideas come from `mortal-platform/web`

**Constraint from coordination:**
- package name must be `@nightshift/web`
- assume the repo will use a root `tsconfig.base.json`
- keep imports local within `apps/web` for now unless the shared path is clearly stable

### 2. API app
**Choice:** `apps/api` stores encrypted task metadata and receipt bundles

**Reasoning:**
- the contract should only hold compact public state and commitments
- task briefs, bid payloads, and receipt artifacts should remain off-chain
- this keeps the Midnight-facing story clean: public commitments, private data, selective reveal when needed

### 3. Worker runtime
**Choice:** `packages/worker` is a local daemon/runtime, not a network protocol

**Reasoning:**
- `shell-protocol` already proved the value of local execution + receipt generation
- a local worker is runnable and inspectable; a full P2P execution network is not
- for current beta scope, the worker only needs to:
  - fetch assignment
  - execute locally
  - generate receipt
  - submit result bundle

### 4. Shared package
**Choice:** `packages/common` holds only clearly stable shared code

**Allowed contents:**
- task / bid / assignment / receipt schemas
- commitment and hashing helpers
- state enum definitions

**Not allowed yet:**
- broad UI abstractions
- wallet adapters
- application-wide helper dumping ground

### 5. Contract layer
**Choice:** one MVP contract family in `contracts/compact`

**Contract surface for Phase 1:**
- create task commitment
- fund escrow
- submit sealed bid commitment
- accept one bidder
- submit delivery receipt commitment
- accept or dispute
- release payout

**Deferred:**
- full reputation contract
- generalized arbitration framework
- worker staking
- open marketplace indexing on-chain

## Rejected alternatives

### A. EVM-first repo with Midnight later
**Rejected**

This would repeat the exact mistake we are trying to avoid: building the wrong chain assumptions into the product and later retrofitting privacy.

### B. Python-first backend with TypeScript-only frontend
**Rejected for the initial sprint**

Python is viable, but it increases the number of build surfaces too early. The architecture already spans Compact + web + worker. The MVP should reduce language spread where possible.

### C. Shared package from day one for everything
**Rejected**

The repo is still converging. Premature shared abstractions would slow down the beta build and create unnecessary coupling.

## Import and workspace rules

### Root assumptions
- root workspace uses `pnpm`
- root TypeScript config is `tsconfig.base.json`
- packages extend from the root base config rather than inventing their own incompatible defaults

### Import rules
- `apps/web` should prefer **local imports first**
- only move code into `packages/common` once at least two surfaces need it
- `packages/common` must stay framework-agnostic

## Evidence this decision is working

The stack decision is correct if the team can implement, within one sprint:

1. a web flow for task creation and bid acceptance
2. a worker receipt generated from a local task run
3. an API-stored encrypted task bundle
4. a Compact state machine that only stores commitments and status

## Rollback path

If the TypeScript-first API proves too slow, the rollback is:

- keep `apps/web` and `packages/worker` in TypeScript
- freeze `packages/common` schemas
- swap `apps/api` implementation later without changing the public data model

That rollback preserves the architecture and does not invalidate the current beta plan.

## References

- [Midnight Docs](https://docs.midnight.network/) — official developer docs emphasize privacy-first apps, selective disclosure, and a developer path from scaffold to private transactions.
- [Developer Hub](https://midnight.network/developer-hub) — official Midnight builder hub emphasizing TypeScript accessibility and open-source repos.
- [Compact language blog](https://midnight.network/blog/compact-the-smart-contract-language-of-midnight) — official explanation of Compact as a TypeScript-like smart contract language.
- [Developer Hub](https://midnight.network/developer-hub) — official Midnight builder hub emphasizing TypeScript accessibility and open-source repos.
- [Rational privacy blog](https://midnight.network/blog/rational-privacy-for-real-world-data-protection) — official framing of Midnight’s rational privacy model.
