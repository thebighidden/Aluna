# Aluna

Aluna turns one source product photo into campaign-ready marketing photography while preserving the
product's shape, color, materials, logos, labels, and printed text. This pnpm monorepo contains:

- `apps/web` — Next.js 15 landing page, authenticated Studio, and operations dashboard.
- `apps/api` — NestJS API, provider-selectable image generation engine, standalone CLI, BullMQ
  worker, Prisma, and R2/local storage.

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker with Compose
- A Cloudflare account with Workers AI enabled, or an OpenAI project API key

## Local setup

```bash
pnpm install
docker compose up -d
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Set `CLOUDFLARE_ACCOUNT_ID` and a restricted `CLOUDFLARE_API_TOKEN` in `apps/api/.env`, then
initialize Prisma and run both applications:

```bash
pnpm db:generate
pnpm --filter @product-photo/api prisma:deploy
pnpm dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Studio login: `http://localhost:3000/studio/login`
- Admin dashboard: `http://localhost:3000/admin`

For local demo access, use `demo@aluna.studio` and `AlunaDemo2026!`. Change the demo credentials and
JWT secrets before deploying. The demo owner is created automatically outside production.

## Standalone image generation

The Phase 1 engine runs without an HTTP server, Redis, or the Studio UI:

```bash
pnpm generate --image ./test.jpg --category clothing --scene studio --variants 4
```

Each variant is a separate provider image-edit request. With local storage, output is written under
`apps/api/output/<timestamp>/`; cumulative estimated cost and duration are updated in the
`generation_runs` table after each completed variant. The CLI accepts 1–8 variants.

List every category and scene ID:

```bash
pnpm generate --help
```

Provider readiness is exposed without secrets at `GET /generations/configuration`. Missing credentials
disable generation in the Studio and produce a clear CLI error without preventing authentication,
analytics, or other API features from starting.

## Image providers

Cloudflare Workers AI is the default demo provider:

```dotenv
GENERATION_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_AI_MODEL=@cf/black-forest-labs/flux-2-klein-9b
CLOUDFLARE_AI_WIDTH=1024
CLOUDFLARE_AI_HEIGHT=1024
CLOUDFLARE_AI_DAILY_NEURON_BUDGET=10000
```

The engine losslessly converts and constrains reference images below Cloudflare's 512-pixel input
limit, records estimated neurons and list-price cost per result, and stops before Aluna's configured
daily neuron budget is exceeded. The default 10,000-neuron guard aligns with Cloudflare's daily free
Workers AI allocation and resets at 00:00 UTC. Account-wide usage outside Aluna is not visible to the
local guard.

OpenAI remains available as an optional provider:

```dotenv
GENERATION_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_QUALITY=medium
OPENAI_IMAGE_SIZE=1024x1024
```

Use `GENERATION_PROVIDER=auto` to prefer Cloudflare when its account ID and API token are present,
then use OpenAI when only its key is configured. Provider secrets remain server-side.

## Studio workflow

The Studio is a real API client, not a simulated interface:

1. Sign in and upload a PNG, JPG, or WEBP source image up to 15 MB.
2. Select one of six categories and its three scene presets.
3. Optionally add a short campaign brief and choose 1–8 variants.
4. The API stores the source, creates a Postgres record, and queues the BullMQ job in Redis.
5. The Studio polls protected job status and reveals each generated variant as it completes.
6. Results remain available in Campaigns, Asset library, and Generation history.

The sidebar also includes scene presets, team roles, permission-aware controls, and workspace
settings.

## Admin operations dashboard

Owners and admins can use the responsive dashboard to manage the workspace from desktop or mobile.
Its data comes from Postgres, Redis, and the configured generation runtime; none of the metrics are
hardcoded. It includes:

