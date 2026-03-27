# contracts/compact

Midnight Compact contracts for OpenShell NightShift.

## Phase 1 contract target

The MVP contract family is intentionally small.

Primary contract:
- `NightShiftTaskEscrow`

Phase 1 responsibilities:
- task creation commitment
- reward escrow
- sealed bid commitment recording
- winning bid selection
- receipt commitment recording
- acceptance / dispute state transition
- payout release

## What lives here vs elsewhere

### Lives here
- public task lifecycle state
- public commitments
- escrow logic
- role-based transition guards

### Does not live here
- plaintext task briefs
- plaintext bid contents
- delivery artifacts
- screenshots, logs, or result bundles
- worker runtime logic

Those remain off-chain and are selectively disclosed only when needed.

## Supporting docs

- `/Users/bidao/Projects/aisol/docs/STACK_DECISION.md`
- `/Users/bidao/Projects/aisol/docs/PHASE1_CONTRACT_SPEC.md`

## Implementation note

Compact is the correct implementation target because Midnight officially positions it as the TypeScript-like smart contract language for privacy-preserving applications.

The initial implementation should optimize for:
- state machine clarity
- low feature count
- operational clarity
- explicit public/private boundaries

Not for protocol completeness.


## Current files

- `/Users/bidao/Projects/aisol/contracts/compact/src/NightShiftTaskEscrow.compact` — phase-1 public lifecycle scaffold
- `/Users/bidao/Projects/aisol/contracts/compact/simulate_state_machine.py` — local state-machine simulation for contract lifecycle

## Local verification

Run:

- `python3 /Users/bidao/Projects/aisol/contracts/compact/simulate_state_machine.py`
- or from repo root: `pnpm simulate:compact`

This does **not** compile Compact yet, but it verifies the intended transition logic before the real Midnight toolchain is wired in.
