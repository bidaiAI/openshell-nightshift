# Next Gaps and Execution Plan

Last updated: 2026-03-26

This document captures the **remaining gaps after the latest auth, canonical receipt, and dispute/reveal pass** and turns them into a practical execution plan for OpenShell NightShift.

## 1. What is already clearly missing

These are no longer hypotheses; the current repo already shows them.

### GAP-01 — Actor auth/authz exists, but still falls back to beta-grade shared-token mode if enabled
Status: **P0 (partially closed)**

Current impact:
- anonymous mutation is now blocked
- employer vs worker authority is checked at the HTTP boundary
- actor-bound credentials are now supported
- but any deployment that re-enables shared-token mode still allows spoofable actor headers

Needed outcome:
- keep shared-token mode disabled by default
- replace beta credentials with wallet-signature or connector-backed session auth
- preserve current route-level employer/worker checks as the authorization layer

---

### GAP-02 — Receipt submission is canonicalized and the legacy route has been removed
Status: **closed for MVP**

Current state:
- canonical path: `/v1/assignments/:assignmentId/submit`
- legacy task-scoped receipt route is gone

Remaining risk:
- old notes/docs may still mention the legacy route

Needed outcome:
- keep the docs explicit that assignment submission is the only supported delivery path

---

### GAP-03 — Dispute / reveal now exists, but is still a minimal off-chain beta flow
Status: **P0 (partially closed)**

Current state:
- API now supports dispute creation and reveal submission
- UI now supports opening a dispute and submitting a selective reveal
- task settlement now refuses to proceed while a dispute is open

Remaining gap:
- dispute resolution is still manual/off-chain
- reveal storage is still just hash + optional ref
- no durable audit trail or contract-backed resolution yet

Needed outcome:
- keep the current minimum flow for the current beta
- add durable reveal bundle storage and explicit resolution semantics next

---

### GAP-04 — Compact contract still lacks actual escrow/payment wiring
Status: **P0**

Current state:
- `/Users/bidao/Projects/aisol/contracts/compact/src/NightShiftTaskEscrow.compact`
- `acceptReceiptAndSettle()` still contains TODO for payout release

Needed outcome:
- confirm current Midnight token/payment primitive path
- wire the smallest believable payout path
- if full token path is not realistic in the current environment, clearly isolate mock settlement vs contract state transition

---

### GAP-05 — Runtime verification is still incomplete
Status: **P0**

Current state:
- Python state-machine simulation passes
- no real `pnpm typecheck`, `build`, or end-to-end run has happened in this environment

Needed outcome:
- once Node toolchain is available, run:
  - typecheck
  - build
  - API smoke checks
  - web smoke checks
  - worker smoke checks
- record failures and fix in sequence

---

### GAP-05A — The environment still lacks Node/pnpm for real build verification
Status: **P0**

Current state:
- Python-based Compact simulation passes
- static grep/code review checks pass
- `node` and `pnpm` are still unavailable in this environment

Needed outcome:
- as soon as the toolchain exists, run the full web/api/worker verification pass

## 2. Multi-LLM / P2P specific gaps

### GAP-06 — Invocation contract exists but is not yet fully threaded through the full product flow
Status: **P1**

Current state:
- shared `ModelInvocationSpec` exists
- worker adapter can `invoke(spec, input)`
- create-task UI does not yet expose or persist rich invocation controls beyond the current simplified execution policy

Needed outcome:
- persist invocation spec from task creation through assignment execution
- expose enough of it in UI/API to explain why provider-agnostic execution works

---

### GAP-07 — Transport negotiation is metadata-only; libp2p is not implemented
Status: **P1**

Current state:
- transport compatibility exists at model level
- runtime still executes over HTTP poller only

Needed outcome:
- keep current beta runtime on HTTP
- add a proper transport abstraction/factory so `libp2p` is not just a string enum
- optionally add a no-op `libp2p` adapter stub for architecture credibility

---

### GAP-08 — Fallback / selection reasoning is not surfaced well enough
Status: **P1**

Current state:
- provider/model selection can happen
- receipts/results do not clearly explain fallback reason or compatibility decision

Needed outcome:
- include selection reason in runtime result and/or receipt reveal
- make it visible in beta UI for at least one task

---

### GAP-08A — Multi-LLM local-model support is now real for Ollama and OpenAI-compatible local endpoints
Status: **P1 (partially closed)**

Current state:
- compatibility model supports provider-agnostic scheduling
- local execution is now real for `provider: "ollama"`
- local execution is also real for `provider: "openai-compatible"` endpoints
- other hosted providers still use mock adapters in the current repo

Needed outcome:
- keep provider selection visible in receipts/results
- decide whether hosted OpenAI-style endpoints should remain out of scope for current beta mode

## 3. Privacy / data-boundary gaps

### GAP-09 — Off-chain encrypted storage is still abstract
Status: **P1**

Current state:
- repo uses refs like `ipfs://...` and `nightshift://...`
- there is no concrete encrypted blob storage lifecycle yet

Needed outcome:
- define one beta storage model:
  - local JSON store
  - in-memory encrypted bundle registry
  - or file-backed bundle index
- clearly separate public commitment vs private blob reference

---

### GAP-10 — Reveal packet schema is not formalized
Status: **P1 (partially closed)**

Current state:
- commitments exist
- selective reveal is now represented by API/store fields
- no reusable shared `DisputeRevealBundle` type has been promoted into `packages/common` yet

Needed outcome:
- define reveal bundle fields:
  - taskId
  - assignmentId
  - receiptId
  - reveal reason
  - revealed fields
  - reveal bundle hash
