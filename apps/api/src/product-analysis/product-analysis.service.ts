import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { GenerationService } from '../generation/generation.service';
import { PrismaService } from '../prisma/prisma.service';
import { BrandProfileService } from '../brand-profile/brand-profile.service';
import { isProductCategory, ProductCategory, STYLES_CONFIG } from '../generation/styles.config';
import {
  ProductAnalysisResult,
  ProductAttributes,
  ProductSceneConcept,
} from './product-analysis.types';

const DEFAULT_VISION_MODEL = 'gemini-3.6-flash';
const DEFAULT_INPUT_COST_PER_MILLION_USD = 0.3;
const DEFAULT_OUTPUT_COST_PER_MILLION_USD = 2.5;
const ANALYSIS_MAX_EDGE = 768;
const SCENE_COUNT = 6;

/** HTML named entities for code points 160-255, in order, so the index is the offset from 160. */
const LATIN1_ENTITIES =
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'.split(
    ' ',
  );

interface GeminiTextResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { code?: number; message?: string };
}

/** Gemini structured-output schema. v1beta expects the uppercase OpenAPI type names. */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    category: { type: 'STRING', enum: Object.keys(STYLES_CONFIG) },
    productType: { type: 'STRING' },
    productClass: { type: 'STRING' },
    summary: { type: 'STRING' },
    confidence: { type: 'NUMBER' },
    materials: { type: 'ARRAY', items: { type: 'STRING' } },
    dominantColors: { type: 'ARRAY', items: { type: 'STRING' } },
    finish: { type: 'STRING' },
    shapeAndScale: { type: 'STRING' },
    visibleText: { type: 'ARRAY', items: { type: 'STRING' } },
    handlingNotes: { type: 'ARRAY', items: { type: 'STRING' } },
    forbiddenEnvironments: { type: 'ARRAY', items: { type: 'STRING' } },
    scenes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          rationale: { type: 'STRING' },
          environment: { type: 'STRING' },
          lighting: { type: 'STRING' },
          camera: { type: 'STRING' },
          props: { type: 'STRING' },
          mood: { type: 'STRING' },
        },
        required: ['name', 'rationale', 'environment', 'lighting', 'camera', 'props', 'mood'],
      },
    },
  },
  required: [
    'category',
    'productType',
    'productClass',
    'summary',
    'confidence',
    'materials',
    'dominantColors',
    'finish',
    'shapeAndScale',
    'visibleText',
    'handlingNotes',
    'forbiddenEnvironments',
    'scenes',
  ],
} as const;

