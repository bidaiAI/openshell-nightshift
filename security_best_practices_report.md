# Security Best Practices Report

## Executive summary
The project is materially safer than it was at the start of this sprint. The API now has actor-bound beta credentials, route-level authorization checks, narrowed CORS, in-memory rate limiting, canonical worker submission via `POST /v1/assignments/:assignmentId/submit`, server-side `resultHash` verification from submitted result payloads, redacted public task views, and dispute/reveal routes that preserve task-party checks. The biggest remaining risk is that authentication is still **beta auth**, not wallet-signature-backed identity.

## High severity

### SEC-001 — Authentication is stronger now, but still not wallet-signature auth
- **Impact:** Actor-bound beta credentials reduce spoofing substantially, but any leaked actor token still allows impersonation of that specific actor.
- **Location:**
  - `apps/api/src/auth.ts:16-49`
  - `apps/api/src/server.ts:119-131`
  - `apps/web/lib/api.ts`
  - `packages/worker/src/runtime.ts`
- **Evidence:** Authentication can now bind bearer tokens to actor identity and role, and the web app no longer ships actor tokens via `NEXT_PUBLIC_*`. But the system still relies on beta credentials rather than cryptographic wallet/session proofs.
- **Fix:** Replace shared-token auth with wallet-signed nonce/session verification or a signed Midnight connector session.
- **Mitigation:** Keep the API local or in a tightly controlled beta environment; do not treat it as production-safe identity.

## Medium severity

### SEC-002 — Rate limiting is still in-memory and keyed primarily by IP
- **Impact:** Abuse is throttled in a single-process beta, but limits reset on restart and do not coordinate across instances.
- **Location:** `apps/api/src/server.ts:81-116`
- **Evidence:** The limiter stores counters in a local `Map` and keys by `bucket + request.ip`.
- **Fix:** Move rate limiting to a shared store or edge gateway and incorporate authenticated actor identity into the key.
- **Mitigation:** Single-instance beta deployment is acceptable; treat limits as beta-only.

### SEC-003 — Runtime verification exists now, but remains beta-scoped
- **Impact:** Build and smoke verification materially reduce risk, but assurance is still centered on a single local API instance and does not prove distributed or production behavior.
- **Location:** `package.json`, `scripts/smoke-api.mjs`
- **Evidence:** `pnpm typecheck`, `pnpm build`, `python3 contracts/compact/simulate_state_machine.py`, and the local API smoke flow now run successfully. The smoke flow validates redaction, authz, receipt submission, dispute blocking, and oversized payload rejection.
- **Fix:** Add automated CI execution for build + smoke, plus browser-driven verification for the UI path.
- **Mitigation:** Good enough for beta delivery and local regression checks; still not a production-grade test matrix.

## Low severity

### SEC-004 — Dispute and reveal flows are minimally protected but still lack durable audit trails
- **Impact:** The beta now preserves party checks and reveal bundle hashes, but it still relies on in-memory storage and does not provide durable non-repudiation.
- **Location:**
  - `apps/api/src/routes/disputes.ts:11-90`
  - `apps/api/src/store.ts:377-473`
- **Evidence:** Disputes and reveals are stored in process memory and keyed by UUID; reveal evidence is represented by hashes and optional refs only.
- **Fix:** Persist disputes/reveals to a durable store and bind them to wallet signatures or contract commitments.
- **Mitigation:** Adequate for current beta operation; not yet sufficient for adversarial production use.

## Improvements already applied
- Beta auth and route-level actor checks now exist for task creation, bidding, assignment, worker polling, worker acknowledgment, submission, settlement, dispute creation, and reveal submission.
- Beta auth now rejects `admin` role by default unless explicitly enabled in environment.
- CORS is narrowed to an allowlist instead of permissive reflection.
- Basic rate limiting exists for reads, mutations, worker polls, and worker submissions.
- Fastify body size is now capped for beta API requests.
- Canonical receipt submission now goes through `POST /v1/assignments/:assignmentId/submit`.
- Legacy task-scoped receipt submission has been removed.
- Worker submission recomputes and verifies action-log, artifact, and receipt hashes before accepting delivery.
- Worker submission now also recomputes and verifies `resultHash` from the submitted result payload.
- Worker submission payloads now enforce bounded JSON size/depth before hashing.
- Settlement now refuses to proceed while an open dispute exists.
- Dispute/reveal flows check that the caller is a real task party before changing state.
- Public task list and task detail responses now redact private task internals, sealed bids, receipts, and reveal metadata from non-parties.
- Local smoke verification now proves the redaction/auth/dispute/oversized-payload path against a running API instance.

## Next recommended fixes
1. Replace shared-token auth with wallet-signature or Midnight connector sessions.
2. Replace browser-stored beta tokens with wallet-signed sessions or a local secure session broker.
3. Add durable storage for disputes, reveals, and encrypted evidence bundles.
4. Add CI/browser automation around `scripts/smoke-api.mjs` and the UI flow.
