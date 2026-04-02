# OpenShell NightShift — Beta Deployment

## Live endpoints

- Web: [https://openshell-nightshift.vercel.app](https://openshell-nightshift.vercel.app)
- Backend: [https://backend-preview-production.up.railway.app](https://backend-preview-production.up.railway.app)
- Backend health: [https://backend-preview-production.up.railway.app/health](https://backend-preview-production.up.railway.app/health)

## Current topology

- Vercel hosts the web control plane
- Railway hosts the API and reference worker

This is a **small-scale beta deployment topology** designed for controlled evaluation and limited public access.

## Recommended environment variables

### API / Railway

- `BETA_AUTH_REQUIRED=1`
- `BETA_ALLOW_SHARED_TOKEN=0`
- `BETA_ALLOW_ADMIN_ROLE=0`
- `BETA_ACTOR_CREDENTIALS=<json>`

### Web / Vercel

- `NIGHTSHIFT_API_BASE_URL=https://backend-preview-production.up.railway.app/v1`
- `NEXT_PUBLIC_API_BASE_URL=https://backend-preview-production.up.railway.app/v1`
- `BETA_BOOTSTRAP_ENABLED=1`
- `BETA_LOCAL_EMPLOYER_ID=0xA11cE0000000000000000000000000000000BEEF`
- `BETA_LOCAL_EMPLOYER_TOKEN=nightshift-employer-beta-token`
- `BETA_LOCAL_WORKER_ID=worker_proof_runner_3`
- `BETA_LOCAL_WORKER_TOKEN=nightshift-worker-beta-token`

## Safety notes

- actor session cookies are `httpOnly`
- workspaces are isolated per beta session
- state is scoped for limited concurrent evaluation
- this should be described as a controlled beta, not a finished production deployment
