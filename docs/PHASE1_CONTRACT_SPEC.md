# OpenShell NightShift — Phase 1 Contract Spec

## Purpose

Define the smallest Compact contract surface required to ship the current beta MVP.

This is **not** the final OpenShell protocol. It is the Phase 1 state machine for one complete private work loop:

> task -> sealed bid -> assignment -> delivery receipt -> accept or dispute -> payout

## Design goal

Use Midnight for the part it is uniquely good at:

- commitment-backed public state
- private data off-chain with selective disclosure
- small, explicit, runnable contract transitions

## Non-goals for Phase 1

Do **not** implement these in the first contract pass:

- worker staking
- reputation market
- generalized arbitration court
- open peer discovery
- multi-chain settlement
- zkTLS-specific verification
- generalized untrusted code execution semantics

## Contract family

### Primary contract: `NightShiftTaskEscrow`
This is the only required contract in Phase 1.

It owns:
- task lifecycle state
- bounty escrow
- bid commitments
- assignment selection
- delivery receipt commitment
- final settlement path

### Deferred contract: `NightShiftReputation`
Only build this if the primary flow is already complete.

## Public/private split

### On-chain public state
The contract stores only what must be durable and verifiable:

- `taskId`
- `employer`
- `status`
- `rewardAmount`
- `taskCommitment`
- `publicSummaryCommitment`
- `deadlineAt`
- `selectedWorker`
- `acceptedBidCommitment`
- `receiptCommitment`
- `disputeCommitment` (optional if dispute opened)
- timestamps for key transitions

### Off-chain private state
Stored in `apps/api` or encrypted storage referenced by it:

- full task brief
- encrypted task attachments
- full bid payloads
- worker quote details
- full delivery artifacts
- action logs
- screenshots
- result bundle contents

### Selectively disclosed state
Revealed only when needed for acceptance or dispute:

- chosen bid plaintext
- selected excerpts of task brief
- receipt bundle subset
- artifact hash explanations
- delivery evidence chosen by either party

## Commitment model

The contract never stores raw task or result data.

### Task commitment
Recommended shape:

`taskCommitment = H(taskPrivateBlobId, employerNonce, schemaVersion)`

### Public summary commitment
Recommended shape:

`publicSummaryCommitment = H(title, category, rewardRange, deadlineAt)`

This lets the UI show a minimal public task card without exposing sensitive details.

### Bid commitment
Recommended shape:

`bidCommitment = H(taskId, bidder, amount, eta, bidPrivateBlobId, bidderNonce)`

### Delivery receipt commitment
Recommended shape:

`receiptCommitment = H(taskId, worker, resultHash, actionLogHash, artifactRootHash, receiptVersion)`

### Dispute commitment
Recommended shape:

`disputeCommitment = H(taskId, opener, revealBundleHash, disputeReasonCode)`

## State machine

## Task statuses

```text
Draft (off-chain only)
  -> Open
  -> Assigned
  -> Delivered
  -> Disputed
  -> Completed
  -> Cancelled
```

### Status meanings
- `Open` — task exists, funded, accepting sealed bids
- `Assigned` — employer selected one worker
- `Delivered` — worker submitted delivery receipt commitment
- `Disputed` — a dispute was opened after delivery or timeout conditions
- `Completed` — employer accepted delivery, funds released
- `Cancelled` — task closed without payout to worker

## Core transitions

### 1. `createTask(...)`
**Called by:** employer

**Inputs:**
- `taskId`
- `taskCommitment`
- `publicSummaryCommitment`
- `rewardAmount`
- `deadlineAt`

**Effects:**
- locks reward into escrow
- creates task in `Open`

**Checks:**
- unique `taskId`
- reward > 0
- deadline valid

### 2. `submitBid(...)`
**Called by:** worker / bidder

**Inputs:**
- `taskId`
- `bidCommitment`

**Effects:**
- records one sealed bid commitment for the sender
- task remains `Open`

**Checks:**
- task is `Open`
- bidding window not expired
- one active bid per bidder per task for MVP simplicity

### 3. `acceptBid(...)`
**Called by:** employer

**Inputs:**
- `taskId`
- `worker`
- `acceptedBidCommitment`

**Effects:**
- selects worker
- persists accepted bid commitment
- moves task to `Assigned`

**Checks:**
- task is `Open`
- bidder has already submitted a sealed bid
- only employer can choose

### 4. `submitDelivery(...)`
**Called by:** selected worker

**Inputs:**
- `taskId`
- `receiptCommitment`

**Effects:**
- stores delivery receipt commitment
- moves task to `Delivered`

