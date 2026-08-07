# Project Analysis — Aluna

> A code-level analysis of this repository: what it is, how it is built, how the pieces fit
> together, and where the structural risks are.
>
> **Analyzed:** 4 August 2026 · **Branch:** `codex/complete-aluna-platform` · **Commit:** `5acc3b7`

---

## 1. What this project is

**Aluna** is an AI product-photography platform. A seller uploads one ordinary product photo, picks a
category and a scene, and the system generates campaign-ready marketing images — while preserving the
product's shape, color, materials, logos, labels, and printed text.

The product thesis is stated in [ALUNA_PROJECT.md](ALUNA_PROJECT.md) as:

> Change the world around the product, not the product itself.

That constraint is not just marketing copy — it is enforced in code. Every scene prompt template in
[styles.config.ts](apps/api/src/generation/styles.config.ts) is typed as
`` `${string}{FIDELITY_BLOCK}${string}` ``, so TypeScript refuses to compile a scene preset that omits
the shared product-fidelity contract. It is the single most interesting design decision in the
codebase: a business rule promoted into the type system.

Despite the repository directory name (`build-the-foundation-of-an-ai`) and the root package name
(`product-photo-ai`), the shipped product is branded **Aluna** throughout.

### Scope of what is actually built

This is not a prototype. It is a complete three-surface platform:

| Surface | Route | Purpose |
| --- | --- | --- |
| Marketing site | `/` | Bilingual (EN/AR) landing page with waitlist capture |
| Studio | `/studio` | Authenticated customer workspace — upload, generate, review, history |
| Operations dashboard | `/admin` | Single Super Admin — users, quotas, cost, telemetry, system health |
| CLI | `pnpm generate` | Headless generation engine; no HTTP server, Redis, or UI required |

---

## 2. Repository shape

```
build-the-foundation-of-an-ai/          pnpm workspace, packageManager pnpm@10.12.1
├── apps/
│   ├── api/     @product-photo/api     NestJS 11 · Prisma 6 · BullMQ 5
│   └── web/     @product-photo/web     Next.js 15.5 · React 19 · Tailwind 3.4
├── docker-compose.yml                  Postgres 16 + Redis 7 (local only)
├── render.yaml                         Render blueprint: API + Postgres + Key Value
├── railway.json                        Alternate Railway deploy config
├── README.md                           Operator-facing setup and API reference
├── ALUNA_PROJECT.md                    38 KB product/brand/design source of truth
└── PROMPTING.md                        Prompt-editing and evaluation methodology
```

Roughly **18,500 lines** of tracked TypeScript/TSX/CSS/Prisma. Eight commits, all authored between
27 July and 4 August 2026 — this repo was built in about nine days.

### Size distribution (top files)

| Lines | File |
| --- | --- |
| 8,259 | [apps/web/app/globals.css](apps/web/app/globals.css) |
| 1,906 | [apps/web/app/admin/page.tsx](apps/web/app/admin/page.tsx) |
| 1,447 | [apps/web/app/studio/page.tsx](apps/web/app/studio/page.tsx) |
| 1,236 | [apps/api/src/generation/generation.service.ts](apps/api/src/generation/generation.service.ts) |
| 973 | [apps/web/app/page.tsx](apps/web/app/page.tsx) |
| 671 | [apps/api/src/generation/campaign-options.config.ts](apps/api/src/generation/campaign-options.config.ts) |

The API is cleanly decomposed into ten Nest modules. The web app is not decomposed at all — four
large page components and a single global stylesheet. See §7.

---

## 3. Architecture

```
Browser
  │
  ├── Next.js (apps/web) ── /api/:path* rewrite ──┐   next.config.ts proxies to ALUNA_API_ORIGIN
  │                                               │   so the browser talks same-origin
  ▼                                               ▼
Landing / Studio / Admin              NestJS API (apps/api)
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
      Postgres (Prisma)          Redis (BullMQ)            Storage abstraction
      users, generations,        generation queue          R2 (S3 API) or local ./output
      sessions, visits,          + QueueEvents → SSE
      platform_settings
                                        │
                                        ▼
                            GenerationProcessor (in-process)
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
            Cloudflare Workers AI   Google Gemini        OpenAI
            FLUX.2 Klein 9B         2.5 Flash Image      gpt-image-2
```

