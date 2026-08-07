# Security & Correctness Audit — Aluna

**Date:** 4 August 2026 · **Branch:** `codex/complete-aluna-platform` · **HEAD:** `5acc3b7`
**Scope:** Full working tree, *including uncommitted changes* (see §0).

**Method:** manual review of every authentication, authorization, quota, storage, and credential
path; plus `tsc --noEmit` (API + web), `eslint`, and `pnpm audit --prod`.

| Check | Result |
| --- | --- |
| `tsc --noEmit` — apps/api | **Pass** (exit 0) |
| `tsc --noEmit` — apps/web | **Pass** (exit 0) |
| `eslint src/**/*.ts` — apps/api | **Pass** (exit 0) |
| `pnpm audit --prod` | **5 advisories** — 3 high, 2 moderate |

Findings: **4 high · 7 medium · 8 low**.

---

## 0. Working tree is not clean

The audit began against a clean tree; partway through, uncommitted work appeared. Everything below
reflects the **current working tree**, not `HEAD`.

```
 M apps/api/prisma/schema.prisma
 M apps/api/src/admin/admin.controller.ts
 M apps/api/src/admin/admin.service.ts          (525 → 602 lines)
 M apps/api/src/generation/generation.service.ts
 M apps/web/app/admin/page.tsx
?? apps/api/prisma/migrations/20260804020000_admin_waitlist_and_credentials/
?? apps/api/src/admin/dto/{admin-waitlist-query,update-provider-credentials,update-waitlist-subscriber}.dto.ts
?? apps/web/app/admin/[section]/
```

This adds two features: waitlist management, and **runtime provider-credential storage** — accepting
Cloudflare/Gemini/OpenAI API keys over HTTP and persisting them encrypted in Postgres.

**Three of the four high-severity findings are in this uncommitted code.** It is the newest and
least-reviewed surface in the repo, and it handles the most sensitive material. Review it before
committing.

---

## HIGH

### H-1 · `sharp` 0.34.5 has known libvips CVEs, reachable directly from user uploads

**Where:** [apps/api/package.json](apps/api/package.json) → `"sharp": "^0.34.5"` (installed: 0.34.5)

`pnpm audit` reports:

> **HIGH** — sharp `<0.35.0` → `>=0.35.0` — sharp inherited vulnerabilities in libvips:
> CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591

This is not a transitive build-time dependency. Uploaded image bytes are passed straight to libvips:

```ts
// generation.service.ts:838, 846 — `image` is the user-uploaded buffer
const metadata = await sharp(image).metadata();
const prepared = await sharp(image)…
```

Any authenticated customer can submit a crafted image (up to 15 MB) that reaches a vulnerable
libvips parser in the API process — which is also the worker process, and holds the provider API
keys in memory.

**Fix:** bump to `sharp ^0.35.0` and re-run `pnpm audit`.

---

### H-2 · Generation quota enforcement is a TOCTOU race — the cost control can be bypassed

