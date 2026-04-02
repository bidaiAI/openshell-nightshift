# Reuse Map — From Existing Repos to OpenShell NightShift

## Source repo A — shell-protocol
Repo: `https://github.com/bidaiAI/shell-protocol`

### Reuse directly by concept
- `packages/miner-cli/src/poller.ts`
  - becomes worker polling / assignment client
- `packages/miner-cli/src/local-sandbox/executor.ts`
  - becomes local task executor shell
- `packages/miner-cli/src/local-sandbox/mock-tools.ts`
  - becomes receipt-friendly mock / adapter tool layer
- `packages/miner-cli/src/local-sandbox/proof.ts`
  - becomes delivery receipt hash / commitment utility
- `packages/miner-cli/src/config.ts`
  - becomes worker config loader pattern

### Reuse only as UI inspiration
- `packages/web/src/pages/TaskFeed.vue`
- `packages/web/src/pages/TaskCenter.vue`
- `packages/web/src/pages/Dashboard.vue`

### Do not migrate
- mining economy
- attack payload generation
- target-agent directory
- referral / leaderboard logic
- Solana / Phantom auth assumptions

## Source repo B — mortal-platform
Repo: `https://github.com/bidaiAI/mortal-platform`

### Reuse directly by concept
- `web/app/platform/create/page.tsx`
  - becomes create-task / fund-task flow
- `web/app/platform/dashboard/page.tsx`
  - becomes employer / worker dashboard flow
- `web/components/WalletButton.tsx`
  - becomes wallet-connect UI pattern only
- `web/lib/platform-api.ts`
  - becomes app API client pattern
- `core/purchasing.py`
  - becomes the domain model reference for offers / orders / delivery lifecycle
- `core/adapters/peer_adapter.py`
  - becomes worker / peer marketplace logic reference

### Reuse cautiously
- `web/lib/wagmi.ts`
  - interaction pattern useful, implementation not reusable for Midnight
- `contracts/MortalVault*.sol`
  - economic ideas only, not code
- `api/server.py`
  - endpoint grouping and API surface ideas only

### Do not migrate
- mortal / death / transcendence narrative
- BSC/Base assumptions
- self-modifying service engine
- x402 / Bitrefill-specific business logic
- unrelated AI autonomy subsystems

## Target mapping in new repo

- `apps/web`
  - product UI inspired by `mortal-platform`
- `apps/api`
  - lightweight metadata / receipt service inspired by `mortal-platform/api`
- `packages/worker`
  - worker logic ported from `shell-protocol/miner-cli`
- `packages/common`
  - shared task, bid, receipt, commitment types
- `contracts/compact`
  - all new, Midnight-native contract layer
