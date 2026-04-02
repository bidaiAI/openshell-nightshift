# @nightshift/worker

Local worker daemon scaffold for OpenShell NightShift.

## Responsibilities
- poll assignments
- acknowledge selected work
- execute tasks locally
- collect action logs
- generate delivery receipts
- submit result bundles back to the API

## Current implementation

Implemented now:
- config loader and validation
- HTTP poller transport
- local execution stub
- receipt and receipt-commitment generation
- initial real local-model adapter path for Ollama-compatible local servers
- initial real local-model adapter path for OpenAI-compatible local endpoints
- `runWorkerOnce(...)` beta loop for:
  - poll -> ack -> execute -> submit

Key files:
- `packages/worker/src/runtime.ts`
- `packages/worker/src/executor.ts`
- `packages/worker/src/receipt.ts`
- `packages/worker/src/poller.ts`
- `packages/worker/src/model-adapters.ts`
- `packages/worker/src/adapters/ollama-adapter.ts`
- `packages/worker/src/adapters/openai-compatible-adapter.ts`

## Local model support

NightShift now supports local-model execution in two layers:

1. **Compatibility and scheduling**
   - worker advertises provider/model/transport metadata
   - API only assigns work to compatible workers

2. **Execution**
   - `provider: "ollama"` now routes to a real local adapter
   - `provider: "openai-compatible"` now routes to a real local adapter for LM Studio / vLLM style endpoints
   - `provider: "mock"` remains the fallback beta adapter

Example catalog entry:

```json
[
  {
    "provider": "ollama",
    "model": "qwen2.5:14b",
    "endpoint": "http://127.0.0.1:11434",
    "capabilities": ["text", "json"],
    "local": true,
    "pricingTier": "local"
  }
]
```

Current limitation:
- hosted OpenAI / Anthropic / xAI descriptors are still treated as placeholder adapters unless a real hosted adapter is added.
- `libp2p` remains metadata-compatible but runtime execution still uses HTTP polling today.

## Dev note

Current useful run modes:
- one cycle:
  - `WORKER_AUTO_RUN=1 pnpm --filter @nightshift/worker dev`
- continuous polling loop:
  - `WORKER_LOOP=1 pnpm --filter @nightshift/worker dev`

For most local beta users, the easiest path is now:
- `pnpm beta`

That command starts the worker in loop mode with beta credentials and the local API base URL already wired.

Initial implementation reference:
- `shell-protocol/packages/miner-cli`
