# apps/web

Midnight-facing frontend shell for OpenShell NightShift.

Responsibilities:
- create task
- submit sealed bid
- accept bid
- review delivery receipt
- release payout / open dispute

Initial implementation reference:
- UX structure from `mortal-platform/web`
- wallet and contract interaction via Midnight-specific adapter layer

Coordination notes:
- this package now consumes `@nightshift/common` through workspace package exports
- task detail can read beta actor session cookies server-side for scoped employer/worker views
- local beta session bootstrap is available through `/api/beta/session` when `BETA_BOOTSTRAP_ENABLED=1`

Fastest local path:
- run `pnpm beta`
- open the printed local URL
- use **Start employer access session** or **Start worker access session**
