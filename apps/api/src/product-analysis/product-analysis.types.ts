import { FIDELITY_BLOCK, type ProductCategory } from '../generation/styles.config';

/** A scene concept authored by the vision model for one specific product. */
export interface ProductSceneConcept {
  id: string;
  name: string;
  rationale: string;
  environment: string;
  lighting: string;
  camera: string;
  props: string;
  mood: string;
}

export interface ProductAttributes {
  materials: string[];
  dominantColors: string[];
  finish: string;
  shapeAndScale: string;
  visibleText: string[];
  /** Physical facts that constrain lighting or staging, e.g. "translucent glass". */
  handlingNotes: string[];
  forbiddenEnvironments: string[];
}

export interface ProductAnalysisResult {
  id: string;
  category: ProductCategory;
  productType: string;
  productClass: string;
  summary: string;
  confidence: number;
  attributes: ProductAttributes;
  scenes: ProductSceneConcept[];
  model: string;
  costUsd: number;
  createdAt: string;
}

export const AI_SCENE_PREFIX = 'ai:';

export function isAiSceneId(sceneId: string): boolean {
  return sceneId.startsWith(AI_SCENE_PREFIX);
}

export function aiSceneKey(sceneId: string): string {
  return sceneId.slice(AI_SCENE_PREFIX.length);
}

/**
 * Builds the scene prompt for an AI-authored concept. Mirrors the shape of the hand-written presets
 * in styles.config so the downstream prompt assembly is identical either way.
 */
export function composeAiScenePrompt(
  scene: ProductSceneConcept,
  analysis: ProductAnalysisResult,
): string {
  const handling = analysis.attributes.handlingNotes.length
    ? analysis.attributes.handlingNotes.map((note) => `- ${note}`).join('\n')
    : '- No special handling constraints were detected; use standard commercial lighting discipline.';
  const forbidden = analysis.attributes.forbiddenEnvironments.length
    ? `\nDo not place the product in any of these settings: ${analysis.attributes.forbiddenEnvironments.join(', ')}.`
    : '';

  return `${FIDELITY_BLOCK}

Create a premium commercial photograph of this exact product in the art-directed scene below. The scene
was designed for this specific product; honour it precisely while keeping the product itself unchanged.

SCENE — ${scene.name}:
Environment: ${scene.environment}
Lighting: ${scene.lighting}
Camera: ${scene.camera}
Supporting props: ${scene.props}
Mood: ${scene.mood}

PRODUCT-SPECIFIC HANDLING:
${handling}

Every prop must stay clear of the product's branding, labels, and printed text; nothing may overlap,
touch, or cast a shadow across them. Build the environment described above rather than a generic studio
sweep, and keep the product unmistakably the hero of the frame.${forbidden}`;
}
