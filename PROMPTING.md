# Prompting guide

Scene presets live in `apps/api/src/generation/styles.config.ts`. The config is typed so each category
has exactly three scenes and every prompt template contains the `{FIDELITY_BLOCK}` slot.

Aluna sends the source image and composed prompt through the selected image-edit provider. Cloudflare
FLUX.2 Klein 9B is the default demo engine; GPT Image 2 remains optional. Keep provider, model,
quality, image size, and source fixtures fixed while comparing prompt revisions.

## Add or edit a scene

1. Keep the shared `FIDELITY_BLOCK` intact. It is the cross-category contract for shape, color,
   materials, logos, and printed text.
2. Edit the scene-specific environment, composition, optics, and lighting around that slot.
3. Make the `id` short and stable; IDs are persisted in `generation_runs`.
4. If replacing a scene ID, update API clients and any stored evaluation fixtures.
5. Run the same source set with the same variant count before and after the change:

   ```bash
   pnpm generate --image ./fixtures/product.jpg --category clothing --scene studio --variants 4
   ```

## What to evaluate

Inspect outputs at full resolution. Score product silhouette, proportions, true color, material
texture, logo/text accuracy, missing or invented details, lighting realism, scene relevance, and
variation between outputs. A visually attractive result is still a failure if product identity drifts.

Change one prompt idea at a time. Keep source images, model ID, scene, variant count, and relevant
environment settings fixed so comparisons remain useful.

For cross-provider evaluation, create a separate baseline rather than mixing results into one prompt
iteration. FLUX reference prompts should explicitly call the uploaded source “Image 0.” Pay special
attention to small label text, logos, garment prints, and exact package geometry; realism without
identity fidelity is a failed result.

## Creative controls and unique casting

Studio controls live in `apps/api/src/generation/campaign-options.config.ts`. Add a choice there with
a stable ID, concise customer label, and a complete prompt sentence. Defaults are stored with each
generation in `creativeOptions`, so do not rename an ID casually after launch.

For clothing, model-casting and performance controls are applied only when `presentation` is
`on-model`. Every variant also receives a run-specific fingerprint and provider seed. The prompt uses
that fingerprint to select a new fictional adult identity, facial structure, natural skin detail,
camera nuance, and lighting nuance. These values prevent a reusable default face or scene from
becoming the product's visual identity; they are not a mathematical guarantee that two providers can
never produce similar people. Evaluate facial and compositional similarity across a large batch when
changing these rules.

## Iteration log

Add one row per experiment. Use output keys or a run ID so the evidence can be recovered.

| Date       | Category / scene  | Change                                       | Source set     | Run ID / outputs | Findings                                          | Decision               |
| ---------- | ----------------- | -------------------------------------------- | -------------- | ---------------- | ------------------------------------------------- | ---------------------- |
| YYYY-MM-DD | clothing / studio | Example: stronger instruction to expose hems | fixture-set-v1 | `<run-id>`       | Note fidelity wins, regressions, and failure rate | Keep / revert / revise |

Useful findings are concrete: “3/4 outputs preserved the six-letter chest logo; the previous prompt
preserved 1/4” is actionable, while “looks better” is not.
