# P2P + multi-LLM compatibility

## Core rule
The network protocol must stay **provider-agnostic**.

P2P transport should exchange only:
- task identifiers and commitments
- assignment context
- receipt commitments and hashes
- worker capability metadata
- transport metadata

It should **not** standardize vendor-specific prompt wire formats.

## Architecture
### 1. Domain layer
Canonical task, bid, assignment, and receipt entities live in:
- `packages/common/src/domain.ts`

### 2. Execution requirements layer
Model/provider/transport capability requirements live in:
- `packages/common/src/execution.ts`

This layer defines:
- transport kinds (`http-poller`, `libp2p`, `relay`)
- execution mode (`worker-hosted-model`, `delegated-credential`, `tool-only`)
- provider descriptors
- model selection policy
- shared invocation spec (`operation`, `inputFormat`, `outputFormat`, `toolProfile`, `timeoutMs`)

### 3. Worker transport layer
Worker identity and polling/submission contracts live in:
- `packages/common/src/transport.ts`

Workers advertise:
- supported transports
- supported model providers
- general capabilities

### 4. Worker adapter layer
Provider-specific adaptation is isolated to the worker runtime:
- `packages/worker/src/model-adapters.ts`
- `packages/worker/src/config.ts`
- `packages/worker/src/executor.ts`
- `packages/worker/src/runtime.ts`

## Why this works
When transport is decoupled from model invocation:
- migrating from HTTP polling to libp2p does not require changing task or receipt semantics
- adding OpenAI, Anthropic, xAI, Gemini, Ollama, or local models becomes a worker concern
- settlement logic can trust commitments and receipts instead of trusting provider self-reports
- bid admission and assignment polling can reject workers whose advertised transports/providers do not satisfy the task execution policy

## Trust model
The system should trust:
- task commitment
- bid commitment
- assignment context
- action log hash
- artifact hash
- receipt commitment

The system should not trust, by itself:
- claimed provider name
- claimed model name
- claimed success without receipt evidence

## Shared invocation contract
Multi-LLM compatibility needs more than provider discovery. The worker now has a shared invocation contract in:
- `packages/common/src/execution.ts`

This keeps P2P messages provider-agnostic by describing:
- what operation is being requested
- expected input/output format
- optional schema/tool/timeout hints

The transport layer still moves commitments and assignments; provider-specific prompting stays inside worker adapters.

## Recommended provider strategy for the current beta
For the current beta build:
1. keep the worker transport compatible with `http-poller` first,
2. model libp2p as a supported transport in metadata,
3. keep provider compatibility behind a worker-side adapter registry,
4. settle only on receipt evidence, not vendor claims.

## Current implementation status
- `POST /v1/tasks/:taskId/bids` accepts a worker execution offer and rejects incompatible bids.
- `GET /v1/assignments/poll` accepts worker transport/provider metadata and filters out assignments the worker cannot satisfy.
- The worker runtime now advertises:
  - transport support
  - provider catalog
  - generic capability/tool metadata
- Local-model execution is now real for:
  - `provider: "ollama"`
  - `provider: "openai-compatible"` for LM Studio / vLLM style endpoints
- Relevant adapters:
  - `packages/worker/src/adapters/ollama-adapter.ts`
  - `packages/worker/src/adapters/openai-compatible-adapter.ts`
- Hosted providers still remain adapter-compatible but mostly beta/mock until more adapters are added.

## Future extension
A future libp2p worker can reuse the same assignment and receipt objects, changing only the transport implementation while preserving:
- matching logic
- execution requirements
- receipt generation
- settlement flow