**Where:** [generations.controller.ts:248-320](apps/api/src/generations/generations.controller.ts#L248)

`enforceGenerationPolicy()` runs three `count()` queries, returns, and *then* the caller creates the
`Generation` row and enqueues the job:

```ts
await this.enforceGenerationPolicy(request.user.id, dto.variants);   // reads
…
await this.prisma.generation.create({ … });                          // writes, much later
```

There is no transaction, no row lock, and no unique constraint standing in for one. N concurrent
`POST /generations` requests all observe the pre-request counts and all pass.

**Failure scenario:** a user with `requestLimitPerHour: 10` and `maxConcurrentRequests: 1` fires 50
parallel requests. All 50 counts are computed before any row is inserted, so all 50 are admitted —
5× the hourly quota and 50× the concurrency limit, in one burst.

This matters more than a typical race: these limits are the **only thing metering spend on paid
image-generation APIs**. Bypassing them is bypassing the billing safeguard.

**Fix:** move the check and the insert into one `$transaction` with `SERIALIZABLE` isolation, or take
a per-user advisory lock (`pg_advisory_xact_lock(hashtext(userId))`) before counting.

---

### H-3 · Provider API keys are encrypted with a key that has a publicly-known default

**Where:** [generation.service.ts:337-341](apps/api/src/generation/generation.service.ts#L337)

```ts
private encryptionKey(): Buffer {
  const root = this.config.get<string>('JWT_ACCESS_SECRET');
  if (!root) throw new Error('JWT_ACCESS_SECRET is required to protect provider credentials');
  return createHash('sha256').update(`aluna-provider-credentials:${root}`).digest();
}
```

The AES-256-GCM construction itself is correct — random 12-byte IV per encryption, auth tag stored,
no IV reuse. The problem is the key.

**Three distinct defects:**

**(a) Public default outside production.** [env.validation.ts:38](apps/api/src/config/env.validation.ts#L38)
defaults `JWT_ACCESS_SECRET` to the literal `aluna-development-access-secret-change-me-2026` — a
string committed to this repository in two places. Any deployment not running `NODE_ENV=production`
(staging, a preview environment, a misconfigured container) encrypts every stored provider API key
with a key that anyone reading the repo can derive. Read access to `platform_settings` then yields
plaintext OpenAI/Gemini/Cloudflare keys.

**(b) Rotating the JWT secret silently destroys all stored credentials.** `render.yaml` uses
`generateValue: true` for `JWT_ACCESS_SECRET`. Rotating it — a routine security action, and
unavoidable if the service is recreated from the blueprint — makes every stored credential
permanently undecryptable. `decryptSecret()` swallows the failure and returns `undefined`
([:358](apps/api/src/generation/generation.service.ts#L358)), so `loadStoredCredentials()` quietly
falls back to environment variables, while `getProviderCredentialStatuses()` still reports
`source: 'dashboard'`, `configured: true` — because that status is computed from the *presence* of the
ciphertext, never from whether it decrypts. Generation breaks; the dashboard says everything is fine.

**(c) Wrong key for the job.** An authentication signing key and a data-encryption key have different
rotation schedules and different blast radii. They should not be the same value.

**Fix:** introduce a dedicated `CREDENTIALS_ENCRYPTION_KEY` (32 random bytes, required whenever
credential storage is enabled — no default, in any environment). Have `getProviderCredentialStatuses`
report `configured` based on a successful decrypt, so (b) surfaces loudly instead of silently.

---

### H-4 · No rate limiting anywhere in the API

**Where:** whole application — `@nestjs/throttler` is not a dependency, and no equivalent exists.

Unauthenticated, unthrottled endpoints:

| Endpoint | Exposure |
| --- | --- |
| `POST /auth/login` | Unlimited password guessing against a known admin email |
| `POST /analytics/visits` | Unlimited writes to `site_visits` (see M-1) |
| `POST /waitlist` | Unlimited writes / PII enumeration |

Login is the sharpest edge. bcrypt cost 12 provides some natural throttling, but that cuts both ways:
it also makes `POST /auth/login` an effective CPU-exhaustion vector against a single free-tier
instance that is *also* the image-generation worker.

**Fix:** add `@nestjs/throttler` globally, with a strict per-IP limit on `/auth/login` specifically.

---

## MEDIUM

### M-1 · The admin dashboard's traffic analytics are unauthenticated and forgeable

**Where:** [analytics.controller.ts:11](apps/api/src/analytics/analytics.controller.ts#L11),
[create-site-visit.dto.ts](apps/api/src/analytics/dto/create-site-visit.dto.ts)

`POST /analytics/visits` is `@Public()`. The only identity is `visitorId`, a **UUID the client
generates for itself**. Deduplication is 5 seconds per `(visitorId, path)` — trivially defeated by
minting a fresh UUID per request.

Consequences: "unique visitors", "site visits", "popular routes", and "device mix" on the operations
dashboard are attacker-controlled. `path` need only match `^\/(?!\/)`, so arbitrary strings can be
injected into the top-pages list. There is also **no retention policy** on `site_visits`, so this is
unbounded growth on a free Postgres plan.

The README states dashboard metrics "come from Postgres, Redis, and the configured generation
runtime; none of the metrics are hardcoded" — true, but this particular source is untrusted input,
and the UI does not distinguish it from the trustworthy generation data.

*Not* an XSS risk: no `dangerouslySetInnerHTML` anywhere in `apps/web`, so React escapes the injected
paths. Verified.

**Fix:** rate-limit per IP, add a retention/aggregation job, and mark bot-classified traffic as
excluded from headline figures.

### M-2 · Tokens in `localStorage`; no refresh-token reuse detection

**Where:** [auth-client.ts](apps/web/app/lib/auth-client.ts#L26-L50), [auth.service.ts:89-95](apps/api/src/auth/auth.service.ts#L89)

Access **and** refresh tokens are stored in `localStorage`/`sessionStorage`. Any XSS in the Studio or
admin dashboard yields a 7-day refresh token, not just a 15-minute session.

Separately, rotation is single-use — `updateMany({ revokedAt: null })` then `count !== 1` correctly
rejects a replayed token — but reuse is treated as an ordinary expiry, not as evidence of theft. A
stolen token used *before* the legitimate user's next refresh silently succeeds; the victim gets a
generic "session expired" and re-logs-in, unaware.

**Fix:** move refresh tokens to `httpOnly; Secure; SameSite=Strict` cookies. On detected reuse, revoke
every session for that user and log a security event.

### M-3 · Login timing discloses whether an account exists

**Where:** [auth.service.ts:51](apps/api/src/auth/auth.service.ts#L51)

```ts
if (!user || !(await compare(dto.password, user.passwordHash))) {
```

Short-circuit evaluation skips bcrypt entirely for a non-existent email. With cost 12 the difference
is tens to hundreds of milliseconds — a reliable oracle over the network. The error *message* is
correctly generic; the timing is not.

**Fix:** compare against a fixed dummy hash when no user is found, so both paths pay the same cost.

### M-4 · The Cloudflare neuron budget guard has the same race, and only holds at concurrency 1

**Where:** [generation.service.ts:918-945](apps/api/src/generation/generation.service.ts#L918)

`assertCloudflareDailyBudget()` sums `providerUsageUnits` for today, then acts. But
`providerUsageUnits` is written only *after* a variant completes, so in-flight work contributes zero
to the total. Today this is masked entirely by `@Processor(GENERATION_QUEUE, { concurrency: 1 })`.

**This is load-bearing.** The obvious scaling fix — extracting the worker and raising concurrency —
silently breaks both this budget guard and the quota check in H-2. Two independent spend controls
depend on an implementation detail that is documented nowhere.

**Fix:** reserve estimated units at enqueue time rather than crediting them at completion, and fix
H-2 first — before any concurrency change.

### M-5 · Credential and provider state is cached per-process with no invalidation

**Where:** [generation.service.ts:321-335](apps/api/src/generation/generation.service.ts#L321)

`loadStoredCredentials()` writes to instance fields (`this.openAi`, `this.geminiApiKey`,
`this.cloudflareApiToken`, `this.cloudflareAccountId`). It runs at boot and after a credential
update — on **that instance only**. With two or more API instances, saving a credential on instance A
leaves instance B serving the old value indefinitely. There is no pub/sub, TTL, or re-read.

Invisible on the current single-instance free plan; a silent, hard-to-diagnose failure the moment the
service is scaled — which is the recommended next step.

### M-6 · `GET /admin/provider-credentials` returns the last 4 characters of live API keys

**Where:** [generation.service.ts:245](apps/api/src/generation/generation.service.ts#L245)

```ts
lastFour: typeof metadata[key] === 'string' ? metadata[key] : value?.slice(-4) || null,
```

For dashboard-saved credentials this reads a stored 4-char hint — fine. But for credentials supplied
via **environment variables** there is no metadata entry, so it falls through to `value?.slice(-4)` —
the last four characters of the live secret, read out of process config and sent to the browser.

Admin-only and only 4 characters, so exploitability is low. But it is unnecessary, it contradicts the
README's explicit promise that "provider secrets remain server-side", and it puts real key material
into browser memory, HTTP logs, and any proxy in between.

**Fix:** derive the hint at write time only; never slice a live env secret.

### M-7 · `GENERATION_PROVIDER=auto` cannot see dashboard-stored credentials

**Where:** [generation.service.ts:189](apps/api/src/generation/generation.service.ts#L189) vs
[:192](apps/api/src/generation/generation.service.ts#L192)

```ts
this.defaultProvider = this.resolveDefaultProvider();   // constructor
…
async onModuleInit() { await this.loadStoredCredentials(); }   // later
```

`resolveDefaultProvider()` reads `this.cloudflareAccountId` / `this.geminiApiKey`, which at
constructor time hold **environment values only**. `defaultProvider` is `readonly` and never
recomputed. So on a fresh database with `GENERATION_PROVIDER=auto` and credentials supplied purely
through the new dashboard, `auto` resolves to its last-resort fallback (`openai`) and stays there.

Compounding it: `getRuntimeConfiguration()` prefers `platformSetting.generationProvider`, whose column
default is `'cloudflare'`. The first call to `setProviderCredentials()` upserts a row **without**
setting that column, so it silently materializes as `'cloudflare'` — permanently overriding whatever
`GENERATION_PROVIDER` says in the environment, with no indication in the UI or logs.

**Fix:** recompute the auto-resolution after `loadStoredCredentials()`, and make the env-vs-database
precedence explicit in both the code and the dashboard.

---

## LOW

- **L-1 · Worker runs in-process at concurrency 1.** `GenerationProcessor` is registered in the same
  `AppModule` as the HTTP controllers. One image at a time platform-wide; on Render's free tier the
  service sleeps and the worker sleeps with it. (See M-4 before changing this.)
- **L-2 · No reconciliation for orphaned runs.** `render.yaml` provisions a Key Value instance with no
  persistence. BullMQ *is* the job store — a Redis restart strands `Generation` rows in
  `QUEUED`/`GENERATING` forever. Nothing sweeps them.
- **L-3 · No CI.** No `.github/`. `build`, `lint`, `format:check`, and `test:system` all exist and all
  pass; nothing runs them automatically.
- **L-4 · Provider request path is never tested.** The single 567-line smoke suite deliberately uses
  malformed image bytes to avoid spending credits — so image normalization, provider calls, and cost
  accounting are exercised only by hand.
- **L-5 · postcss advisories (3, transitive via `next`).** Build-time only; no user-supplied CSS is
  processed. Real but low priority — resolves with a Next.js bump.
- **L-6 · `ensureSuperAdmin` re-escalates on restart.** Outside production, if the demo account exists
  it is force-set to `role: SUPER_ADMIN, isActive: true`
  ([auth.service.ts:188](apps/api/src/auth/auth.service.ts#L188)) — so deactivating it does not
  survive a restart.
- **L-7 · Email change does not revoke sessions.** `users.update()` revokes on password change but not
  on email change ([users.service.ts:175](apps/api/src/users/users.service.ts#L175)).
- **L-8 · Waitlist upsert allows overwriting an existing subscriber's `locale`/`source`** by anyone
  who guesses the phone number ([waitlist.service.ts:10](apps/api/src/waitlist/waitlist.service.ts#L10)).

**Noted, not a finding:** the campaign `brief` (≤500 chars) is concatenated into the generation
prompt, fenced with an explicit precedence instruction ("only where it does not conflict with product
fidelity"). For image models this is adequate; worth revisiting if a text model is ever added to the
pipeline.

---

## What is solid

These were specifically checked and are correct — worth recording so they don't get "fixed" later:

- **Default-deny authorization.** `JwtAuthGuard` and `PermissionsGuard` are registered as global
  `APP_GUARD`s, so a controller must *opt out* via `@Public()`. All five public endpoints (login,
  refresh, logout, health, waitlist, analytics) were verified as intentional.
- **Ownership isolation is enforced in the query,** not by filtering after the fetch:
  `where: { id, ...(canReadAll ? {} : { userId: request.user.id }) }`. No IDOR on generations, results,
  source images, or the SSE stream.
- **Ban state is checked in three places** — login, refresh, and the per-request guard — so a mid-session
  ban takes effect on the next request rather than the next login.
- **Refresh tokens are hashed at rest (SHA-256), compared with `timingSafeEqual`,** and rotation is
  atomic and single-use via `updateMany(… revokedAt: null)` + `count !== 1`.
- **Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted` + `transform`,** and every DTO
  bounds its inputs. No mass-assignment surface; `users.create()` hardcodes `role: Role.USER`.
- **The Super Admin account is protected** from edit, suspend, access-change, and delete.
- **No path traversal in storage.** Keys are server-generated; the one user-influenced component is
  `extname(originalName)`, which is basename-scoped and cannot yield a separator.
- **Result indexing is safe** — `outputKeys[index - 1]` behind `ParseIntPipe`; out-of-range and
  negative values land on `undefined` → 404.
- **No raw SQL anywhere**; Prisma parameterizes all queries, including the admin `search` filters.
- **No `dangerouslySetInnerHTML`** in the web app.
- **No secrets committed.** Only `.env.example` files are tracked; `output/`, `.env`, and `work/` are
  correctly ignored.
- **AES-256-GCM is used correctly** — fresh random IV per encryption, auth tag verified on decrypt.
  The construction is sound; only the key derivation is wrong (H-3).

---

## Recommended order

1. **H-1** — bump `sharp` to `^0.35.0`. One line, removes a directly-reachable high-severity CVE.
2. **H-2** — wrap the quota check and insert in one transaction. Restores the spend control.
3. **H-3** — split out `CREDENTIALS_ENCRYPTION_KEY`; make status reflect a real decrypt. Do this
   *before* the credential feature is committed and any real key is stored under the current scheme.
4. **H-4** — add `@nestjs/throttler`, strictest on `/auth/login`.
5. **M-7, M-6** — correctness and leak fixes in the same uncommitted feature; cheap while it is still
   in flight.
6. **L-3** — add CI running the four checks that already pass, so findings 1-5 stay fixed.
7. **M-4, M-5, L-1, L-2** — treat as one workstream. Extract the worker, and fix the reservation
   model, cross-instance invalidation, and orphan sweep *together* — none of them is safe alone.
