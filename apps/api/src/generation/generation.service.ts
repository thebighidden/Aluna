import { GenerationStatus, Prisma } from '@prisma/client';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { lookup } from 'mime-types';
import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  CampaignOptions,
  composeCampaignOptionsPrompt,
  normalizeCampaignOptions,
} from './campaign-options.config';
import { composePrompt, getScene, isProductCategory, ProductCategory } from './styles.config';

const DEFAULT_OPENAI_MODEL = 'gpt-image-2';
const DEFAULT_OPENAI_IMAGE_OUTPUT_COST_USD = 0.053;
const DEFAULT_CLOUDFLARE_MODEL = '@cf/black-forest-labs/flux-2-klein-9b';
const DEFAULT_CLOUDFLARE_OUTPUT_COST_USD = 0.015;
const DEFAULT_CLOUDFLARE_INPUT_COST_PER_MP_USD = 0.002;
const DEFAULT_CLOUDFLARE_OUTPUT_NEURONS = 1363.64;
const DEFAULT_CLOUDFLARE_INPUT_NEURONS_PER_MP = 181.82;
const CLOUDFLARE_MAX_REFERENCE_EDGE = 511;

type ImageQuality = 'low' | 'medium' | 'high' | 'auto';
export type GenerationProvider = 'cloudflare' | 'openai';

export interface GenerationRuntimeConfiguration {
  provider: GenerationProvider;
  providerLabel: string;
  model: string;
  quality: string;
  imageSize: string;
  configured: boolean;
  missingConfiguration: string[];
  usageUnit: 'neurons' | 'tokens';
  dailyFreeUnits: number | null;
  estimatedUnitsPerImage: number | null;
}

export interface GenerateImagesInput {
  imagePath: string;
  category: ProductCategory;
  sceneId: string;
  variants: number;
  brief?: string;
  options?: CampaignOptions;
}

interface ProviderUsage {
  inputTokens: number;
  inputTextTokens: number;
  inputImageTokens: number;
  outputTokens: number;
  totalTokens: number;
  providerUnits: number;
  providerUnit: 'neurons' | 'tokens';
}

export interface VariantResult {
  index: number;
  key: string;
  costUsd: number;
  durationMs: number;
  mimeType: string;
  usage: ProviderUsage;
}

export interface GenerationResult {
  runId: string;
  outputKeys: string[];
  costUsd: number;
  durationMs: number;
  variants: VariantResult[];
}

export interface GenerationContext {
  runId?: string;
  inputKey?: string;
  outputPrefix?: string;
  onVariantComplete?: (result: VariantResult) => Promise<void> | void;
}

interface PreparedSource {
  image: Buffer;
  mimeType: string;
  megapixels: number;
}

interface CloudflareApiResponse {
  success?: boolean;
  result?: { image?: string };
  errors?: Array<{ code?: number; message?: string }>;
  messages?: Array<{ code?: number; message?: string }>;
}

