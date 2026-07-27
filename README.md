# Product Photo AI

API-first foundation for turning a faithful source product photo into styled marketing images with
Google's `gemini-2.5-flash-image` model.

The repository is a pnpm workspace:

- `apps/api` — NestJS generation engine, standalone CLI, BullMQ worker, SSE API, Prisma, and R2/local
  storage.
- `apps/web` — Next.js 15 App Router and Tailwind shell only. Product UI is intentionally out of scope.

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker with Compose
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

## Setup

```bash
pnpm install
docker compose up -d
cp apps/api/.env.example apps/api/.env
```

Set `GEMINI_API_KEY` in `apps/api/.env`, then initialize Prisma:

```bash
pnpm db:generate
pnpm db:migrate
```

The checked-in SQL migration can also be applied non-interactively:

```bash
pnpm --filter @product-photo/api prisma:deploy
```

## Phase 1: standalone prompt iteration

No HTTP server or Redis worker is involved:

```bash
pnpm generate --image ./test.jpg --category clothing --scene studio --variants 4
```

Each variant is a separate Gemini request. Local results are written under
`apps/api/output/<timestamp>/`, while cumulative cost and duration are updated in the
`generation_runs` Postgres table after every completed variant. The CLI accepts 1–8 variants.

List all valid category/scene combinations:

```bash
pnpm generate --help
```

`GEMINI_API_KEY` is checked at startup and a missing key produces an explicit error. The default cost
estimate uses output-image and input-token rates in `.env`; these are estimates, not billing records.
Update the values when [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) changes.

## Phase 2: API and queue

Start Postgres and Redis, then run the API:

```bash
docker compose up -d
pnpm --filter @product-photo/api dev
```

Enqueue a multipart upload:

```bash
curl -X POST http://localhost:3001/generations \
  -F "image=@./test.jpg" \
  -F "category=clothing" \
  -F "sceneId=studio" \
  -F "variants=4"
```

The response contains an `id` and `eventsUrl`. Stream lifecycle and per-variant events:

```bash
curl -N http://localhost:3001/generations/<id>/events
```

Events progress through:

```text
queued → analyzing → generating → variant-complete (one per image) → done
```

Failures emit `failed` and are recorded in Postgres. Jobs retry once with exponential backoff.

### Storage

With no R2 variables, uploaded sources and generated images are saved beneath
`apps/api/output/inputs/` and `apps/api/output/generations/`.

Set all four values below to use Cloudflare R2 through its S3-compatible endpoint:

```dotenv
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
```

`R2_PUBLIC_BASE_URL` is optional and is only useful when the bucket has a public/custom domain.
Partial R2 configuration deliberately falls back to local disk.

## Data model

Prisma maps `Generation` to the `generation_runs` table. It records a hardcoded `user_demo` user,
status, category, scene, source key, output keys, estimated cost, duration, failure details, and
timestamps. There is no authentication or payment logic.

## Development checks

```bash
pnpm build
pnpm lint
pnpm format:check
```

Prompt editing and experiment logging are documented in [PROMPTING.md](./PROMPTING.md).
