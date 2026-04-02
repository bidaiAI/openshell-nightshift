# apps/api

Lightweight NightShift API scaffold.

## Current responsibilities
- store task metadata in-memory
- store bids, assignments, and receipt records
- store dispute and selective-reveal records
- expose worker polling endpoints
- provide a future home for encrypted task / bid / receipt payloads
- seed a small beta dataset so the UI can render a realistic flow immediately

## Current routes
- `GET /health`
- `GET /v1/summary`
- `GET /v1/tasks`
- `POST /v1/tasks`
- `GET /v1/tasks/:taskId`
- `POST /v1/tasks/:taskId/bids`
- `GET /v1/tasks/:taskId/bids`
- `POST /v1/tasks/:taskId/assignments`
- `POST /v1/tasks/:taskId/accept`
- `POST /v1/tasks/:taskId/disputes`
- `GET /v1/assignments/poll`
- `POST /v1/assignments/:assignmentId/ack`
- `POST /v1/assignments/:assignmentId/submit`
- `POST /v1/disputes/:disputeId/reveal`

## Beta seed state
The in-memory store boots with three representative tasks:
1. one open task collecting sealed bids
2. one assigned task waiting on execution receipt
3. one settled task with a completed receipt

This keeps the first private beta usable before persistence is added.

## Implementation notes
- current storage is intentionally in-memory for early beta speed
- the next step is replacing plaintext metadata with encrypted blob references
- canonical delivery path is now `POST /v1/assignments/:assignmentId/submit`
- worker submission now recomputes `resultHash` from the submitted result payload
- disputes freeze settlement until selective reveal or manual resolution
- endpoint grouping is inspired by `mortal-platform/api/server.py`, but narrowed to the NightShift product domain