interface ProviderErrorMetadata {
  status?: number;
  providerCode?: number;
  providerUsageUnits?: number;
  costUsd?: number;
}

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);
  private readonly provider: GenerationProvider;
  private readonly openAi?: OpenAI;
  private readonly openAiModel: string;
  private readonly openAiQuality: ImageQuality;
  private readonly openAiSize: string;
  private readonly openAiImageOutputCostUsd: number;
  private readonly cloudflareAccountId?: string;
  private readonly cloudflareApiToken?: string;
  private readonly cloudflareModel: string;
  private readonly cloudflareWidth: number;
  private readonly cloudflareHeight: number;
  private readonly cloudflareDailyNeuronBudget: number;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {
    const openAiApiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (openAiApiKey) this.openAi = new OpenAI({ apiKey: openAiApiKey });

    this.openAiModel =
      this.config.get<string>('OPENAI_IMAGE_MODEL')?.trim() || DEFAULT_OPENAI_MODEL;
    this.openAiQuality = this.config.get<ImageQuality>('OPENAI_IMAGE_QUALITY') ?? 'medium';
    this.openAiSize = this.config.get<string>('OPENAI_IMAGE_SIZE')?.trim() || '1024x1024';
    this.openAiImageOutputCostUsd =
      this.config.get<number>('OPENAI_IMAGE_OUTPUT_COST_USD') ??
      DEFAULT_OPENAI_IMAGE_OUTPUT_COST_USD;

    this.cloudflareAccountId =
      this.config.get<string>('CLOUDFLARE_ACCOUNT_ID')?.trim() ||
      this.config.get<string>('R2_ACCOUNT_ID')?.trim() ||
      undefined;
    this.cloudflareApiToken = this.config.get<string>('CLOUDFLARE_API_TOKEN')?.trim() || undefined;
    this.cloudflareModel =
      this.config.get<string>('CLOUDFLARE_AI_MODEL')?.trim() || DEFAULT_CLOUDFLARE_MODEL;
    this.cloudflareWidth = this.config.get<number>('CLOUDFLARE_AI_WIDTH') ?? 1024;
    this.cloudflareHeight = this.config.get<number>('CLOUDFLARE_AI_HEIGHT') ?? 1024;
    this.cloudflareDailyNeuronBudget =
      this.config.get<number>('CLOUDFLARE_AI_DAILY_NEURON_BUDGET') ?? 10_000;
    this.provider = this.resolveProvider();

    const runtime = this.getRuntimeConfiguration();
    if (runtime.configured) {
      this.logger.log(`Image provider: ${runtime.providerLabel} (${runtime.model})`);
    } else {
      this.logger.warn(
        `${runtime.providerLabel} is selected but missing ${runtime.missingConfiguration.join(', ')}`,
      );
    }
  }

  getRuntimeConfiguration(): GenerationRuntimeConfiguration {
    if (this.provider === 'cloudflare') {
      const missingConfiguration = [
        !this.cloudflareAccountId ? 'CLOUDFLARE_ACCOUNT_ID' : null,
        !this.cloudflareApiToken ? 'CLOUDFLARE_API_TOKEN' : null,
      ].filter((value): value is string => Boolean(value));
      return {
        provider: 'cloudflare',
        providerLabel: 'Cloudflare Workers AI',
        model: this.cloudflareModel,
        quality: 'Fast · 4 steps',
        imageSize: `${this.cloudflareWidth}x${this.cloudflareHeight}`,
        configured: missingConfiguration.length === 0,
        missingConfiguration,
        usageUnit: 'neurons',
        dailyFreeUnits: this.cloudflareDailyNeuronBudget,
        estimatedUnitsPerImage: this.estimateCloudflareUsageUnits(0.25),
      };
    }

    const missingConfiguration = this.openAi ? [] : ['OPENAI_API_KEY'];
    return {
      provider: 'openai',
      providerLabel: 'OpenAI',
      model: this.openAiModel,
      quality: this.openAiQuality,
      imageSize: this.openAiSize,
      configured: missingConfiguration.length === 0,
      missingConfiguration,
      usageUnit: 'tokens',
      dailyFreeUnits: null,
      estimatedUnitsPerImage: null,
    };
  }

  async generate(
    input: GenerateImagesInput,
    context: GenerationContext = {},
  ): Promise<GenerationResult> {
    this.validateInput(input);

    const detectedMimeType = lookup(input.imagePath) || 'image/jpeg';
    if (!detectedMimeType.startsWith('image/')) {
      throw new Error(`Input must be an image; detected MIME type "${detectedMimeType}"`);
    }

    const startedAt = Date.now();
    const timestamp = this.outputTimestamp();
    const outputPrefix = context.outputPrefix ?? timestamp;
    const runId = await this.prepareRun(input, context.inputKey ?? input.imagePath, context.runId);
    const basePrompt = this.composeGenerationPrompt(input);
    const results: VariantResult[] = [];

    try {
      const sourceImage = await readFile(input.imagePath);
      const source = await this.prepareSource(sourceImage, detectedMimeType);
      this.assertProviderConfigured();
      for (let index = 1; index <= input.variants; index += 1) {
        if (this.provider === 'cloudflare') {
          await this.assertCloudflareDailyBudget(runId, source.megapixels);
        }
        const variant = await this.generateVariant({
          source,
          prompt: this.variantPrompt(basePrompt, input, runId, index, input.variants),
          safetyRetryPrompt: this.cloudflareSafetyRetryPrompt(input, index, input.variants),
          index,
          outputPrefix,
          seed: this.variantSeed(runId, index),
          runId,
        });
        results.push(variant);

        const cumulativeCost = results.reduce((sum, result) => sum + result.costUsd, 0);
        const cumulativeDuration = Date.now() - startedAt;
        const cumulativeUsage = this.sumUsage(results);
        await this.prisma.generation.update({
          where: { id: runId },
          data: {
            status: GenerationStatus.GENERATING,
            outputKeys: results.map(({ key }) => key),
            costUsd: new Prisma.Decimal(cumulativeCost.toFixed(6)),
            durationMs: cumulativeDuration,
            ...cumulativeUsage,
            providerUsageUnits: new Prisma.Decimal(cumulativeUsage.providerUsageUnits.toFixed(2)),
          },
        });
        await context.onVariantComplete?.(variant);
      }

      const durationMs = Date.now() - startedAt;
      const costUsd = results.reduce((sum, result) => sum + result.costUsd, 0);
      const outputKeys = results.map(({ key }) => key);
      const cumulativeUsage = this.sumUsage(results);
      await this.prisma.generation.update({
        where: { id: runId },
        data: {
          status: GenerationStatus.DONE,
          outputKeys,
          costUsd: new Prisma.Decimal(costUsd.toFixed(6)),
          durationMs,
          error: null,
          errorCode: null,
          ...cumulativeUsage,
          providerUsageUnits: new Prisma.Decimal(cumulativeUsage.providerUsageUnits.toFixed(2)),
        },
      });

      return { runId, outputKeys, costUsd, durationMs, variants: results };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const errorCode = this.classifyError(error);
      const successfulUsage = this.sumUsage(results);
      const successfulCost = results.reduce((sum, result) => sum + result.costUsd, 0);
      const failureMetadata = this.providerErrorMetadata(error);
      const providerUsageUnits =
        successfulUsage.providerUsageUnits + (failureMetadata.providerUsageUnits ?? 0);
      const costUsd = successfulCost + (failureMetadata.costUsd ?? 0);
      await this.prisma.generation
        .update({
          where: { id: runId },
          data: {
            status: GenerationStatus.FAILED,
            outputKeys: results.map(({ key }) => key),
            costUsd: new Prisma.Decimal(costUsd.toFixed(6)),
            durationMs: Date.now() - startedAt,
            error: message,
            errorCode,
            ...successfulUsage,
            providerUsageUnits: new Prisma.Decimal(providerUsageUnits.toFixed(2)),
          },
        })
        .catch((persistenceError: unknown) => {
          this.logger.error('Could not persist generation failure', persistenceError);
        });
      throw error;
    }
  }

  private async generateVariant(args: {
    source: PreparedSource;
    prompt: string;
    safetyRetryPrompt: string;
    index: number;
    outputPrefix: string;
    seed: number;
    runId: string;
  }): Promise<VariantResult> {
    return this.provider === 'cloudflare'
      ? this.generateCloudflareVariant(args)
      : this.generateOpenAiVariant(args);
  }

  private async generateCloudflareVariant(args: {
    source: PreparedSource;
    prompt: string;
    safetyRetryPrompt: string;
    index: number;
    outputPrefix: string;
    seed: number;
    runId: string;
  }): Promise<VariantResult> {
    const startedAt = Date.now();
    const costPerAttempt = this.estimateCloudflareCost(args.source.megapixels);
    const unitsPerAttempt = this.estimateCloudflareUsageUnits(args.source.megapixels);
    let attempts = 0;
    let body: Buffer | undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) {
        try {
          await this.assertCloudflareDailyBudget(
            args.runId,
            args.source.megapixels,
            unitsPerAttempt,
          );
        } catch (error) {
          throw this.withCloudflareAttemptUsage(error, attempts, costPerAttempt, unitsPerAttempt);
        }
      }

      attempts += 1;
      try {
        body = await this.requestCloudflareImage({
          source: args.source,
          prompt: attempt === 0 ? args.prompt : args.safetyRetryPrompt,
          seed: attempt === 0 ? args.seed : this.cloudflareRetrySeed(args.seed),
        });
        break;
      } catch (error) {
        if (attempt === 0 && this.isCloudflareSafetyError(error)) {
          this.logger.warn(
            `Cloudflare safety filter rejected variant ${args.index}; retrying once with catalog-safe direction`,
          );
          continue;
        }
        throw this.withCloudflareAttemptUsage(error, attempts, costPerAttempt, unitsPerAttempt);
      }
    }

    if (!body) {
      throw this.withCloudflareAttemptUsage(
        this.providerError(`Cloudflare returned no image for variant ${args.index}`, 502),
        attempts,
        costPerAttempt,
        unitsPerAttempt,
      );
    }

    const outputMimeType = this.detectImageMime(body);
    const extension = this.extensionForMime(outputMimeType);
    const key = await this.storage.putOutput(
      args.outputPrefix,
      `variant-${String(args.index).padStart(2, '0')}${extension}`,
      body,
      outputMimeType,
    );
    const durationMs = Date.now() - startedAt;
    const costUsd = costPerAttempt * attempts;
    const providerUnits = unitsPerAttempt * attempts;
    const usage: ProviderUsage = {
      inputTokens: 0,
      inputTextTokens: 0,
      inputImageTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      providerUnits,
      providerUnit: 'neurons',
    };

    this.logger.log(
      `Cloudflare variant ${args.index}: ${durationMs} ms, ${attempts} attempt${attempts === 1 ? '' : 's'}, ~${providerUnits.toFixed(2)} neurons, estimated $${costUsd.toFixed(6)}, output ${key}`,
    );
    return { index: args.index, key, costUsd, durationMs, mimeType: outputMimeType, usage };
  }

  private async requestCloudflareImage(args: {
    source: PreparedSource;
    prompt: string;
    seed: number;
  }): Promise<Buffer> {
    const form = new FormData();
    form.append('prompt', args.prompt);
    form.append('width', String(this.cloudflareWidth));
    form.append('height', String(this.cloudflareHeight));
    form.append('seed', String(args.seed));
    form.append(
      'input_image_0',
      new Blob([new Uint8Array(args.source.image)], { type: args.source.mimeType }),
      'source.png',
    );

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.cloudflareAccountId}/ai/run/${this.cloudflareModel}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.cloudflareApiToken}` },
        body: form,
      },
    );
    const payload = (await response.json().catch(() => ({}))) as CloudflareApiResponse;
    if (!response.ok || payload.success === false) {
      const details = [...(payload.errors ?? []), ...(payload.messages ?? [])]
        .map(({ code, message }) => [code, message].filter(Boolean).join(': '))
        .filter(Boolean)
        .join('; ');
      const providerCode = [...(payload.errors ?? []), ...(payload.messages ?? [])].find(
        ({ code }) => typeof code === 'number',
      )?.code;
      throw this.providerError(
        details || `Cloudflare Workers AI returned HTTP ${response.status}`,
        response.status,
        providerCode,
      );
    }

    const encodedImage = payload.result?.image;
    if (!encodedImage) {
      throw this.providerError('Cloudflare returned no image data', 502);
    }
    return Buffer.from(encodedImage.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
  }

  private async generateOpenAiVariant(args: {
    source: PreparedSource;
    prompt: string;
    safetyRetryPrompt: string;
    index: number;
    outputPrefix: string;
    seed: number;
    runId: string;
  }): Promise<VariantResult> {
    if (!this.openAi) throw new Error('OPENAI_API_KEY is missing from apps/api/.env');
    const startedAt = Date.now();
    const response = await this.openAi.images.edit({
      model: this.openAiModel,
      image: await toFile(args.source.image, 'source.png', { type: args.source.mimeType }),
      prompt: args.prompt,
      quality: this.openAiQuality,
      size: this.openAiSize,
      output_format: 'png',
      background: 'opaque',
    });

    const imageData = response.data?.[0]?.b64_json;
    if (!imageData) throw new Error(`OpenAI returned no image data for variant ${args.index}`);

    const outputMimeType = 'image/png';
    const key = await this.storage.putOutput(
      args.outputPrefix,
      `variant-${String(args.index).padStart(2, '0')}.png`,
      Buffer.from(imageData, 'base64'),
      outputMimeType,
    );
    const durationMs = Date.now() - startedAt;
    const totalTokens = response.usage?.total_tokens ?? 0;
    const usage: ProviderUsage = {
      inputTokens: response.usage?.input_tokens ?? 0,
      inputTextTokens: response.usage?.input_tokens_details.text_tokens ?? 0,
      inputImageTokens: response.usage?.input_tokens_details.image_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      totalTokens,
      providerUnits: totalTokens,
      providerUnit: 'tokens',
    };

    this.logger.log(
      `OpenAI variant ${args.index}: ${durationMs} ms, estimated $${this.openAiImageOutputCostUsd.toFixed(6)}, output ${key}`,
    );
    return {
      index: args.index,
      key,
      costUsd: this.openAiImageOutputCostUsd,
      durationMs,
      mimeType: outputMimeType,
      usage,
    };
  }

  private async prepareSource(image: Buffer, mimeType: string): Promise<PreparedSource> {
    if (this.provider !== 'cloudflare') {
      const metadata = await sharp(image).metadata();
      return {
        image,
        mimeType,
        megapixels: this.megapixels(metadata.width ?? 1024, metadata.height ?? 1024),
      };
    }

    const prepared = await sharp(image)
      .rotate()
      .resize({
        width: CLOUDFLARE_MAX_REFERENCE_EDGE,
        height: CLOUDFLARE_MAX_REFERENCE_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 6 })
      .toBuffer({ resolveWithObject: true });
    return {
      image: prepared.data,
      mimeType: 'image/png',
      megapixels: this.megapixels(prepared.info.width, prepared.info.height),
    };
  }

  private async prepareRun(
    input: GenerateImagesInput,
    inputKey: string,
    existingRunId?: string,
  ): Promise<string> {
    const runtime = this.getRuntimeConfiguration();
    const data = {
      status: GenerationStatus.GENERATING,
      provider: runtime.provider,
      model: runtime.model,
      quality: runtime.quality,
      imageSize: runtime.imageSize,
      requestedVariants: input.variants,
      creativeOptions: normalizeCampaignOptions(input.category, input.options),
      providerUsageUnit: runtime.usageUnit,
      error: null,
      errorCode: null,
    };
    if (existingRunId) {
      const run = await this.prisma.generation.update({
        where: { id: existingRunId },
        data,
        select: { id: true },
      });
      return run.id;
    }

    const run = await this.prisma.generation.create({
      data: {
        ...data,
        category: input.category,
        sceneId: input.sceneId,
        brief: input.brief?.trim() || null,
        inputKey,
      },
      select: { id: true },
    });
    return run.id;
  }

  private async assertCloudflareDailyBudget(
    runId: string,
    inputMegapixels: number,
    reservedUnits = 0,
  ): Promise<void> {
    if (this.cloudflareDailyNeuronBudget <= 0) return;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const aggregate = await this.prisma.generation.aggregate({
      where: {
        provider: 'cloudflare',
        createdAt: { gte: today },
        id: { not: runId },
      },
      _sum: { providerUsageUnits: true },
    });
    const current = await this.prisma.generation.findUnique({
      where: { id: runId },
      select: { providerUsageUnits: true },
    });
    const used =
      Number(aggregate._sum.providerUsageUnits ?? 0) + Number(current?.providerUsageUnits ?? 0);
    const next = this.estimateCloudflareUsageUnits(inputMegapixels);
    if (used + reservedUnits + next > this.cloudflareDailyNeuronBudget) {
      throw new Error(
        `Cloudflare daily demo budget reached (${used.toFixed(0)} of ${this.cloudflareDailyNeuronBudget} neurons used). It resets at 00:00 UTC.`,
      );
    }
  }

  private assertProviderConfigured(): void {
    const runtime = this.getRuntimeConfiguration();
    if (runtime.configured) return;
    throw new Error(
      `${runtime.providerLabel} is not configured. Add ${runtime.missingConfiguration.join(' and ')} to apps/api/.env.`,
    );
  }

  private resolveProvider(): GenerationProvider {
    const requested = this.config.get<string>('GENERATION_PROVIDER')?.trim().toLowerCase();
    if (requested === 'openai') return 'openai';
    if (requested === 'auto') {
      return this.cloudflareAccountId && this.cloudflareApiToken ? 'cloudflare' : 'openai';
    }
    return 'cloudflare';
  }

  private validateInput(input: GenerateImagesInput): void {
    if (!isProductCategory(input.category)) {
      throw new Error(`Unknown category "${String(input.category)}"`);
    }
    if (!getScene(input.category, input.sceneId)) composePrompt(input.category, input.sceneId);
    if (!Number.isInteger(input.variants) || input.variants < 1 || input.variants > 12) {
      throw new Error('variants must be an integer between 1 and 12');
    }
    normalizeCampaignOptions(input.category, input.options);
  }

  private variantPrompt(
    basePrompt: string,
    input: GenerateImagesInput,
    runId: string,
    index: number,
    total: number,
  ): string {
    const options = normalizeCampaignOptions(input.category, input.options);
    const fingerprint = this.variantFingerprint(runId, index);
    const variation = this.variantDirection(fingerprint, options);
    const identity =
      input.category === 'clothing' && options.presentation === 'on-model'
        ? this.modelIdentityDirection(fingerprint, options)
        : '';
    return `${basePrompt}

