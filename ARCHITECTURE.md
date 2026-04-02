# OpenShell NightShift — Architecture Decision Note

## 1. Real decision

We need a NightShift beta product that:

- reuses the strongest parts of existing OpenShell code
- is small enough to operate safely in a limited beta window
- still feels like a real product, not a toy

## 2. Constraints

### External constraints
- Midnight emphasizes **rational privacy**, **selective disclosure**, and **privacy-preserving dApps**
- Compact is the contract language path for Midnight
- the project must show a concrete privacy pattern, not generic infra ambition

### Internal constraints
- existing reusable assets live in:
  - `shell-protocol` (worker / proof / task loop)
  - `mortal-platform` (product shell / contract UX / service marketplace)
- current workspace was empty, so a clean new project is feasible
- full protocol ideas like P2P, zkTLS, state channels, and generalized WASM execution are too large for this stage

## 3. Options considered

### Option A — submit the full OAP protocol story
**Rejected**

Pros:
- strongest narrative
- most ambitious

Cons:
- too large
- too many unproven assumptions
- poor limited-beta fit
- weak operational clarity

### Option B — fork `shell-protocol` and retheme it for Midnight
**Rejected**

Pros:
- strong worker logic already exists
- receipt / proof patterns already exist

Cons:
- wrong product shape
- wrong chain assumptions
- too much red-team/mining baggage
- weak privacy-marketplace story

### Option C — fork `mortal-platform` and retheme it for Midnight
**Rejected as the sole base**

Pros:
- best UI and product shell
- mature dashboard and contract UX patterns

Cons:
- too much unrelated narrative baggage
- EVM/Base/BSC assumptions are too strong
- worker execution layer is missing

### Option D — build a new repo and selectively reuse both existing systems
**Chosen**

Pros:
- smallest durable design
- preserves product clarity
- preserves reuse where it matters
- easiest to align with Midnight-specific privacy patterns

Cons:
- requires intentional migration instead of direct copy-paste
- requires wallet / chain abstraction from day 1

## 4. Chosen architecture

### Product name
**OpenShell NightShift**

### Product thesis
A privacy-first task marketplace for human or agent outsourcing.

### On-chain scope (Midnight Compact)
A single first-pass contract family:

1. **TaskEscrow**
   - create task commitment
   - lock reward funds
   - accept sealed bids
   - choose winning bid
   - record delivery receipt commitment
   - release payout or open dispute

Optional later:
2. **Reputation / disclosure helper**
   - only if beta scope allows

### Off-chain scope

1. **Web app**
   - create task
   - browse tasks
   - submit sealed bid
   - assign worker
   - review delivery receipt
   - approve / dispute

2. **API layer**
   - store encrypted task metadata
   - store bid payloads and delivery artifacts
   - manage references from off-chain blobs to on-chain commitments

3. **Worker daemon**
   - poll assigned work
   - execute locally
   - generate action log
   - produce delivery receipt
   - submit result bundle

## 5. System topology

### Layer A — Midnight contract layer
Stores:
- task commitments
- bid commitments
- assignment state
- receipt commitment
- payout / dispute state

Does **not** store:
- raw task text
- raw deliverables
- worker logs in full

### Layer B — API + encrypted metadata layer
Stores:
- encrypted task description
- encrypted bid details
- receipt artifacts
- screenshots / logs / result previews

Publishes only hashes / IDs to the contract layer.

### Layer C — local worker layer
Runs on the worker machine:
- accepts assignment
- executes job locally
- records action log
- computes receipt hash
- uploads result package

## 6. Reuse decisions

### Reuse from `shell-protocol`
Keep conceptually and partially port:
- task polling shape
- local executor shape
- action log collection
- receipt hash generation

Do **not** carry over:
- mining economics
- red-team payload generation
- Solana/Phantom auth
- attack-specific target models

### Reuse from `mortal-platform`
Keep conceptually and partially port:
- create-flow UX
- dashboard / status UX
- order / settlement information architecture
- service marketplace abstractions

Do **not** carry over:
- mortal AI narrative
- EVM-specific contract assumptions
- BSC/Base dual-chain model
- self-modification and unrelated platform features

## 7. Invariants

1. Midnight-facing value proposition must be **privacy first**, not generic outsourcing
2. The MVP must demonstrate **selective disclosure**
3. Contract state must remain **small and commitment-based**
4. Worker results must be **receipt-based**, not trust-me text blobs
5. The repo must stay understandable enough for operators, collaborators, and future engineering work

## 8. Evidence required to validate the design

The design is successful if we can show:

1. a user can create a task and fund it
2. a worker can submit a sealed bid
3. a bid can be accepted
4. a worker can submit a delivery receipt
5. payout can be released after acceptance
6. only committed / selectively disclosed data appears on-chain

## 9. Rollback path

If full sealed-bid or selective-disclosure integration slips, rollback to:

- public task summary + private detailed brief
- single worker invite instead of open bidding
- receipt hash + manual acceptance
- one-contract escrow MVP

That fallback still fits the current beta and preserves the core value proposition.
