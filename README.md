# OpenShell NightShift

**A small-scale runnable beta for private task delegation between operators and workers.**

OpenShell NightShift is a privacy-first task marketplace that lets a team:

- post a private or selective task
- collect sealed worker bids
- assign work under an execution policy
- receive a verifiable receipt
- settle or escalate through selective reveal

This repository is the **current public beta codebase**. It is deployable, self-hostable, and intentionally scoped to a controlled beta topology rather than a fully decentralized production network.

## Live product

- Web: [https://openshell-nightshift.vercel.app](https://openshell-nightshift.vercel.app)
- Backend health: [https://backend-preview-production.up.railway.app/health](https://backend-preview-production.up.railway.app/health)
- Demo video: [https://openshell-nightshift.vercel.app/demo-video](https://openshell-nightshift.vercel.app/demo-video)
- Presentation: [https://openshell-nightshift.vercel.app/presentation](https://openshell-nightshift.vercel.app/presentation)
- Source: [https://github.com/bidaiAI/openshell-nightshift](https://github.com/bidaiAI/openshell-nightshift)

## Product positioning

NightShift sits between agent tooling and full workflow platforms.

It focuses on a missing layer:

- confidential task routing
- controlled worker execution
- receipt-based delivery
- selective reveal during disputes

The current beta is a **small-scale runnable release**:

- runnable locally
- deployed publicly
- isolated by workspace
- suitable for limited testing and product review

## Why Midnight still matters

NightShift is designed around the kinds of privacy boundaries that fit Midnight well:

- public commitments
- sealed bids
- private task material
- selective reveal
- explicit public/private state separation

Each seeded task exposes a **Compact-style state projection**:

- `contract`
- `phase`
- `stateCommitment`
- `nextTransition`
- `publicInputs`
- `privateWitness`

That keeps the product grounded in a clear on-chain privacy model without pretending that the full decentralized network is already live.

## Contract address

- **Compact contract source:** `contracts/compact/src/NightShiftTaskEscrow.compact`
- **Deployment status:** not deployed to a public Midnight network in this beta
- **Current beta contract address:** `not-deployed-beta-preview`

This release demonstrates the product flow, Compact-style state projection, and the contract state machine simulation. The public beta does **not** yet claim a live on-chain settlement address.

## Current beta capabilities

- task creation
- sealed bid submission
- worker assignment
- receipt submission
- dispute and selective reveal flow
- isolated workspaces for concurrent beta sessions
- local-model-compatible worker adapters
- public web control plane + hosted API/worker runtime

## Current beta boundaries

NightShift is **not** claiming:

- final production auth
- final decentralized networking
- final on-chain Compact settlement
- adversarially hardened public infrastructure

The accurate framing is:

> a deployable small-scale beta product with clear privacy semantics and a controlled execution topology.

## Local run

Requirements:

- Node.js 20+
- pnpm 10+

Start the full beta stack:

```bash
pnpm install
pnpm beta
```

Then open the local URL, usually:

`http://127.0.0.1:3010`

Verification:

```bash
pnpm beta:check
pnpm build
pnpm typecheck
```

The local stack avoids your existing `127.0.0.1:8000` service.

## Deployment shape

- `apps/web` → Vercel
- `apps/api` + `packages/worker` → Railway
- `packages/common` → shared domain, commitments, transport, execution compatibility
- `contracts/compact` → Compact scaffold and state-machine simulation

## Key documents

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/BETA_WALKTHROUGH.md](./docs/BETA_WALKTHROUGH.md)
- [docs/BETA_POSITIONING.md](./docs/BETA_POSITIONING.md)
- [docs/PRODUCT_BRIEF.md](./docs/PRODUCT_BRIEF.md)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

## Repo structure

- `apps/web` — product UI
- `apps/api` — API and state transitions
- `packages/worker` — reference worker runtime
- `packages/common` — commitments, types, execution compatibility
- `contracts/compact` — Compact scaffold

## Commands

```bash
pnpm beta
pnpm beta:check
pnpm serve:beta
pnpm build
pnpm typecheck
pnpm verify
pnpm simulate:compact
```