REFERENCE IMAGE:
Image 0 is the exact source product. Preserve it as the single source of truth. Do not redesign,
reinterpret, replace, or invent any part of it.

UNIQUENESS CONTRACT:
This is Aluna campaign ${runId.slice(0, 8)}, variant ${String(index).padStart(2, '0')}, uniqueness
fingerprint ${fingerprint}. Do not fall back to a repeated stock subject, face, pose, set, or composition.
The exact creative combination must be newly interpreted for this campaign and must differ visibly from
the other variants even when another customer selects the same controls.
${identity}

VARIANT DIRECTION:
Create image ${index} of ${total}. ${variation} Keep it physically plausible and obey every product-
fidelity constraint above. Return one finished image only.`;
  }

  private composeGenerationPrompt(input: GenerateImagesInput): string {
    const presetPrompt = composePrompt(input.category, input.sceneId);
    const options = normalizeCampaignOptions(input.category, input.options);
    const customDirection = composeCampaignOptionsPrompt(input.category, options);
    const brief = input.brief?.trim();
    if (!brief) return `${presetPrompt}\n\n${customDirection}`;
    return `${presetPrompt}

${customDirection}

CAMPAIGN BRIEF:
Apply this additional art direction only where it does not conflict with product fidelity or the scene
preset: ${brief}`;
  }

  private cloudflareSafetyRetryPrompt(
    input: GenerateImagesInput,
    index: number,
    total: number,
  ): string {
    const options = normalizeCampaignOptions(input.category, input.options);
    const scene = getScene(input.category, input.sceneId);
    const genderDirection: Record<string, string> = {
      female: 'an adult woman',
      male: 'an adult man',
      nonbinary: 'an adult non-binary person',
      varied: 'a clearly adult professional fashion model',
    };
    const presentation =
      input.category === 'clothing' && options.presentation === 'on-model'
        ? `Show the garment naturally worn by ${genderDirection[options.modelGender ?? 'varied'] ?? genderDirection.varied}. The fictional model is fully dressed, uses a neutral professional catalogue pose, and is not a celebrity or public figure.`
        : 'Show the product by itself in a conventional commercial catalogue composition.';

    return `Create one standard professional ${input.category} catalogue photograph using Image 0 as the
