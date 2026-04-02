# OpenShell NightShift — Beta Walkthrough

Use this walkthrough when you want to explain the current product clearly in under two minutes.

## Goal

Show that NightShift is:

1. deployable
2. privacy-first
3. built around public/private state separation
4. ready for limited beta usage

## Recommended path

### 1. Open the homepage

Explain:

> NightShift is a privacy-first task marketplace for operators and workers.

Point at:

- private tasks
- sealed bids
- verified payout

### 2. Start a fresh isolated workspace

Go to `/create` and start a fresh isolated workspace.

Explain:

> Each beta workspace is isolated so multiple people can evaluate the product without mutating the same state.

### 3. Open the private task

Open:

- `/tasks/11111111-1111-4111-8111-111111111111`

Explain:

> This task shows the public commitment and phase while keeping the sensitive brief private.

### 4. Open the assignment-active task

Open:

- `/tasks/22222222-2222-4222-8222-222222222222`

Explain:

> This state shows how assignment and receipt flows expose only the public inputs needed for lifecycle progression.

### 5. Open the settled task

Open:

- `/tasks/33333333-3333-4333-8333-333333333333`

Explain:

> This state shows how NightShift represents finalized delivery with receipt commitments while preserving private artifacts behind the boundary.

## Key talking points

- isolated workspace model
- Compact-style state projection
- public/private split
- selective reveal
- deployable beta topology

## Do not claim

- final decentralized networking
- final production auth
- live on-chain Compact settlement
- production-grade adversarial hardening
