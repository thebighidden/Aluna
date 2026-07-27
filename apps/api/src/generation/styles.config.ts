export const FIDELITY_BLOCK = `
PRODUCT FIDELITY — NON-NEGOTIABLE:
Treat the supplied product image as the sole source of truth. Preserve the product's exact silhouette,
proportions, construction, colors, surface finish, materials, stitching, hardware, packaging geometry,
logos, labels, typography, and every piece of printed text. Brand marks and text must remain legible,
correctly spelled, undistorted, and in their original position. Do not redesign, simplify, recolor,
beautify, add, remove, duplicate, crop, or cover any product feature. Only the environment, supporting
props, camera framing, and physically plausible lighting may change. Render a photorealistic commercial
photograph with natural contact shadows, accurate reflections, professional lighting, and realistic
optics. No illustration, CGI appearance, warped edges, invented branding, or distorted brand elements.
`.trim();

const FIDELITY_SLOT = '{FIDELITY_BLOCK}' as const;

export interface ScenePreset {
  readonly id: string;
  readonly name: string;
  readonly promptTemplate: `${string}{FIDELITY_BLOCK}${string}`;
}

export interface CategoryConfig {
  readonly label: string;
  readonly scenes: readonly [ScenePreset, ScenePreset, ScenePreset];
}