product reference. This is a conventional retail advertising image in the ${scene?.name ?? 'studio'}
direction. ${presentation}

Keep the exact product silhouette, construction, colors, materials, logos, labels, typography, and
printed text visible and unchanged. Use clean professional lighting, a simple tasteful background,
realistic anatomy where applicable, natural contact shadows, and photorealistic optics. Create image
${index} of ${total}. Return one finished commercial image only.`;
  }

  private variantDirection(fingerprint: string, options: CampaignOptions): string {
    const moments = [
      'Use a poised still moment with clean visual lines and deliberate breathing room.',
      'Use a lightly off-axis editorial moment with believable depth between foreground and background.',
      'Use a confident hero moment with a strong silhouette and a clearly different spatial rhythm.',
      'Use a candid in-between moment that remains polished, intentional, and commercially useful.',
      'Use a graphic moment with controlled geometry, layered depth, and one memorable visual gesture.',
      'Use a tactile close-to-subject moment with realistic micro-detail and restrained atmosphere.',
      'Use an expansive campaign moment with environmental context and clean copy-safe negative space.',
      'Use an intimate editorial moment with precise focus placement and natural optical falloff.',
    ];
    const cameraNuances = [
      'Shift the camera a little below eye level.',
      'Use a straight-on camera with disciplined verticals.',
      'Use a subtle three-quarter camera position.',
      'Use a slightly elevated camera position.',
      'Move closer while preserving the complete product story.',
      'Move farther back and let the environment support the hero.',
    ];
    const lightNuances = [
      'Let the key light arrive from camera-left with soft negative fill.',
      'Let the key light arrive from camera-right with a restrained edge light.',
      'Use a broader frontal source with a delicate side-to-side gradient.',
      'Use gentle backlight separation with a neutral frontal fill.',
      'Use one crisp accent highlight within otherwise soft illumination.',
      'Use a quiet pool of directional light with visible retained shadow detail.',
    ];
    const strength = options.variationStrength ?? 'balanced';
    const strengthDirection =
      strength === 'controlled'
        ? 'Keep the departure subtle and catalogue-coherent.'
        : strength === 'adventurous'
          ? 'Make the departure bold and immediately recognizable while remaining realistic.'
          : 'Make the departure clearly distinct but coherent with the campaign.';
    return `${this.pick(moments, fingerprint, 0)} ${this.pick(cameraNuances, fingerprint, 3)} ${this.pick(
      lightNuances,
      fingerprint,
      6,
    )} ${strengthDirection}`;
  }

  private modelIdentityDirection(fingerprint: string, options: CampaignOptions): string {
    const genders: Record<string, readonly string[]> = {
      varied: ['an adult woman', 'an adult man', 'an adult non-binary person'],
      female: ['an adult woman'],
      male: ['an adult man'],
      nonbinary: ['an adult non-binary person'],
    };
    const ages: Record<string, readonly string[]> = {
      '18-24': ['aged 18 to 24'],
      '25-34': ['aged 25 to 34'],
      '35-49': ['aged 35 to 49'],
      '50-plus': ['aged 50 or older'],
      varied: ['aged 20 to 27', 'aged 28 to 38', 'aged 39 to 49', 'aged 50 to 65'],
    };
    const heritages: Record<string, readonly string[]> = {
      'global-mix': [
        'with African or Afro-diasporic appearance',
        'with East Asian appearance',
        'with South Asian appearance',
        'with Middle Eastern or North African appearance',
        'with Latin American appearance',
        'with European appearance',
        'with a distinctive mixed-heritage appearance',
      ],
      african: ['with African or Afro-diasporic appearance'],
      'east-asian': ['with East Asian appearance'],
      'south-asian': ['with South Asian appearance'],
      mena: ['with Middle Eastern or North African appearance'],
      latin: ['with Latin American appearance'],
      european: ['with European appearance'],
      mixed: ['with a distinctive mixed-heritage appearance'],
    };
    const builds: Record<string, readonly string[]> = {
      varied: [
        'with a naturally slim build',
        'with an athletic build',
        'with an average build',
        'with a curvy build',
        'with a plus-size build',
      ],
      slim: ['with a naturally slim build'],
      athletic: ['with an athletic build'],
      average: ['with an everyday average build'],
      curvy: ['with a naturally curvy build'],
      plus: ['with a confident plus-size build'],
    };
    const hair: Record<string, readonly string[]> = {
      varied: [
        'a contemporary short hairstyle',
        'long naturally styled hair',
        'natural textured curls',
        'a refined braided hairstyle',
        'a closely shaved hairstyle',
        'an elegant naturally draped headscarf',
      ],
      short: ['a contemporary short hairstyle'],
      long: ['long naturally styled hair'],
      curls: ['natural textured curls'],
      braids: ['a refined braided hairstyle'],
      shaved: ['a closely shaved hairstyle'],
      headscarf: ['an elegant naturally draped headscarf'],
    };
    const expressions: Record<string, readonly string[]> = {
      confident: ['a calm, self-assured expression'],
      relaxed: ['a relaxed, unforced expression'],
      joyful: ['a warm, genuinely joyful expression'],
      editorial: ['a composed, serious editorial expression'],
      varied: [
        'a calm, self-assured expression',
        'a relaxed, unforced expression',
        'a warm, genuinely joyful expression',
        'a composed, serious editorial expression',
      ],
    };
    const faceShapes = [
      'an angular face with high cheekbones',
      'a softly oval face with a defined brow',
      'a round face with a strong natural smile line',
      'a long face with a softly defined jaw',
      'a heart-shaped face with expressive eyes',
      'a square face with balanced features',
    ];
    const naturalDetails = [
      'subtle freckles and natural skin texture',
      'a small beauty mark and natural skin texture',
      'defined brows and natural under-eye detail',
      'soft smile lines and realistic skin texture',
      'a clean complexion with visible pores and no plastic smoothing',
      'distinctive cheek structure and realistic skin variation',
    ];

    const gender = this.pick(
      genders[options.modelGender ?? 'varied'] ?? genders.varied!,
      fingerprint,
      0,
    );
    const age = this.pick(ages[options.modelAge ?? '25-34'] ?? ages['25-34']!, fingerprint, 2);
    const heritage = this.pick(
      heritages[options.modelHeritage ?? 'global-mix'] ?? heritages['global-mix']!,
      fingerprint,
      4,
    );
    const build = this.pick(
      builds[options.bodyBuild ?? 'varied'] ?? builds.varied!,
      fingerprint,
      6,
    );
    const hairDirection = this.pick(
      hair[options.hairDirection ?? 'varied'] ?? hair.varied!,
      fingerprint,
      8,
    );
    const expression = this.pick(
      expressions[options.expression ?? 'confident'] ?? expressions.confident!,
      fingerprint,
      10,
    );
    const diversity =
      options.castingDiversity === 'cohesive-cast'
        ? 'Keep the overall casting language coherent with the campaign while using a different person.'
        : options.castingDiversity === 'wide-diversity'
          ? 'Maximize visual difference from the other campaign identities.'
          : 'This person must be visibly different from every other variant and prior campaign result.';

    return `MODEL IDENTITY DIRECTION:\nCreate ${gender}, ${age}, ${heritage}, ${build}, with ${hairDirection}, ${this.pick(
      faceShapes,
      fingerprint,
      1,
    )}, ${this.pick(naturalDetails, fingerprint, 5)}, and ${expression}. This is a newly created fictional
