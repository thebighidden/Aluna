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
- A Cloudflare account with Workers AI enabled, a Google Gemini API key, or an OpenAI project API key

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
`generation_runs` table after each completed variant. The CLI accepts 1–12 variants.

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

Google Nano Banana is available for higher-fidelity product editing:

```dotenv
GENERATION_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
GEMINI_IMAGE_OUTPUT_COST_USD=0.039
```

Use `GENERATION_PROVIDER=auto` to prefer Cloudflare when its account ID and API token are present,
then Google Gemini, then OpenAI. The Super Admin can switch new jobs between every configured
provider from System health; provider secrets remain server-side.

## Studio workflow

The Studio is a real API client, not a simulated interface:

1. Sign in and upload a PNG, JPG, or WEBP source image up to 15 MB.
2. Select one of six categories and its three scene presets.
3. Choose detailed creative controls. Clothing supports on-model, ghost-mannequin, and flat-lay
   presentation plus adult model gender, age, appearance, body build, hair, expression, pose, and
   framing. Every category supports mood, composition, camera, lighting, palette, and variation
   strength.
4. Optionally add a short campaign brief and choose 1–12 variants.
5. The API stores the source, creates a Postgres record, and queues the BullMQ job in Redis.
6. The Studio polls protected job status and reveals each generated variant as it completes.
7. Results remain available in Campaigns, Asset library, and Generation history.

The sidebar also includes scene presets, generation history, and personal account settings. Every
customer account is an independent, single-person Studio workspace.

## Admin operations dashboard

The single Super Admin can use the responsive dashboard to manage all customer accounts from
desktop or mobile. Its data comes from Postgres, Redis, and the configured generation runtime;
none of the metrics are hardcoded. It includes:

- Request, image, provider-unit, cost, success-rate, and duration summaries for 7, 30, or 90 days.
- Daily generation volume, first-party site visits, unique visitors, popular routes, device mix,
  product-category allocation, and per-user consumption.
- A complete, searchable generation ledger with secure source/output previews, creative settings,
  provider telemetry, duration, cost, and failure details.
- User creation, editing, password reset, permanent deactivation/reactivation, hour/day timed bans,
  safe deletion, login activity, and a protected Super Admin identity.
- Enforced per-user hourly and daily request quotas, maximum images per request, and concurrent-job
  limits, with current allowance usage visible in the user manager.
- Per-user requests, completed images, provider units or tokens, estimated spend, failures, and
  last activity.
- BullMQ worker/queue health, storage mode, model defaults, and classified provider failures.
- A persisted global model selector for Cloudflare FLUX.2, Google Nano Banana, and OpenAI.
- Cloudflare neuron usage, estimated remaining daily demo images, provider mix, and internal
  list-price estimates.
- Optional reconciliation with the OpenAI organization Usage and Costs APIs when
  `OPENAI_ADMIN_KEY` is configured. Without it, the dashboard clearly labels local cost estimates.

The optional admin key stays on the API server and is never sent to the browser.

## Authentication and account access

Authentication uses short-lived JWT access tokens plus rotated, hashed refresh sessions stored in
Postgres. A new login revokes the previous session, so each account can be active on only one
device/browser at a time. Nest guards isolate every customer's generations and assets.

| Account type | Access                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Super Admin  | The only administrative account; manages users and sees all usage, cost, generations, and system health |
| User         | Full control of their own Studio campaigns, variants, history, assets, presets, and settings            |

Auth endpoints:

```text
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

Only the Super Admin can use the customer-management endpoints:

```text
GET   /users
POST  /users
PATCH /users/:id
PATCH /users/:id/status
PATCH /users/:id/access
DELETE /users/:id
```

The live operations endpoint requires `analytics:read`:

```text
GET /admin/overview?days=7|30|90
GET /admin/generations?take=100&skip=0&status=DONE&userId=...&search=...
PATCH /admin/generation-provider

# Public, privacy-safe page-view collector
POST /analytics/visits
```

## Generation API

All generation endpoints require `Authorization: Bearer <access-token>`.

```text
GET  /generations/presets
GET  /generations/configuration
GET  /generations
POST /generations
GET  /generations/:id
GET  /generations/:id/input
GET  /generations/:id/results/:index
GET  /generations/:id/events
```

`POST /generations` accepts multipart fields `image`, `category`, `sceneId`, `variants`, optional
`brief`, and optional JSON `options`. Queue events progress through:

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

Prisma stores `User`, `RefreshSession`, `Generation`, `PlatformSetting`, `SiteVisit`, and
`WaitlistSubscriber` records. User records include timed-ban state and enforceable generation
allowances. The singleton platform setting persists the Super Admin's active generation provider.
Generation records include immutable owner snapshots, provider, status, category, scene, campaign
brief, source/output keys, requested/completed variants, model settings, provider-specific usage
units, detailed OpenAI token usage when applicable, estimated cost, duration, classified errors, and
timestamps. Site visits use an anonymous browser identifier and never store raw IP addresses.
Checked-in SQL migrations create the complete local schema.

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

The reusable system suite exercises authentication and refresh rotation, role boundaries, Super
Admin protection, user edit/suspend/reactivate/delete controls, deleted-user audit preservation,
traffic analytics, secure source previews, validation, waitlist idempotency, all 18 scene presets,
queue processing, provider-error classification, persisted provider configuration, and admin
analytics.
Routine verification deliberately uses malformed image bytes so it never spends external provider
credits. It creates uniquely named fixtures and removes them after the run.

Prompt editing and experiment logging are documented in [PROMPTING.md](./PROMPTING.md).

## Hosted deployment

The checked-in deployment configuration uses a low-cost demo topology:

- Vercel deploys `apps/web` as the Next.js project.
- Render deploys the NestJS API and BullMQ processor in one web service, plus managed Postgres and
  a Redis-compatible Key Value instance from `render.yaml`.
- Cloudflare R2 stores source and generated product images.
- Cloudflare DNS routes `aluna.thebighidden.com` to Vercel and
  `api.aluna.thebighidden.com` to Render.

Create the Render Blueprint from this repository and provide every `sync: false` secret when
prompted. The free Render plans are suitable only for initial acceptance testing: the web service
can sleep, Key Value has no persistence, and the free Postgres database expires. Upgrade the API to
Starter, Postgres to Basic, and Key Value to a persistent paid plan before production use.

Create a Vercel project from the same repository with `apps/web` as its Root Directory. Set
`ALUNA_API_ORIGIN=https://api.aluna.thebighidden.com` for Production, then assign
`aluna.thebighidden.com` to the project. `NEXT_PUBLIC_API_URL` can remain unset so browser requests
use the same-origin `/api` rewrite.

The production API requires a bootstrap Super Admin email and a password of at least 12 characters.
After the first successful startup, that account is stored in Postgres; the bootstrap variables do
not overwrite it on later deployments.