@Injectable()
export class ProductAnalysisService {
  private readonly logger = new Logger(ProductAnalysisService.name);
  private readonly visionModel: string;
  private readonly inputCostPerMillion: number;
  private readonly outputCostPerMillion: number;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GenerationService) private readonly generation: GenerationService,
    @Inject(BrandProfileService) private readonly profiles: BrandProfileService,
  ) {
    this.visionModel =
      this.config.get<string>('GEMINI_VISION_MODEL')?.trim() || DEFAULT_VISION_MODEL;
    this.inputCostPerMillion =
      this.config.get<number>('GEMINI_VISION_INPUT_COST_PER_MILLION_USD') ??
      DEFAULT_INPUT_COST_PER_MILLION_USD;
    this.outputCostPerMillion =
      this.config.get<number>('GEMINI_VISION_OUTPUT_COST_PER_MILLION_USD') ??
      DEFAULT_OUTPUT_COST_PER_MILLION_USD;
  }

  async analyze(input: {
    userId: string;
    image: Buffer;
    mimeType: string;
    inputKey: string;
    productType?: string;
    brief?: string;
  }): Promise<ProductAnalysisResult> {
    const apiKey = this.generation.getGeminiApiKey();
    if (!apiKey) {
      throw new BadRequestException(
        'Product analysis needs a Google Gemini API key. Add one in Super Admin > provider vault.',
      );
    }

    const startedAt = Date.now();
    const prepared = await sharp(input.image)
      .rotate()
      .resize({
        width: ANALYSIS_MAX_EDGE,
        height: ANALYSIS_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88 })
      .toBuffer();

    const profile = await this.profiles.getPersisted(input.userId);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.visionModel)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: this.analysisPrompt(input.productType, input.brief, profile) },
                { inline_data: { mime_type: 'image/jpeg', data: prepared.toString('base64') } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            temperature: 1.0,
          },
        }),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as GeminiTextResponse;
    if (!response.ok || payload.error) {
      throw new BadRequestException(
        payload.error?.message || `Product analysis failed with HTTP ${response.status}`,
      );
    }

    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
    if (!text) {
      const reason = payload.candidates?.[0]?.finishReason;
      throw new BadRequestException(
        `The vision model returned no analysis${reason ? ` (${reason})` : ''}`,
      );
    }

    const parsed = this.parse(text);
    const inputTokens = payload.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = payload.usageMetadata?.candidatesTokenCount ?? 0;
    const costUsd =
      (inputTokens / 1_000_000) * this.inputCostPerMillion +
      (outputTokens / 1_000_000) * this.outputCostPerMillion;

    const record = await this.prisma.productAnalysis.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        inputKey: input.inputKey,
        category: parsed.category,
        productType: parsed.productType,
        productClass: parsed.productClass,
        summary: parsed.summary,
        confidence: new Prisma.Decimal(parsed.confidence.toFixed(3)),
        attributes: parsed.attributes as unknown as Prisma.InputJsonValue,
        scenes: parsed.scenes as unknown as Prisma.InputJsonValue,
        model: this.visionModel,
        costUsd: new Prisma.Decimal(costUsd.toFixed(6)),
      },
    });

    this.logger.log(
      `Analysed ${parsed.productType} (${parsed.category}) in ${Date.now() - startedAt} ms, ${inputTokens + outputTokens} tokens, $${costUsd.toFixed(6)}, ${parsed.scenes.length} scenes`,
    );

    return {
      id: record.id,
      category: parsed.category,
      productType: parsed.productType,
      productClass: parsed.productClass,
      summary: parsed.summary,
      confidence: parsed.confidence,
      attributes: parsed.attributes,
      scenes: parsed.scenes,
      model: this.visionModel,
      costUsd,
      createdAt: record.createdAt.toISOString(),
    };
  }

  async findForUser(id: string, userId: string): Promise<ProductAnalysisResult | null> {
    const record = await this.prisma.productAnalysis.findFirst({ where: { id, userId } });
    if (!record || !isProductCategory(record.category)) return null;
    return {
      id: record.id,
      category: record.category,
      productType: record.productType,
      productClass: record.productClass,
      summary: record.summary,
      confidence: Number(record.confidence),
      attributes: record.attributes as unknown as ProductAttributes,
      scenes: record.scenes as unknown as ProductSceneConcept[],
      model: record.model,
      costUsd: Number(record.costUsd),
      createdAt: record.createdAt.toISOString(),
    };
  }

  private analysisPrompt(
    productType: string | undefined,
    brief: string | undefined,
    profile: { brandName: string; businessType: string; tone: string[] } | null,
  ): string {
    const categories = Object.entries(STYLES_CONFIG)
      .map(([id, config]) => `${id} (${config.label})`)
      .join(', ');
    const hints = [
      productType?.trim() ? `The client calls this a "${productType.trim()}".` : '',
      brief?.trim() ? `Client campaign brief: "${brief.trim()}".` : '',
      profile
        ? `Brand context: ${profile.brandName}, a ${profile.businessType} business${profile.tone.length ? ` with a ${profile.tone.join(', ')} tone` : ''}.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    return `You are the Creative Director of a commercial product photography studio. Study the supplied
product photograph and plan a campaign for THIS EXACT PRODUCT.

${hints || 'No written context was supplied; rely entirely on the photograph.'}

First, identify the product truthfully from what you can actually see. Report the materials, dominant
colors, surface finish, shape and physical scale, and transcribe any text or brand marks visible on the
product itself. Do not invent details you cannot see. Set confidence between 0 and 1 honestly.

In handlingNotes, record physical facts that constrain how this product must be lit or staged — for
example translucent glass that blows out under a hard key, a mirror finish that reflects the studio, a
matte powder that loses form under flat light, or fabric that needs raking light to show weave. These
notes are photographic constraints, not marketing copy.

In forbiddenEnvironments, list settings that would be commercially wrong or unsafe for this product
category. Choose the single best category from: ${categories}.

Then invent exactly ${SCENE_COUNT} DISTINCT scene concepts for this specific product. Requirements:
- Each scene must be one this product in particular earns. A concept that would suit any generic object
  is a failure. Tie the environment, surfaces, and props to the product's real materials and use.
- The ${SCENE_COUNT} scenes must differ from each other in environment, light quality, and camera
  distance. Do not produce six variations of a studio sweep.
- Ground every scene in real photographic craft: name the light source and its quality, the camera
  perspective, the surfaces, and the supporting props.
- Props must never cover, touch, or compete with the product's branding.
- Do not describe the product itself in the scene fields; describe only the world around it.
- Give each scene a short evocative name a photographer would recognise, and a one-sentence rationale
  explaining why it suits this exact product.

Write every string as plain UTF-8. Never HTML-escape characters: write "Piña Colada", not
"Pi&ntilde;a Colada".`;
  }

  private parse(text: string): {
    category: ProductCategory;
    productType: string;
    productClass: string;
    summary: string;
    confidence: number;
    attributes: ProductAttributes;
    scenes: ProductSceneConcept[];
  } {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('The vision model returned malformed analysis JSON');
    }

    const category = this.text(raw.category);
    const scenes = Array.isArray(raw.scenes) ? raw.scenes : [];
    const concepts = scenes
      .filter((scene): scene is Record<string, unknown> => Boolean(scene) && typeof scene === 'object')
      .map((scene, index) => {
        const name = this.text(scene.name) || `Scene ${index + 1}`;
        return {
          id: this.slug(name) || `scene-${index + 1}`,
          name,
          rationale: this.text(scene.rationale),
          environment: this.text(scene.environment),
          lighting: this.text(scene.lighting),
          camera: this.text(scene.camera),
          props: this.text(scene.props),
          mood: this.text(scene.mood),
        };
      })
      .filter((scene) => scene.environment && scene.lighting);

    if (!concepts.length) {
      throw new BadRequestException('The vision model returned no usable scene concepts');
    }

    return {
      category: isProductCategory(category) ? category : 'cosmetics',
      productType: this.text(raw.productType) || 'product',
      productClass: this.text(raw.productClass) || 'commercial product',
      summary: this.text(raw.summary),
      confidence: Math.min(Math.max(this.number(raw.confidence), 0), 1),
      attributes: {
        materials: this.list(raw.materials),
        dominantColors: this.list(raw.dominantColors),
        finish: this.text(raw.finish),
        shapeAndScale: this.text(raw.shapeAndScale),
        visibleText: this.list(raw.visibleText),
        handlingNotes: this.list(raw.handlingNotes),
        forbiddenEnvironments: this.list(raw.forbiddenEnvironments),
      },
      scenes: this.deduplicate(concepts),
    };
  }

  /** Scene ids address a scene at generation time, so they must be unique within one analysis. */
  private deduplicate(scenes: ProductSceneConcept[]): ProductSceneConcept[] {
    const seen = new Set<string>();
    return scenes.map((scene) => {
      let id = scene.id;
      let suffix = 2;
      while (seen.has(id)) id = `${scene.id}-${suffix++}`;
      seen.add(id);
      return { ...scene, id };
    });
  }

  private text(value: unknown): string {
    return typeof value === 'string' ? this.decodeEntities(value).trim() : '';
  }

  /**
   * The vision model HTML-escapes accented characters ("Pi&ntilde;a Colada"), which would otherwise
   * reach the image model verbatim and be rendered as literal entity text on the product.
   */
  private decodeEntities(value: string): string {
    if (!value.includes('&')) return value;
    return value
      .replace(/&#(\d+);/g, (_, code: string) => this.codePoint(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => this.codePoint(Number.parseInt(code, 16)))
      .replace(/&([a-z]+\d*);/gi, (match, name: string) => {
        const basic: Record<string, string> = {
          amp: '&',
          lt: '<',
          gt: '>',
          quot: '"',
          apos: "'",
        };
        if (basic[name]) return basic[name];
        const index = LATIN1_ENTITIES.indexOf(name);
        return index === -1 ? match : this.codePoint(index + 160);
      });
  }

  private codePoint(code: number): string {
    return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }

  private number(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private list(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((entry) => this.text(entry)).filter(Boolean))];
  }

  private slug(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
  }
}