adult identity, not a public figure, celebrity, real customer, or recognizable stock-model face.
${diversity}`;
  }

  private pick<T>(values: readonly T[], fingerprint: string, offset: number): T {
    const slice = fingerprint.slice(offset, offset + 4).padEnd(4, '0');
    return values[Number.parseInt(slice, 16) % values.length]!;
  }

  private sumUsage(results: VariantResult[]) {
    const total = results.reduce(
      (sum, result) => ({
        inputTokens: sum.inputTokens + result.usage.inputTokens,
        inputTextTokens: sum.inputTextTokens + result.usage.inputTextTokens,
        inputImageTokens: sum.inputImageTokens + result.usage.inputImageTokens,
        outputTokens: sum.outputTokens + result.usage.outputTokens,
        totalTokens: sum.totalTokens + result.usage.totalTokens,
        providerUsageUnits: sum.providerUsageUnits + result.usage.providerUnits,
      }),
      {
        inputTokens: 0,
        inputTextTokens: 0,
        inputImageTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        providerUsageUnits: 0,
      },
    );
    return { ...total, providerUsageUnit: results[0]?.usage.providerUnit ?? 'tokens' };
  }

  private estimateCloudflareCost(inputMegapixels: number): number {
    const outputMegapixels = this.megapixels(this.cloudflareWidth, this.cloudflareHeight);
    const outputCost =
      DEFAULT_CLOUDFLARE_OUTPUT_COST_USD +
      Math.max(outputMegapixels - 1, 0) * DEFAULT_CLOUDFLARE_INPUT_COST_PER_MP_USD;
    return outputCost + inputMegapixels * DEFAULT_CLOUDFLARE_INPUT_COST_PER_MP_USD;
  }

  private estimateCloudflareUsageUnits(inputMegapixels: number): number {
    const outputMegapixels = this.megapixels(this.cloudflareWidth, this.cloudflareHeight);
    return (
      DEFAULT_CLOUDFLARE_OUTPUT_NEURONS +
      Math.max(outputMegapixels - 1, 0) * DEFAULT_CLOUDFLARE_INPUT_NEURONS_PER_MP +
      inputMegapixels * DEFAULT_CLOUDFLARE_INPUT_NEURONS_PER_MP
    );
  }

  private megapixels(width: number, height: number): number {
    return (width * height) / (1024 * 1024);
  }

  private variantFingerprint(runId: string, index: number): string {
    return createHash('sha256')
      .update(`aluna:${runId}:${index}`)
      .digest('hex')
      .slice(0, 12)
      .toUpperCase();
  }

  private variantSeed(runId: string, index: number): number {
    const hash = createHash('sha256').update(`aluna-seed:${runId}:${index}`).digest();
    return hash.readUInt32BE(0) % 2_147_483_647;
  }

  private cloudflareRetrySeed(seed: number): number {
    return (seed + 104_729) % 2_147_483_647 || 1;
  }

  private providerError(message: string, status: number, providerCode?: number): Error {
    return Object.assign(new Error(message), { status, providerCode });
  }

  private providerErrorMetadata(error: unknown): ProviderErrorMetadata {
    if (typeof error !== 'object' || !error) return {};
    const metadata = error as ProviderErrorMetadata;
    return {
      status: typeof metadata.status === 'number' ? metadata.status : undefined,
      providerCode: typeof metadata.providerCode === 'number' ? metadata.providerCode : undefined,
      providerUsageUnits:
        typeof metadata.providerUsageUnits === 'number' ? metadata.providerUsageUnits : undefined,
      costUsd: typeof metadata.costUsd === 'number' ? metadata.costUsd : undefined,
    };
  }

  private isCloudflareSafetyError(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
    const { providerCode } = this.providerErrorMetadata(error);
    return (
      providerCode === 3030 ||
      message.includes('output has been flagged') ||
      message.includes('prompt / input image combination')
    );
  }

  private withCloudflareAttemptUsage(
    error: unknown,
    attempts: number,
    costPerAttempt: number,
    unitsPerAttempt: number,
  ): Error {
    const normalized = error instanceof Error ? error : new Error(String(error));
    return Object.assign(normalized, {
      providerUsageUnits: unitsPerAttempt * attempts,
      costUsd: costPerAttempt * attempts,
    });
  }

  private classifyError(error: unknown): string {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
    const status =
      typeof error === 'object' && error && 'status' in error && typeof error.status === 'number'
        ? error.status
        : undefined;
    if (message.includes('not configured') || message.includes('is missing'))
      return 'configuration';
    if (message.includes('daily demo budget')) return 'daily_budget';
    if (
      message.includes('billing') ||
      message.includes('quota') ||
      message.includes('hard limit')
    ) {
      return 'billing_limit';
    }
    if (
      status === 429 ||
      message.includes('rate limit') ||
      message.includes('resource exhausted')
    ) {
      return 'rate_limit';
    }
    if (status === 401) return 'authentication';
    if (status === 403) return 'permission';
    if (
      this.isCloudflareSafetyError(error) ||
      message.includes('content policy') ||
      message.includes('safety')
    ) {
      return 'content_policy';
    }
    if (message.includes('connection') || message.includes('network')) return 'connection';
    if (status === 400) return 'invalid_request';
    return 'provider_error';
  }

  private detectImageMime(body: Buffer): string {
    if (body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      return 'image/png';
    }
    if (body[0] === 0xff && body[1] === 0xd8) return 'image/jpeg';
    if (body.subarray(0, 4).toString('ascii') === 'RIFF') return 'image/webp';
    return 'image/png';
  }

  private extensionForMime(mimeType: string): string {
    if (mimeType === 'image/jpeg') return '.jpg';
    if (mimeType === 'image/webp') return '.webp';
    return '.png';
  }

  private outputTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }
}
