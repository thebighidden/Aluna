# Brand Profile and Creative Director plan

Aluna treats product fidelity as an invariant, the client's Brand Profile as a persistent creative
constitution, and each campaign as a new interpretation. The image provider is an execution engine;
it does not decide the product's business context by itself.

## Decision hierarchy

Every prompt and validation decision follows this order:

1. Product identity and exact visible facts.
2. Legal, safety, consent, and claim restrictions.
3. Saved Brand Profile and the exact version selected for the campaign.
4. Product/business context classification.
5. Campaign brief and customer controls.
6. Scene preset and inspiration recipe.
7. Provider creativity.

Lower levels may never override a higher level. A visually attractive result is rejected if it
changes a product, violates the brand profile, or uses a commercially incoherent environment.

## Phase 1 — persistent brand intelligence (implemented)

- One private Brand Profile per Studio account.
- Business type and subcategory, description, positioning, markets, and languages.
- Audience profile and default casting direction.
- Official logo asset, slogan, exact HEX palette, and typography names.
- Brand values, tone, photography styles, preferred environments, and forbidden environments.
- Required and forbidden visual elements.
- Default channels, aspect ratios, and campaign objectives.
- Immutable version snapshots. Every generation stores the Brand Profile version and snapshot used,
  so historical campaigns remain explainable after a client changes their identity.
- Private logo storage through the same local/R2 storage abstraction as campaign assets.

## Phase 2 — Creative Director foundation (implemented)

- Structured product context instead of relying only on a broad UI category.
- A provider-independent campaign DNA containing objective, mood, palette, environment, lighting,
  camera language, composition, audience, and a uniqueness index.
- A distinct shot plan for every requested variant.
- A semantic campaign fingerprint saved with each generation.
- A prompt compiler that merges the Brand Profile, product context, campaign DNA, scene preset,
  customer brief, creative controls, and the shared fidelity contract.
- A preview endpoint that explains classification confidence and any context correction before a
  paid image request.
- Sports-nutrition rules that classify creatine, protein, pre-workout, vitamins, and similar products
  as wellness/supplements. Food/kitchen selections are rerouted to Performance Studio rather than
  silently producing an irrelevant kitchen campaign.
- Explicit prevention of invented health claims, certifications, dosage, logos, and slogans.

## Phase 3 — multimodal product analysis (implemented)

The Product Analyst inspects the uploaded source through Gemini before queueing image generation and
returns a strict schema:

- Product class, subtype, intended use, materials, shape, colors, and packaging geometry.
- Visible logo regions and exact OCR text.
- Immutable product features and high-risk details.
- Suitable use contexts, unsafe/incoherent contexts, and classification confidence.
- Six product-specific scene concepts containing environment, light, camera, props, mood, and
  commercial rationale.

The result is stored in `product_analyses` and can feed an AI-proposed scene and the Creative Director
plan. The current interface shows confidence to the customer; an explicit low-confidence confirmation
gate remains a future hardening step.

## Phase 4 — automated fidelity and context evaluation

Every output is evaluated before release:

- OCR comparison for labels, slogans, dosage, and packaging text.
- Logo-region and product-embedding similarity.
- Color difference and silhouette/proportion checks.
- Human anatomy and garment-wearing plausibility.
- Prompt adherence and scene/product commercial coherence.
- Cross-variant and recent-campaign visual similarity.

Failed assets are rejected and regenerated within a configured attempt/cost limit. Packaging-heavy
categories should ultimately use a hybrid workflow: generate the scene, preserve or composite the
real product, then render official logo and slogan assets deterministically.

## Phase 5 — Inspiration Gallery

- Curated, licensed or Aluna-owned references only.
- Each image stores a structured style recipe: category, environment, lighting, camera, composition,
  mood, palette, props, copy-space direction, and suitability rules.
- Actions: use direction, preview with my brand, save to moodboard, and use only selected attributes.
- Brand colors and product restrictions override gallery attributes.
- Selecting the same inspiration never reuses the same complete prompt. The diversity engine changes
  several major dimensions and checks recent semantic fingerprints.

## Phase 6 — Casting Library

- Clearly labeled shared synthetic/licensed models.
- Private client-owned models with consent, usage territory, permitted uses, and expiration metadata.
- Unique generated identities reserved for one client or campaign.
- Controls for exact model, similar-but-unique model, campaign consistency, or a new identity for each
  result.
- Private model assets are never discoverable by other clients.

## Administration and measurement

The Super Admin will manage business taxonomies, context rules, required/forbidden combinations,
gallery recipes, model rights, diversity thresholds, evaluation thresholds, and regeneration budgets.
Reports should compare fidelity, approval, regeneration, cost, and conversion rates by provider,
model, business type, scene, and Brand Profile completeness.

## Verification

Run the no-cost foundation test while Postgres, Redis, and the API are running:

```bash
pnpm --filter @product-photo/api test:creative
```

The test creates and removes a temporary user, versions a sports-nutrition profile and logo, previews
the creatine scenario, verifies the kitchen correction, checks brand restrictions, and confirms that
four variants receive different shot plans. It never calls an image provider.