**Checks:**
- task is `Assigned`
- sender is selected worker
- one delivery submission for MVP

### 5. `acceptDelivery(...)`
**Called by:** employer

**Inputs:**
- `taskId`

**Effects:**
- releases escrow to selected worker
- moves task to `Completed`

**Checks:**
- task is `Delivered`
- only employer can accept

### 6. `openDispute(...)`
**Called by:** employer or selected worker

**Inputs:**
- `taskId`
- `disputeCommitment`

**Effects:**
- moves task to `Disputed`
- stores dispute commitment

**Checks:**
- task is `Delivered` or `Assigned` after timeout conditions
- opener is the employer or selected worker

### 7. `cancelTask(...)`
**Called by:** employer

**Effects:**
- returns escrow to employer
- moves task to `Cancelled`

**Checks:**
- task still `Open`
- no worker selected yet

## Dispute strategy for MVP

### Preferred Phase 1 rule
Dispute entry is on-chain, but dispute resolution is **off-chain/manual for the beta**.

Why this is acceptable:
- Midnight product rollouts reward a polished small slice
- automated arbitration is a second product, not Phase 1
- the contract only needs to preserve the dispute state and freeze payout

### Recommended resolution path
For the beta, resolution can be:
- a privileged beta-only resolver account, or
- a temporary admin circuit clearly labeled as beta-only

### Required warning
The docs and UI must clearly label dispute resolution as:

> "Beta resolver path — replace with decentralized arbitration in later phases."

## Privacy boundaries by screen

### Public task board
May show:
- title or category stub
- reward band or reward amount
- task open/assigned/completed status
- deadline

May not show:
- full task brief
- attachments
- plaintext bid amounts if the team decides sealed means fully private until selection

### Employer view
May show:
- full private task brief
- all off-chain bid details after decryption
- selected receipt bundle

### Worker view
May show:
- assigned task private details only after selection
- own bid plaintext
- delivery artifact status

## Recommended storage coupling

The contract should reference the API layer indirectly through commitments only.

### Rule
No API URL, blob path, or raw CID should be treated as trusted by itself.

The trusted object is:
- the commitment on-chain
- plus the matching revealed blob off-chain

## Suggested Compact module split

### `NightShiftTypes`
- enums
- structs
- task status definitions

### `NightShiftTaskEscrow`
- task storage
- bid storage
- assignment selection
- delivery and settlement transitions

### `NightShiftGuards`
- transition assertions
- role checks
- deadline / timeout checks

For Phase 1, these can all live in one contract file if needed. The split is conceptual, not mandatory.

## Minimal data structures

### TaskRecord
- `employer`
- `status`
- `rewardAmount`
- `taskCommitment`
- `publicSummaryCommitment`
- `deadlineAt`
- `selectedWorker`
- `acceptedBidCommitment`
- `receiptCommitment`
- `disputeCommitment`

### BidRecord
- `bidder`
- `bidCommitment`
- `submittedAt`

## MVP invariants

1. one task has at most one selected worker
2. payout only happens after `Delivered -> Completed`
3. only the selected worker can submit delivery
4. raw task and receipt data never land on-chain
5. every meaningful off-chain reveal must have a matching on-chain commitment

## Fallback plan if Compact implementation time is tight

### Fallback A
Implement only:
- `createTask`
- `acceptBid`
- `submitDelivery`
- `acceptDelivery`

And keep bids off-chain except for the selected bid commitment.

### Fallback B
Use a single invited worker per task.

This removes open bidding while preserving:
- private task data
- receipt-based delivery
- payout after acceptance

### Fallback C
Dispute remains a UI/API concept only and is described, not fully wired.

This is acceptable only if the happy path is fully working and clearly Midnight-native.

## Exit criteria for Phase 1

The contract spec is satisfied when the team can demonstrate:

1. a funded task enters `Open`
2. a bid commitment is recorded
3. employer selects a worker and task enters `Assigned`
4. worker submits a receipt commitment and task enters `Delivered`
5. employer accepts and funds are released in `Completed`
6. at no point does plaintext task or result data need to be published on-chain

## References

- [Midnight Docs](https://docs.midnight.network/) — official docs describe Midnight as privacy-first with selective disclosure and private transaction support.
- [Compact language blog](https://midnight.network/blog/compact-the-smart-contract-language-of-midnight) — official description of Compact structs, enums, circuits, modules, and TypeScript-like syntax.
- [Developer Hub](https://midnight.network/developer-hub) — official Midnight builder guidance favoring small, self-contained, polished implementations.
