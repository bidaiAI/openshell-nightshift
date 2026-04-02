# OpenShell NightShift — Beta Rollout Plan

## 1. Working assumptions from official Midnight ecosystem materials

Using current official Midnight materials as the alignment baseline:

- Midnight is a **privacy-first blockchain** designed for **selective disclosure** and **ZK-backed privacy-preserving applications**
- Compact is Midnight’s TypeScript-like contract language
- Midnight ecosystem materials consistently reward **functional, open-source reference dApps** that demonstrate concrete privacy patterns
- the current rollout should stay aligned with that privacy-first product direction

## 2. What the beta version must prove

The product should feel like a Midnight-native app by proving:

1. private task state can exist without fully public exposure
2. bids can be made without revealing sensitive strategy up front
3. the system can selectively disclose only what is needed for acceptance or dispute
4. the user flow is understandable in a short evaluation

## 3. Product thesis

**OpenShell NightShift**

> A privacy-first task marketplace where users or agents outsource work, receive sealed bids, and pay only after verifiable delivery.

## 4. Beta scope

### Must-have
- create task
- fund task escrow
- submit sealed bid
- accept bid
- worker submits receipt
- employer accepts result and releases payment

### Should-have
- selective reveal panel for disputes
- receipt viewer with action-log hash / artifact hash
- basic reputation surface

### Won't-have for the current beta
- full P2P networking
- generalized WASM sandbox
- zkTLS proof generation
- state channels
- multi-chain settlement

## 5. Product alignment

### Innovation
The project combines:
- Midnight privacy patterns
- agent / worker marketplaces
- verifiable delivery receipts

### Technical implementation
The stack intentionally spans:
- Compact contract(s)
- web application
- worker daemon
- encrypted metadata service

### Feasibility
The scope is deliberately reduced to one product loop.

### Midnight fit
The differentiator is not “outsourcing” alone.
The differentiator is:
- private task data
- sealed bidding
- selective disclosure

## 6. Beta script (3–5 minutes)

1. Connect wallet
2. Create private task and lock bounty
3. Show public task card only reveals safe metadata
4. Second user submits sealed bid
5. Employer accepts bid
6. Worker uploads result package and receipt commitment
7. Employer reviews the delivery and releases payout
8. Show dispute panel and selective disclosure flow

## 7. Rollout checklist

- open-source repo
- README with setup + architecture
- Compact contract source
- web beta
- worker beta
- short video
- clear explanation of what is public vs private

## 8. Primary risks

### Risk 1 — Midnight toolchain friction
Mitigation:
- isolate contract work early
- keep fallback UI mocks ready

### Risk 2 — wallet integration drift
Mitigation:
- use adapter abstraction in frontend
- avoid hard-coding EVM assumptions

### Risk 3 — overbuilding privacy features
Mitigation:
- build commitment + selective reveal first
- defer complex cryptography beyond Midnight-native patterns

## 9. Success definition

A successful beta rollout is not “the full OpenShell protocol.”
A successful beta rollout is:

> one complete private task lifecycle, demonstrated clearly, with Midnight-native privacy semantics.