- make this map to both API and contract docs

## 4. Product/beta gaps

### GAP-11 — Wallet-connected actor identity is not wired into app flows
Status: **P1 (partially closed)**

Current state:
- wallet adapter exists in web
- employer actions now use wallet-derived actor identity when available
- worker actions still rely on entered/beta worker IDs rather than wallet-backed sessions

Needed outcome:
- use wallet identity for employer/worker action headers in beta mode
- prepare migration path to Midnight-native connector/session later

---

### GAP-12 — Beta walkthrough and operator-facing proof points are not yet encoded in the app
Status: **P2**

Current state:
- product is getting close to a believable flow
- the core create → bid → assign → submit → dispute/reveal → settle flow now exists
- not all screens emphasize the Midnight-specific privacy story strongly enough

Needed outcome:
- add clear public/private labels
- add reveal/dispute panel
- add one-page product summary and scripted walkthrough

## 5. Cleanup / consistency gaps

### GAP-13 — Legacy draft/privacy split types still coexist with canonical entity model
Status: **P2**

Current state:
- canonical domain exists
- legacy draft/public-private types still remain in `packages/common/src/domain.ts`
- display states like `draft` still exist in presentation helpers

Needed outcome:
- decide what remains for beta convenience vs what should be removed
- shrink legacy surface so future bugs are less likely

---

### GAP-14 — API persistence is beta-grade only
Status: **P2**

Current state:
- in-memory store only
- no durable idempotency or replay guard beyond current hashes

Needed outcome:
- for current beta: explicit beta-only labeling is enough
- optional file-backed persistence if time allows

## 6. External research still needed

These are research items because the right answer depends on current Midnight tooling and ecosystem state.

### R-01 — Current Compact/toolchain compatibility to target
Why it matters:
- Compact / ledger compatibility is version-sensitive
- incorrect version assumptions can waste implementation time

Current signal:
- Midnight docs were updated on **March 4, 2026**
- recent release notes show active movement in the public devnet/tooling stack

Sources:
- [Midnight Docs](https://docs.midnight.network/)
- [Compact 0.27 compatibility guidance](https://forum.midnight.network/t/compact-0-27-release-and-network-compatibility-guidance/736)
- [Public devnet 0.1.0 release notes](https://docs.midnight.network/assets/files/midnight-public-devnet-0.1.0-relnotes-2241ec8f5c5e77985fb8b722b2101cbd.pdf)

---

### R-02 — Real token/payment path for settlement
Why it matters:
- the contract still fakes settlement state without moving value
- recent Midnight release notes indicate evolving native token support

Current signal:
- public devnet 0.1.0 release notes mention support for **Midnight Native Shielded Tokens** and DApp connector/prover updates

Source:
- [Public devnet 0.1.0 release notes](https://docs.midnight.network/assets/files/midnight-public-devnet-0.1.0-relnotes-2241ec8f5c5e77985fb8b722b2101cbd.pdf)

---

### R-03 — Local development path for realistic Compact verification
Why it matters:
- we need a credible local compile/deploy/prove story
- this can replace hand-wavy contract claims in the beta

Current signal:
- the Midnight community has published a local playground pattern with node/indexer/proof server via Docker

Source:
- [Midnight local playground](https://forum.midnight.network/t/local-playground-for-midnight-compact-contracts-run-a-full-node-indexer-and-proof-server-via-docker-fund-your-lace-wallet-and-deploy-without-testnets-or-faucets/1002)

---

### R-04 — Wallet / connector path for Midnight-facing frontend
Why it matters:
- wallet identity and dApp connector shape affect how we should implement actor auth and beta sessions

Current signal:
- Midnight has an active wallet/connectivity roadmap and current docs emphasize the dApp connector path

Sources:
- [Midnight Developer Hub](https://midnight.network/developer-hub)
- [Wallet integration outlook](https://midnight.network/blog/looking-ahead-to-midnight-self-custody-wallet-integrations)

---

### R-05 — Hosted-provider adapter strategy beyond local runtimes
Why it matters:
- the platform now supports local models via Ollama and OpenAI-compatible endpoints
- the next question is whether to add real hosted-provider adapters or keep them mocked for the current beta scope

Current signal:
- many hosted APIs are also OpenAI-like, but auth, quotas, and response semantics vary enough to create scope risk

Needed research outcome:
- decide whether the next real adapter should target:
  - hosted OpenAI
  - hosted Anthropic
  - OpenRouter
  - or stay local-only until after the current beta

## 7. Execution plan

## P0 — Must do next
1. Clarify contract settlement path: real primitive vs explicit mock
2. Prepare runtime verification checklist for when Node toolchain is available
3. Promote dispute/reveal bundle schema into shared types
4. Tighten beta auth toward wallet-backed or signed-session auth
5. Keep actor-bound token mode as the default beta path

## P1 — Strengthen the architecture story
6. Fully thread invocation spec through task -> assignment -> worker -> receipt
7. Improve transport abstraction so libp2p is a future adapter, not only metadata
8. Surface provider selection/fallback reasoning in results
9. Define encrypted blob storage contract and durable reveal bundle schema
10. Generalize local-model support beyond Ollama

## P2 — Product polish
11. Remove or quarantine remaining legacy type surfaces
12. Improve persistence/idempotency where cheap
13. Build operator-facing walkthrough and screenshots
14. Add explicit “public vs private vs selectively revealed” explanation in the UI

## 8. Recommended implementation order
1. settlement clarity in Compact + docs
2. shared dispute/reveal schema cleanup
3. invocation threading and provider selection evidence
4. generalized local-model adapter surface
5. beta packaging and final verification
