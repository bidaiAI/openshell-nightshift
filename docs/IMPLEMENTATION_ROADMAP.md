# Implementation Roadmap

## Phase 0 — Design lock

Outputs:
- architecture frozen
- repo skeleton created
- reuse map explicit
- contract scope reduced to one MVP flow

Exit proof:
- `ARCHITECTURE.md`
- `docs/BETA_ROLLOUT_PLAN.md`
- `docs/REUSE_MAP.md`

## Phase 1 — Contract-first MVP

Goal:
Create the smallest Compact contract set that supports:
- task creation
- escrow funding
- sealed bid commitment
- worker selection
- delivery receipt commitment
- acceptance / payout

Exit proof:
- contract sources exist
- local compile path exists
- sample task lifecycle is documented

## Phase 2 — Web app shell

Goal:
Ship a UI that clearly shows:
- create task
- browse tasks
- submit bid
- accept bid
- review receipt
- release payout

Exit proof:
- screens wired to mocked or real API
- wallet adapter interface exists
- public/private field boundaries visible in UI

## Phase 3 — Worker daemon MVP

Goal:
Port worker concepts from shell-protocol:
- assignment polling
- local execution
- action log capture
- delivery receipt generation

Exit proof:
- worker can process a mocked assignment
- receipt hash matches shared utility

## Phase 4 — Integration

Goal:
Join the contract, UI, API, and worker path into one runnable flow.

Exit proof:
- end-to-end happy path works
- beta data seeded
- screenshots / recording plan ready

## Phase 5 — Beta polish

Goal:
Polish the product beta.

Tasks:
- improve naming and visual coherence
- trim scope leaks
- write final beta walkthrough
- capture architecture visuals
- record short walkthrough video

## Build order priority

1. contract state machine
2. task creation UI
3. bid flow
4. receipt flow
5. acceptance / payout
6. dispute / selective reveal

## Hard cuts if time runs short

Cut in this order:
1. reputation
2. open marketplace discovery
3. multi-worker orchestration
4. dispute automation
5. advanced selective-disclosure UX

Do **not** cut:
- private task story
- sealed bid story
- receipt-based completion story