### Request lifecycle for a generation

1. `POST /generations` — multipart upload, guarded by `JwtAuthGuard` + `PermissionsGuard`.
2. `enforceGenerationPolicy()` checks ban state, per-request variant cap, hourly/daily request
   quotas, and concurrent-job limit ([generations.controller.ts:248](apps/api/src/generations/generations.controller.ts#L248)).
3. Source image is written through `StorageService` (R2 or disk); a `Generation` row is created.
4. A BullMQ job is enqueued with the generation ID as the job ID.
5. `GenerationProcessor` materializes the source, calls the provider once **per variant**, and emits
   progress after each completed image.
6. The Studio subscribes to `GET /generations/:id/events` (SSE), bridged from BullMQ `QueueEvents`
   by [generations-events.service.ts](apps/api/src/generations/generations-events.service.ts).
7. State machine: `queued → analyzing → generating → variant-complete → done`, or `failed`.

Each variant is an independent provider call, so partial results stream to the user as they land
rather than blocking on the whole batch. That is the right call for a 4–12 image job.

---

## 4. Notable subsystems

### 4.1 Multi-provider generation engine

[generation.service.ts](apps/api/src/generation/generation.service.ts) is the heart of the system.
It supports three image providers behind one interface, plus an `auto` mode that prefers Cloudflare →
Gemini → OpenAI based on which credentials are present.

What it does beyond a naive API wrapper:

- **Input normalization with `sharp`** — Cloudflare's Workers AI caps reference images at 512px, so
  sources are losslessly downscaled to a 511px max edge before submission.
- **Per-provider cost and usage accounting** — neurons for Cloudflare, tokens for Gemini/OpenAI,
  persisted per run with a `providerUsageUnit` discriminator on the `Generation` model.
- **A local daily neuron budget guard** (default 10,000, matching Cloudflare's free daily tier) that
  stops generation before the allocation is exceeded.
- **Error classification** — provider failures are mapped to stable `errorCode` values and persisted,
  which is what makes the admin dashboard's failure breakdown possible.
- **Runtime configuration introspection** — `GET /generations/configuration` reports readiness and
  which env vars are missing, *without leaking secrets*. Missing provider credentials disable
  generation but do not prevent auth, analytics, or the rest of the API from booting.

That last point is a genuinely good design choice: partial configuration degrades one feature instead
of crashing the process.

### 4.2 Prompt system

Six categories × three scenes = **18 presets**, defined in
[styles.config.ts](apps/api/src/generation/styles.config.ts):

`clothing` · `cosmetics` · `food` · `jewelry` · `furniture` · `electronics`

`CategoryConfig.scenes` is typed as a 3-tuple, so a category with two or four scenes is a compile
error. Prompts are composed from three layers: the immutable `FIDELITY_BLOCK`, the scene template,
and user-selected creative options.

[campaign-options.config.ts](apps/api/src/generation/campaign-options.config.ts) defines shared
direction groups (mood, composition, camera, lighting, palette, variation strength) plus a
clothing-specific set (presentation, model gender/age/appearance/build/hair/expression, pose,
framing). Model-casting controls apply only when presentation is `on-model`.

Per [PROMPTING.md](PROMPTING.md), each variant receives a run-specific fingerprint and provider seed
used to derive a fresh fictional adult identity — a deliberate mitigation against one default face
becoming a brand's de-facto visual identity. The doc is honest that this is a heuristic, not a
guarantee.

### 4.3 Auth and authorization

- Short-lived JWT access tokens (default 900s) + rotated, **hashed** refresh sessions in Postgres.
- Refresh rotation revokes the prior session — one active device per account, by design.
- RBAC via a permission enum ([auth.constants.ts](apps/api/src/auth/auth.constants.ts)): 13
  permissions, `SUPER_ADMIN` gets all, `USER` gets a 7-permission subset.
- Ban state (`bannedUntil`) is checked in three independent places: login, refresh, and the JWT guard
  itself — so a mid-session ban takes effect on the next request, not at next login.
- Ownership isolation is enforced per-query: `GenerationReadAll` gates whether the `userId` filter is
  applied at all, rather than filtering after fetch.

### 4.4 Data model

Six Prisma models with 11 checked-in SQL migrations. Two details worth highlighting:

- `Generation.userId` uses `onDelete: SetNull` alongside denormalized `ownerName`/`ownerEmail`
  snapshots. Deleting a user preserves the audit and cost ledger — a deliberate, correct choice for a
  system that bills by usage.
- `SiteVisit` stores an anonymous browser identifier and never raw IPs. Privacy-conscious analytics
  built in rather than bolted on.

`PlatformSetting` is a singleton row (`id` defaults to `"main"`) persisting the Super Admin's active
provider selection — so provider switching survives restarts without an env-var redeploy.

---

## 5. Frontend

Next.js 15 App Router, React 19, Tailwind 3.4. Three client components support the whole app:
`portal-login`, `language-toggle`, `site-visit-tracker`.

- **Bilingual with RTL** — `Language` is typed `'en' | 'fr' | 'ar'` but `VisibleLanguage` excludes
  `'fr'`, so French strings exist in the type space while only English and Arabic ship. Toggling to
  Arabic sets `document.documentElement.dir = 'rtl'`. Fonts: `@clr/city` (Latin, 7 weights) +
  `@fontsource/tajawal` (Arabic, 5 weights), all self-hosted.
- **Same-origin API** — `next.config.ts` rewrites `/api/:path*` to `ALUNA_API_ORIGIN`, so
  `NEXT_PUBLIC_API_URL` can stay unset in production and the browser never makes a cross-origin call.
- **GSAP** is a dependency for landing-page motion.
- OG images and before/after comparison assets are checked in as both PNG and WebP.

---

## 6. Operations and deployment

Three deployment targets are configured, which is one more than is useful (see §7):

| Config | Target | Notes |
| --- | --- | --- |
| [docker-compose.yml](docker-compose.yml) | Local | Postgres 16 + Redis 7, both with healthchecks |
| [render.yaml](render.yaml) | Render | API web service + managed Postgres + Key Value, Frankfurt |
| [railway.json](railway.json) | Railway | RAILPACK builder, `/health` check, restart-on-failure |

Vercel hosts `apps/web` with `apps/web` as Root Directory. Cloudflare DNS routes
`aluna.thebighidden.com` → Vercel and `api.aluna.thebighidden.com` → Render. R2 holds images.

Production hardening that is present: `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` (min 12
chars) become **required** when `NODE_ENV=production` via a conditional Joi schema; JWT secrets use
`generateValue: true` on Render; all provider credentials are `sync: false`. The bootstrap admin is
created once and not overwritten on later deploys.

### Admin dashboard

The operations dashboard reads live from Postgres, Redis, and the generation runtime — nothing is
hardcoded. It covers 7/30/90-day request/image/cost/success-rate summaries, daily volume, site-visit
analytics (unique visitors, popular routes, device mix), a searchable generation ledger with secure
source/output previews, full user CRUD with timed bans and enforced quotas, BullMQ queue health,
provider mix, neuron usage, and a persisted global model selector. Optional reconciliation against
the OpenAI organization Usage/Costs APIs is available when `OPENAI_ADMIN_KEY` is set; without it the
UI explicitly labels figures as local estimates.

---

## 7. Risks and observations

Ordered roughly by how much they would hurt.

**1. The worker runs in the API process, at concurrency 1.**
`GenerationProcessor` is registered in `GenerationsModule` inside the same `AppModule` as the HTTP
controllers, with `{ concurrency: 1 }`. One image at a time, platform-wide. On Render's free plan the
web service sleeps — and the worker sleeps with it, so queued jobs stall until an HTTP request wakes
the service. This is the single biggest scaling ceiling. Splitting the processor into its own service
is the natural next step; the BullMQ/Redis boundary already makes it a config change rather than a
rewrite.

**2. Development JWT secrets are Joi *defaults*, not just examples.**
[env.validation.ts](apps/api/src/config/env.validation.ts#L38-L42) defaults `JWT_ACCESS_SECRET` and
`JWT_REFRESH_SECRET` to literal strings, and `DEMO_USER_PASSWORD` to `AlunaDemo2026!`. Anything not
running with `NODE_ENV=production` silently accepts publicly-known secrets. Production is covered
(Render generates both), but a staging environment left at `NODE_ENV=development` would be trivially
forgeable. Consider making the secrets required whenever `NODE_ENV !== 'test'`.

**3. Redis has no persistence on the configured plan.**
`render.yaml` provisions a free Key Value instance, and the README acknowledges it has no
persistence. BullMQ *is* the job store — a Redis restart loses in-flight and queued generations, and
the corresponding Postgres rows are stranded in `QUEUED`/`GENERATING`. There is no reconciliation
sweep for orphaned runs.

**4. No CI.** There is no `.github/` directory. `pnpm build`, `pnpm lint`, `format:check`, and
`test:system` all exist and are documented, but nothing runs them automatically on push.

**5. Test coverage is one 567-line smoke script.**
[system-smoke.mjs](apps/api/test/system-smoke.mjs) is genuinely broad — auth and refresh rotation,
role boundaries, Super Admin protection, user lifecycle, deleted-user audit preservation, analytics,
validation, waitlist idempotency, all 18 presets, queue processing, error classification. But there
are zero unit tests, and the suite deliberately feeds *malformed image bytes* so it never spends
provider credits. That is a smart cost decision with a real consequence: the actual provider request
path, image normalization, and cost accounting are exercised only by hand.

**6. Three deployment configs will drift.** `render.yaml` and `railway.json` describe overlapping,
non-identical deployments. `render.yaml` also pins `branch: codex/complete-aluna-platform` rather
than `main`, which is a footgun once that branch is merged and deleted.

**7. Frontend monoliths.** An 8,259-line `globals.css` and a 1,906-line admin page component are past
the point where changes are safely local. The API's module discipline did not carry over to the web
app.

**8. Uploads are buffered fully in memory.** `memoryStorage()` with a 15 MB cap and `files: 1`. Fine
at current concurrency; a consideration if the worker is ever scaled out on small instances.

**9. The neuron budget guard is local-only.** Correctly documented in the README: it counts what
Aluna spent, not what the Cloudflare account spent. Usage from outside Aluna is invisible to it.

**10. Branch state.** Work sits on `codex/complete-aluna-platform`, five commits ahead of the last
shared milestone, not yet on `main`.

---

## 8. Assessment

The backend is the strong half of this codebase: clear module boundaries, a genuinely well-designed
provider abstraction with real cost accounting, permission checks that are enforced at the query
level rather than after the fact, and a data model that thinks about audit preservation and privacy
before being asked to. Encoding the product-fidelity contract as a template-literal type is the kind
of decision that prevents a whole class of future mistakes.

The gaps are the ones a nine-day build would be expected to have, and they cluster in one place:
**operational maturity**. No CI, one smoke test, a worker that cannot scale past one job, and free-tier
infrastructure that can silently lose queued work. None of these are architectural dead ends — the
queue boundary, the storage abstraction, and the provider interface all make the fixes additive.

The highest-value next steps, in order: extract the worker into its own process, add a CI workflow
running the checks that already exist, make JWT secrets mandatory outside tests, and add a
reconciliation sweep for generations orphaned by a Redis restart.
