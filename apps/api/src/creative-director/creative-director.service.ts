import { Injectable } from '@nestjs/common';
import { BrandProfile } from '@prisma/client';
import { createHash } from 'node:crypto';
import { BrandProfileService } from '../brand-profile/brand-profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { getScene, ProductCategory } from '../generation/styles.config';
import {
  CampaignDna,
  CreativeDirectorInput,
  CreativePlan,
  CreativeShotPlan,
  ProductContext,
} from './creative-director.types';
import {
  aiSceneKey,
  composeAiScenePrompt,
  isAiSceneId,
  type ProductSceneConcept,
} from '../product-analysis/product-analysis.types';

const SUPPLEMENT_PATTERN =
  /\b(creatine|creatine monohydrate|protein powder|whey|pre[- ]?workout|post[- ]?workout|bcaa|amino acid|electrolyte|sports supplement|fitness supplement|vitamin|capsule|supplement)\b/i;

const CAMERA_DIRECTIONS = [
  '85 mm compressed hero perspective',
  '50 mm natural commercial perspective',
  '70 mm low three-quarter product perspective',
  '90 mm close product-detail perspective',
  '40 mm environmental campaign perspective with corrected verticals',
];

const COMPOSITIONS = [
  'centered architectural hero with disciplined negative space',
  'asymmetrical hero weighted left with copy space on the right',
  'asymmetrical hero weighted right with copy space on the left',
  'layered diagonal editorial composition with the product fully visible',
  'close tactile composition that preserves the complete brand panel',
];

const LIGHTING_DIRECTIONS = [
  'large soft key from camera-left with neutral negative fill',
  'controlled key from camera-right with a narrow brand-color rim',
  'broad frontal source with a subtle top-to-bottom highlight gradient',
  'clean backlight separation with accurate neutral frontal fill',
  'one crisp accent highlight inside otherwise soft commercial illumination',
];

const SHOT_ROLES: CreativeShotPlan['role'][] = ['hero', 'lifestyle', 'detail', 'editorial'];

