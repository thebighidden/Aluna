import { GenerationStatus, Prisma } from '@prisma/client';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { lookup } from 'mime-types';
import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
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
          prompt: this.variantPrompt(basePrompt, index, input.variants),
          index,
          outputPrefix,
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
      await this.prisma.generation
        .update({
          where: { id: runId },
          data: {
            status: GenerationStatus.FAILED,
            durationMs: Date.now() - startedAt,
            error: message,
            errorCode,
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
    index: number;
    outputPrefix: string;
  }): Promise<VariantResult> {
    return this.provider === 'cloudflare'
      ? this.generateCloudflareVariant(args)
      : this.generateOpenAiVariant(args);
  }

  private async generateCloudflareVariant(args: {
    source: PreparedSource;
    prompt: string;
    index: number;
    outputPrefix: string;
  }): Promise<VariantResult> {
    const startedAt = Date.now();
    const form = new FormData();
    form.append('prompt', args.prompt);
    form.append('width', String(this.cloudflareWidth));
    form.append('height', String(this.cloudflareHeight));
    form.append('seed', String(this.variantSeed(args.index)));
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
      throw this.providerError(
        details || `Cloudflare Workers AI returned HTTP ${response.status}`,
        response.status,
      );
    }

    const encodedImage = payload.result?.image;
    if (!encodedImage) {
      throw this.providerError(`Cloudflare returned no image for variant ${args.index}`, 502);
    }
    const body = Buffer.from(encodedImage.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
    const outputMimeType = this.detectImageMime(body);
    const extension = this.extensionForMime(outputMimeType);
    const key = await this.storage.putOutput(
      args.outputPrefix,
      `variant-${String(args.index).padStart(2, '0')}${extension}`,
      body,
      outputMimeType,
    );
    const durationMs = Date.now() - startedAt;
    const costUsd = this.estimateCloudflareCost(args.source.megapixels);
    const providerUnits = this.estimateCloudflareUsageUnits(args.source.megapixels);
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
      `Cloudflare variant ${args.index}: ${durationMs} ms, ~${providerUnits.toFixed(2)} neurons, estimated $${costUsd.toFixed(6)}, output ${key}`,
    );
    return { index: args.index, key, costUsd, durationMs, mimeType: outputMimeType, usage };
  }

  private async generateOpenAiVariant(args: {
    source: PreparedSource;
    prompt: string;
    index: number;
    outputPrefix: string;
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

  private async assertCloudflareDailyBudget(runId: string, inputMegapixels: number): Promise<void> {
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
    if (used + next > this.cloudflareDailyNeuronBudget) {
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
    if (!Number.isInteger(input.variants) || input.variants < 1 || input.variants > 8) {
      throw new Error('variants must be an integer between 1 and 8');
    }
  }

  private variantPrompt(basePrompt: string, index: number, total: number): string {
    return `${basePrompt}

REFERENCE IMAGE:
Image 0 is the exact source product. Preserve it as the single source of truth. Do not redesign,
reinterpret, replace, or invent any part of it.

VARIANT DIRECTION:
Create image ${index} of ${total}. Make this composition meaningfully distinct through a fresh but
physically plausible arrangement, camera distance, and supporting-light nuance while obeying every
product-fidelity constraint above. Return one finished image only.`;
  }

  private composeGenerationPrompt(input: GenerateImagesInput): string {
    const presetPrompt = composePrompt(input.category, input.sceneId);
    const brief = input.brief?.trim();
    if (!brief) return presetPrompt;
    return `${presetPrompt}

CAMPAIGN BRIEF:
Apply this additional art direction only where it does not conflict with product fidelity or the scene
preset: ${brief}`;
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

  private variantSeed(index: number): number {
    return (Date.now() + index * 104_729) % 2_147_483_647;
  }

  private providerError(message: string, status: number): Error {
    return Object.assign(new Error(message), { status });
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
    if (message.includes('content policy') || message.includes('safety')) return 'content_policy';
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