export const STYLES_CONFIG = {
  clothing: {
    label: 'Clothing',
    scenes: [
      {
        id: 'studio',
        name: 'Editorial Studio',
        promptTemplate: `${FIDELITY_SLOT}

Create a premium fashion e-commerce hero image of this garment in a spacious warm-white cyclorama
studio. Present it naturally on an invisible mannequin or carefully shaped ghost form so the original
cut, drape, sleeve length, collar, hems, and closures are completely clear. Use a large diffused key
light from camera-left, gentle fill, and a controlled rim light that reveals the true fabric texture
without changing its color. Keep the composition minimal, centered, and full-product, with a soft
grounding shadow and generous negative space. Camera: 85 mm product lens, eye level, crisp detail,
neutral white balance, luxury catalogue finish.`,
      },
      {
        id: 'street',
        name: 'Modern Street',
        promptTemplate: `${FIDELITY_SLOT}

Photograph the garment as the unmistakable hero of a refined urban fashion campaign. Show it being worn
in a natural, anatomically correct way by a model whose face is outside the frame, on a quiet contemporary
stone-and-glass streetscape just after sunrise. Pose and styling must reveal the entire garment without
folds hiding logos, graphics, pockets, or construction details. Use soft directional daylight, subtle
background motion blur, and a low-contrast city palette that does not contaminate the garment's true
colors. Camera: 50 mm, slightly low eye line, shallow but sufficient depth of field, candid premium
editorial realism.`,
      },
      {
        id: 'detail',
        name: 'Material Detail',
        promptTemplate: `${FIDELITY_SLOT}

Create a tactile luxury campaign photograph focused on the garment's workmanship while still showing
enough of its full form to identify the product. Arrange the unchanged garment in a deliberate, natural
drape on a matte travertine surface with one restrained tonal textile prop placed well away from all
branding. Use raking side light to reveal the authentic weave, seams, stitching, fasteners, and printed
details; retain realistic micro-shadows and absolutely true color. Compose an elegant three-quarter
overhead frame with selective depth of field, avoiding artificial smoothness or exaggerated texture.`,
      },
    ],
  },
  cosmetics: {
    label: 'Cosmetics',
    scenes: [
      {
        id: 'vanity',
        name: 'Luxury Vanity',
        promptTemplate: `${FIDELITY_SLOT}

Create a polished beauty-campaign still life on pale honed stone beside a softly lit vanity mirror.
Place the exact cosmetic product upright and unobstructed, with its label square to camera and every word
readable. Add only restrained supporting details: a clean folded linen edge and a faint warm reflection,
never touching the product. Shape the package with a large diffused key, slim edge highlights appropriate
to its real material, and a soft natural contact shadow. Use an 85 mm macro-capable lens, shallow depth of
field behind the label plane, creamy neutral background, and high-end skincare advertising restraint.`,
      },
      {
        id: 'water',
        name: 'Fresh Water',
        promptTemplate: `${FIDELITY_SLOT}

Stage the cosmetic product on a clear, shallow water surface in a clean daylight set. Create subtle
concentric ripples and a few physically plausible droplets on the surrounding surface, but keep droplets
off all logos, type, openings, and functional details. A soft sky-blue-to-white background and refracted
caustics may suggest freshness while the package color remains exact. Illuminate with broad overhead
daylight plus controlled side cards for accurate glass, plastic, or metal reflections. Front three-quarter
view, label fully readable, crisp premium beauty photography, no floating product.`,
      },
      {
        id: 'botanical',
        name: 'Botanical Editorial',
        promptTemplate: `${FIDELITY_SLOT}

Build a sophisticated botanical beauty scene around the product using only two or three fresh, unbranded
leaves and a muted mineral slab. Infer no ingredients and make no medical or environmental claims. Keep
all foliage behind or beside the package so the product outline, cap, dispenser, logo, and full label are
visible. Filter late-morning window light through leaves to create delicate background shadows without
casting patterns across printed text. Use a 70 mm lens, refined asymmetrical composition, natural greens,
neutral color science, and subtle editorial depth.`,
      },
    ],
  },
  food: {
    label: 'Food',
    scenes: [
      {
        id: 'table',
        name: 'Appetizing Table',
        promptTemplate: `${FIDELITY_SLOT}

Create an inviting premium food-advertising photograph with the packaged product as the central hero on a
warm oak table. Keep the package sealed, pristine, upright, and facing camera with all nutrition-facing
brand artwork that is visible in the source reproduced exactly. Surround it sparingly with neutral table
elements and, only if the food itself is visibly established by the source, a small plausible serving
placed separately; do not invent flavors or ingredients. Use soft side-window light, realistic crumbs
only where appropriate, gentle steam only when logically appropriate, and rich but true-to-product color.
Camera: 50 mm, table height, appetizing natural depth and contact shadows.`,
      },
      {
        id: 'kitchen',
        name: 'Bright Kitchen',
        promptTemplate: `${FIDELITY_SLOT}

Photograph the exact food product in a bright contemporary home kitchen during morning preparation.
Position the package in sharp focus on a clean stone island, fully visible and unobstructed, while a
subtle out-of-focus human gesture in the deep background provides life without touching the product.
Props must be generic, minimal, and consistent only with information visibly present on the packaging.
Use honest daylight from a large window, soft bounce fill, natural white balance, and a 50 mm lens at
counter height. The mood is fresh, trustworthy, and editorial rather than overly styled.`,
      },
      {
        id: 'graphic',
        name: 'Bold Color',
        promptTemplate: `${FIDELITY_SLOT}

Create a bold yet photorealistic grocery campaign image on a seamless color-block set. Choose a background
hue that contrasts with, but does not reflect onto or alter, the package's authentic colors. Stand the
product upright with the principal brand panel perfectly readable; add simple geometric platforms and one
long controlled shadow for graphic energy, with nothing crossing the silhouette. Use hard late-afternoon-
style key light balanced by neutral fill, precise edges, a straight-on 70 mm perspective, and ample clean
space suitable for advertising copy. Avoid surreal food explosions or invented ingredients.`,
      },
    ],
  },
  jewelry: {
    label: 'Jewelry',
    scenes: [
      {
        id: 'velvet',
        name: 'Velvet Gallery',
        promptTemplate: `${FIDELITY_SLOT}

Create a museum-like luxury jewelry photograph on deep charcoal velvet. Arrange the exact piece in its
natural wearable geometry without changing chain length, stone count, setting, engraving, metal tone, or
clasp. Use carefully flagged softboxes to produce clean, physically accurate highlights on metal and
controlled scintillation in real stones, never adding sparkle shapes or imaginary facets. Keep the full
piece visible against the velvet with a delicate contact impression. Camera: 100 mm macro, slightly above
eye level, deep enough focus for the whole design, restrained black-to-charcoal falloff.`,
      },
      {
        id: 'marble',
        name: 'Sunlit Marble',
        promptTemplate: `${FIDELITY_SLOT}

Photograph the jewelry on pale honed marble in quiet late-afternoon sunlight. Place the exact piece with
an elegant natural curve and no overlapping elements that conceal stones, hallmarks, charms, links, or
fastenings. Let a soft architectural shadow fall in the empty background while keeping the jewelry itself
evenly legible. Preserve the real metal color and gemstone saturation with neutral fill and accurate
specular reflections. Use a 90 mm macro lens, refined top-down three-quarter composition, realistic scale,
and understated European editorial styling.`,
      },
      {
        id: 'evening',
        name: 'Evening Glow',
        promptTemplate: `${FIDELITY_SLOT}

Create an intimate evening jewelry campaign with the unchanged piece displayed on a simple matte pedestal
against a dark warm-brown gradient. A broad warm key and cool narrow rim may sculpt the form, but metal,
enamel, pearls, and stones must retain their actual colors. Use subtle practical bokeh far behind the
product—never reflected as false stones or highlights. Show every design element and the complete
silhouette in sharp focus with believable scale, sophisticated negative space, and realistic high-end
macro photography rather than fantasy sparkle effects.`,
      },
    ],
  },
  furniture: {
    label: 'Furniture',
    scenes: [
      {
        id: 'loft',
        name: 'Architectural Loft',
        promptTemplate: `${FIDELITY_SLOT}

Place the exact furniture item in a spacious, quiet architectural loft with limewashed walls, pale oak
flooring, and large north-facing windows. Preserve every dimension, joint, seam, leg, handle, cushion,
grain direction, upholstery color, and material finish. Keep the full item unobstructed with no throws or
props covering it; use only a distant neutral rug and restrained plant for scale. Soft window light and
subtle bounced fill should reveal construction accurately. Camera: full-frame 35 mm with corrected
verticals, eye-level three-quarter view, realistic room scale and contact shadows.`,
      },
      {
        id: 'minimal',
        name: 'Minimal Studio',
        promptTemplate: `${FIDELITY_SLOT}

Create a premium furniture catalogue image in a seamless warm-gray studio large enough for the object.
Show a clean three-quarter hero angle plus enough negative space to read the full silhouette and all
functional details. Use a very large overhead diffusion source, soft directional side light, and precise
black flags to reveal the product's authentic wood, metal, glass, leather, or textile texture. Maintain
straight geometry, believable weight, exact proportions, grounded feet, and neutral color. Camera:
tilt-shift corrected 50 mm perspective, sharp throughout, no wide-angle distortion.`,
      },
      {
        id: 'home',
        name: 'Lived-in Home',
        promptTemplate: `${FIDELITY_SLOT}

Integrate the exact furniture item into a tasteful, lived-in contemporary home while keeping it the clear
hero. Build the room around its real size and function, with a restrained rug, one side table, and soft
architectural background details placed so no edge, leg, cushion, door, or hardware is hidden. Use
late-morning natural window light, practical ambient warmth, and physically plausible shadows. Choose a
40 mm eye-level composition that feels inviting but still documents the product accurately; avoid
overdecorating, scale errors, or changing the product to match the room.`,
      },
    ],
  },
  electronics: {
    label: 'Electronics',
    scenes: [
      {
        id: 'tech',
        name: 'Precision Tech',
        promptTemplate: `${FIDELITY_SLOT}

Create a precise premium technology launch image on a dark graphite seamless surface. Position the exact
device at a confident three-quarter angle that exposes its ports, controls, screen, vents, materials, and
branding without inventing interface content or hardware. Use controlled strip-light reflections that
follow the real geometry, a cool soft key, neutral fill, and a clean rim separated from the background.
The device must sit with believable weight and a natural contact shadow. Camera: 85 mm product lens,
focus-stacked clarity, refined near-black palette, no neon sci-fi clutter.`,
      },
      {
        id: 'desk',
        name: 'Creative Desk',
        promptTemplate: `${FIDELITY_SLOT}

Photograph the exact electronic product in a calm contemporary creative workspace. Place it in a
physically correct use position on a clean walnut desk, with generic out-of-focus desk objects far enough
away that every port, logo, button, cable connection, screen edge, and product contour stays visible.
Do not invent content on displays; retain exactly what appears in the source or use a natural dark screen.
Use soft side-window daylight with a subtle warm practical in the background, 50 mm eye-level view, true
neutral product color, and realistic professional lifestyle photography.`,
      },
      {
        id: 'dynamic',
        name: 'Dynamic Launch',
        promptTemplate: `${FIDELITY_SLOT}

Create an energetic commercial launch photograph using a clean architectural set of matte planes and one
diagonal beam of light. Keep the exact electronic device securely grounded on a pedestal—never floating—
and orient it so primary branding and defining controls remain readable. A subtle background light trail
may suggest speed but must not cross, reflect onto, or visually alter the product. Shape real materials
with crisp controlled highlights and neutral fill. Use a 70 mm low three-quarter camera, sharp product,
gentle environmental depth, sophisticated motion energy without fantasy components.`,
      },
    ],
  },
} as const satisfies Record<string, CategoryConfig>;

export type ProductCategory = keyof typeof STYLES_CONFIG;

export function isProductCategory(value: string): value is ProductCategory {
  return value in STYLES_CONFIG;
}

export function getScene(category: ProductCategory, sceneId: string): ScenePreset | undefined {
  return STYLES_CONFIG[category].scenes.find((scene) => scene.id === sceneId);
}

export function composePrompt(category: ProductCategory, sceneId: string): string {
  const scene = getScene(category, sceneId);
  if (!scene) {
    const validScenes = STYLES_CONFIG[category].scenes.map(({ id }) => id).join(', ');
    throw new Error(`Unknown scene "${sceneId}" for ${category}. Valid scenes: ${validScenes}`);
  }

  return scene.promptTemplate.replace(FIDELITY_SLOT, FIDELITY_BLOCK);
}