@Injectable()
export class CreativeDirectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: BrandProfileService,
  ) {}

  async createPlan(input: CreativeDirectorInput): Promise<CreativePlan> {
    const profile = await this.profiles.getPersisted(input.userId);
    const productContext = this.classifyProduct(input, profile);
    const warnings: string[] = [];
    const aiScene = this.resolveAiScene(input);
    // An AI scene was authored for this exact product, so the supplement re-router would only
    // override a better-informed decision with a generic preset.
    const routed = aiScene
      ? { category: input.category, sceneId: input.sceneId }
      : this.routeContext(input.category, input.sceneId, productContext, warnings);
    const uniquenessIndex = await this.prisma.generation.count({ where: { userId: input.userId } });
    const campaignDna = this.campaignDna(
      input,
      profile,
      productContext,
      routed,
      uniquenessIndex,
      aiScene,
    );
    const shots = this.shotPlans(input, campaignDna);
    const semanticSignature = [
      productContext.productClass,
      campaignDna.environment,
      campaignDna.lighting,
      campaignDna.cameraLanguage,
      campaignDna.composition,
      campaignDna.mood,
    ]
      .join('|')
      .toLowerCase();
    const fingerprint = `${this.slug(productContext.productClass)}:${createHash('sha256')
      .update(`${semanticSignature}|${input.generationId}`)
      .digest('hex')
      .slice(0, 16)}`;
    const brandSnapshot = profile
      ? (this.profiles.snapshot(profile) as Record<string, unknown>)
      : null;

    return {
      version: 1,
      effectiveCategory: routed.category,
      effectiveSceneId: routed.sceneId,
      brandProfileVersion: profile?.version ?? null,
      brandSnapshot,
      productContext,
      campaignDna,
      shots,
      fingerprint,
      warnings,
      prompt: this.compilePrompt(profile, productContext, campaignDna, warnings),
      scenePrompt:
        aiScene && input.analysis ? composeAiScenePrompt(aiScene, input.analysis) : null,
      analysisId: input.analysis?.id ?? null,
    };
  }

  private resolveAiScene(input: CreativeDirectorInput): ProductSceneConcept | null {
    if (!input.analysis || !isAiSceneId(input.sceneId)) return null;
    const key = aiSceneKey(input.sceneId);
    return input.analysis.scenes.find((scene) => scene.id === key) ?? null;
  }

  private classifyProduct(
    input: CreativeDirectorInput,
    profile: BrandProfile | null,
  ): ProductContext {
    const evidence = [
      input.productType,
      input.brief,
      profile?.businessType,
      profile?.businessSubcategory,
      profile?.description,
    ]
      .filter(Boolean)
      .join(' ');
    const businessType = profile?.businessType ?? 'unconfigured';
    const analysis = input.analysis;
    const analysisEvidence = analysis
      ? [analysis.productType, analysis.productClass, analysis.summary].join(' ')
      : '';
    const isSupplement =
      SUPPLEMENT_PATTERN.test(`${evidence} ${analysisEvidence}`) ||
      businessType === 'sports-nutrition';

    // A direct read of the photograph beats every text heuristic below it.
    if (analysis) {
      return {
        productType: analysis.productType,
        productClass: analysis.productClass,
        businessType,
        confidence: analysis.confidence,
        rationale: [
          'Aluna analysed the uploaded photograph directly.',
          analysis.summary,
          analysis.attributes.materials.length
            ? `Detected materials: ${analysis.attributes.materials.join(', ')}.`
            : '',
          analysis.attributes.handlingNotes.length
            ? `Photographic constraints: ${analysis.attributes.handlingNotes.join('; ')}.`
            : '',
        ].filter(Boolean),
        allowedEnvironments: this.compatibleEnvironments(
          [
            ...analysis.scenes.map((scene) => scene.environment),
            ...(profile?.preferredEnvironments ?? []),
          ],
          [
            ...analysis.attributes.forbiddenEnvironments,
            ...(profile?.forbiddenEnvironments ?? []),
          ],
        ),
        forbiddenEnvironments: this.unique([
          ...analysis.attributes.forbiddenEnvironments,
          ...(profile?.forbiddenEnvironments ?? []),
        ]),
        safetyBoundaries: isSupplement
          ? [
              'Do not invent medical, health, dosage, certification, or guaranteed performance claims.',
              'Do not depict unsafe consumption or imply that the product replaces professional medical advice.',
            ]
          : [],
      };
    }

    if (isSupplement) {
      return {
        productType:
          input.productType?.trim() || profile?.businessSubcategory || 'wellness product',
        productClass: 'sports nutrition or wellness supplement',
        businessType,
        confidence: SUPPLEMENT_PATTERN.test(evidence) ? 0.98 : 0.88,
        rationale: [
          SUPPLEMENT_PATTERN.test(evidence)
            ? 'The product description contains supplement-specific language.'
            : 'The saved Brand Profile identifies a sports-nutrition or wellness business.',
          'Supplement products require performance, recovery, or evidence-led contexts rather than ordinary food preparation.',
        ],
        allowedEnvironments: this.compatibleEnvironments(
          [
            'performance studio',
            'sports-science setting',
            'training environment',
            'active recovery studio',
            ...(profile?.preferredEnvironments ?? []),
          ],
          [
            'domestic kitchen',
            'cooking scene',
            'restaurant',
            'dining table',
            'bakery',
            ...(profile?.forbiddenEnvironments ?? []),
          ],
        ),
        forbiddenEnvironments: this.unique([
          'domestic kitchen',
          'cooking scene',
          'restaurant',
          'dining table',
          'bakery',
          ...(profile?.forbiddenEnvironments ?? []),
        ]),
        safetyBoundaries: [
          'Do not invent medical, health, dosage, certification, or guaranteed performance claims.',
          'Do not depict unsafe consumption or imply that the product replaces professional medical advice.',
        ],
      };
    }

    return {
      productType: input.productType?.trim() || `${input.category} product`,
      productClass: input.category,
      businessType,
      confidence: input.productType?.trim() ? 0.82 : 0.62,
      rationale: [
        input.productType?.trim()
          ? 'The client supplied a product type.'
          : 'The classification currently relies on the selected product category.',
      ],
      allowedEnvironments: this.unique([
        getScene(input.category, input.sceneId)?.name ?? input.sceneId,
        ...(profile?.preferredEnvironments ?? []),
      ]),
      forbiddenEnvironments: this.unique(profile?.forbiddenEnvironments ?? []),
      safetyBoundaries: [],
    };
  }

  private routeContext(
    category: ProductCategory,
    sceneId: string,
    context: ProductContext,
    warnings: string[],
  ): { category: ProductCategory; sceneId: string } {
    if (context.productClass === 'sports nutrition or wellness supplement') {
      if (category !== 'wellness' || !['performance', 'science', 'recovery'].includes(sceneId)) {
        warnings.push(
          `Aluna replaced the ${category}/${sceneId} direction with Health & Wellness / Performance Studio because the product is a supplement.`,
        );
        return { category: 'wellness', sceneId: 'performance' };
      }
    }
    return { category, sceneId };
  }

  private campaignDna(
    input: CreativeDirectorInput,
    profile: BrandProfile | null,
    context: ProductContext,
    routed: { category: ProductCategory; sceneId: string },
    uniquenessIndex: number,
    aiScene: ProductSceneConcept | null,
  ): CampaignDna {
    const seed = createHash('sha256').update(input.generationId).digest();
    const palette = profile
      ? this.unique([profile.primaryColor, ...profile.secondaryColors, ...profile.accentColors])
      : [];
    return {
      objective:
        profile?.defaultCampaignObjectives[0] ??
        (input.brief?.trim() ? 'client-defined campaign' : 'commercial product awareness'),
      mood: input.options.campaignMood ?? aiScene?.mood ?? profile?.tone[0] ?? 'scene-led',
      palette: palette.length ? palette : [input.options.palette ?? 'scene-led'],
      environment:
        aiScene?.environment ??
        getScene(routed.category, routed.sceneId)?.name ??
        context.allowedEnvironments[0] ??
        routed.sceneId,
      // An AI scene names its own light and camera for this product; the generic pools are the
      // fallback for hand-written presets only.
      lighting:
        input.options.lighting && input.options.lighting !== 'scene-led'
          ? input.options.lighting
          : (aiScene?.lighting ?? this.pick(LIGHTING_DIRECTIONS, this.byte(seed, 0))),
      cameraLanguage:
        input.options.camera && input.options.camera !== 'vary'
          ? input.options.camera
          : (aiScene?.camera ?? this.pick(CAMERA_DIRECTIONS, this.byte(seed, 1))),
      composition:
        input.options.composition && input.options.composition !== 'vary'
          ? input.options.composition
          : this.pick(COMPOSITIONS, this.byte(seed, 2)),
      audience: this.jsonRecord(profile?.audience),
      uniquenessIndex,
    };
  }

  private shotPlans(input: CreativeDirectorInput, dna: CampaignDna): CreativeShotPlan[] {
    const seed = createHash('sha256').update(`${input.generationId}:shots`).digest();
    return Array.from({ length: input.variants }, (_, offset) => ({
      index: offset + 1,
      role: this.pick(SHOT_ROLES, offset + this.byte(seed, 0)),
      moment: this.pick(
        [
          'disciplined campaign hero',
          'credible in-use lifestyle moment',
          'tactile material and label detail',
          'bold editorial composition with commercial clarity',
        ],
        offset + this.byte(seed, 1),
      ),
      composition: this.pick(COMPOSITIONS, offset + this.byte(seed, 2)),
      camera: this.pick(CAMERA_DIRECTIONS, offset * 2 + this.byte(seed, 3)),
      lighting: this.pick(LIGHTING_DIRECTIONS, offset * 3 + this.byte(seed, 4)),
      environment: dna.environment,
    }));
  }

  private compilePrompt(
    profile: BrandProfile | null,
    context: ProductContext,
    dna: CampaignDna,
    warnings: string[],
  ): string {
    const brandLines = profile
      ? [
          `Brand: ${profile.brandName}.`,
          profile.businessSubcategory
            ? `Business: ${profile.businessType}, specifically ${profile.businessSubcategory}.`
            : `Business: ${profile.businessType}.`,
          profile.positioning ? `Positioning: ${profile.positioning}.` : '',
          profile.tone.length ? `Brand tone: ${profile.tone.join(', ')}.` : '',
          `Brand palette: ${dna.palette.join(', ')}. Use these colors only in the environment and accents; never recolor the product.`,
          profile.slogan
            ? `The official slogan is "${profile.slogan}". Do not ask the image model to redraw it; reserve clean copy space for deterministic typography overlay.`
            : '',
          profile.logoKey
            ? 'A separate official logo asset exists. Do not invent or redraw that logo in the scene; preserve only brand marks already visible on the source product.'
            : 'Do not invent a new logo or brand mark.',
          profile.requiredVisualElements.length
            ? `Required visual elements where physically appropriate: ${profile.requiredVisualElements.join(', ')}.`
            : '',
          profile.forbiddenVisualElements.length
            ? `Forbidden visual elements: ${profile.forbiddenVisualElements.join(', ')}.`
            : '',
        ].filter(Boolean)
      : [
          'No Brand Profile has been completed. Keep the result product-led and do not invent logos, slogans, brand claims, or a house style.',
        ];

    return `BRAND INTELLIGENCE:
${brandLines.map((line) => `- ${line}`).join('\n')}

PRODUCT AND BUSINESS CONTEXT:
- Classified product: ${context.productType} (${context.productClass}), confidence ${Math.round(context.confidence * 100)}%.
- Commercially appropriate environments: ${context.allowedEnvironments.join(', ') || 'selected scene'}.
- Forbidden environments: ${context.forbiddenEnvironments.join(', ') || 'none beyond the selected preset'}.
${context.safetyBoundaries.map((line) => `- ${line}`).join('\n')}

CAMPAIGN DNA:
- Objective: ${dna.objective}.
- Mood: ${dna.mood}.
- Environment: ${dna.environment}.
- Lighting language: ${dna.lighting}.
- Camera language: ${dna.cameraLanguage}.
- Composition: ${dna.composition}.
- Keep the campaign coherent, but make every shot meaningfully different in camera position, spatial rhythm, and moment.
${warnings.length ? `\nCONTEXT CORRECTIONS:\n${warnings.map((line) => `- ${line}`).join('\n')}` : ''}`;
  }

  private jsonRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  private compatibleEnvironments(allowed: string[], forbidden: string[]): string[] {
    const blocked = this.unique(forbidden).map((value) => value.toLowerCase());
    return this.unique(allowed).filter((candidate) => {
      const normalized = candidate.toLowerCase();
      return !blocked.some((value) => normalized.includes(value) || value.includes(normalized));
    });
  }

  private byte(value: Buffer, index: number): number {
    return value[index] ?? 0;
  }

  private pick<T>(values: readonly T[], index: number): T {
    const value = values[Math.abs(index) % values.length];
    if (value === undefined) throw new Error('Creative direction list cannot be empty');
    return value;
  }

  private slug(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