- Request, image, provider-unit, cost, success-rate, and duration summaries for 7, 30, or 90 days.
- Daily volume, product-category allocation, per-user consumption, and a generation audit ledger.
- User creation, role assignment, account suspension/reactivation, and last-owner protection.
- BullMQ worker/queue health, storage mode, model defaults, and classified provider failures.
- Cloudflare neuron usage, estimated remaining daily demo images, provider mix, and internal
  list-price estimates.
- Optional reconciliation with the OpenAI organization Usage and Costs APIs when
  `OPENAI_ADMIN_KEY` is configured. Without it, the dashboard clearly labels local cost estimates.

The optional admin key stays on the API server and is never sent to the browser.

## Authentication, roles, and permissions

Authentication uses short-lived JWT access tokens plus rotated, hashed refresh sessions stored in
Postgres. Nest guards protect generation, asset, team, preset, and settings endpoints.

| Role    | Access                                                       |
| ------- | ------------------------------------------------------------ |
| Owner   | Full workspace, generation, team, and settings control       |
| Admin   | Full operational and access-management control               |
| Creator | Create campaigns, manage own assets, read team and settings  |
| Viewer  | Read assigned campaigns, assets, presets, team, and settings |

Auth endpoints:

```text
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

Team endpoints require `team:read` or `team:manage`:

```text
GET   /users
POST  /users
PATCH /users/:id/role
PATCH /users/:id/status
```

The live operations endpoint requires `analytics:read`:

```text
GET /admin/overview?days=7|30|90
```

## Generation API

All generation endpoints require `Authorization: Bearer <access-token>`.

```text
GET  /generations/presets
GET  /generations/configuration
GET  /generations
POST /generations
GET  /generations/:id
GET  /generations/:id/results/:index
GET  /generations/:id/events
```

`POST /generations` accepts multipart fields `image`, `category`, `sceneId`, `variants`, and optional
`brief`. Queue events progress through:

```text
queued → analyzing → generating → variant-complete → done
```

Failures emit `failed`, are persisted in Postgres, and retry once with exponential backoff.

## Storage

Without R2 variables, sources and generated images are saved below `apps/api/output/`. Set all four
values to use Cloudflare R2 through its S3-compatible API:

```dotenv
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
```

`R2_PUBLIC_BASE_URL` is optional. Partial R2 configuration deliberately falls back to local disk.

## Data model

Prisma stores `User`, `RefreshSession`, `Generation`, and `WaitlistSubscriber` records. Generation
records include owner, provider, status, category, scene, campaign brief, source/output keys,
requested/completed variants, model settings, provider-specific usage units, detailed OpenAI token
usage when applicable, estimated cost, duration, classified errors, and timestamps. Checked-in SQL
migrations create the complete local schema.

## Connect from a phone on the same network

Use the computer's LAN address instead of `localhost` (for example `192.168.1.20`). Set the browser's
API address in `apps/web/.env.local` and allow the phone-facing web origin in `apps/api/.env`:

```dotenv
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://192.168.1.20:3001

# apps/api/.env — keep the existing local origins too
CORS_ORIGINS=http://localhost:3000,http://192.168.1.20:3000
```

Then expose the Next.js development server on the LAN:

```bash
pnpm --filter @product-photo/web dev --hostname 0.0.0.0
```

Open `http://192.168.1.20:3000` on the phone. The Windows firewall may ask for permission the first
time; only allow access on a trusted private network.

## Development checks

```bash
pnpm build
pnpm lint
pnpm format:check
pnpm --filter @product-photo/api test:system
```

The reusable system suite exercises authentication and refresh rotation, role boundaries, last-owner
protection, user lifecycle controls, validation, waitlist idempotency, all 18 scene presets, queue
processing, provider-error classification, persisted provider configuration, and admin analytics.
Routine verification deliberately uses malformed image bytes so it never spends external provider
credits. It creates uniquely named fixtures and removes them after the run.

Prompt editing and experiment logging are documented in [PROMPTING.md](./PROMPTING.md).
