import { GoogleGenAI } from '@google/genai';
import { GenerationStatus, Prisma } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { lookup } from 'mime-types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { composePrompt, getScene, isProductCategory, ProductCategory } from './styles.config';

const MODEL = 'gemini-2.5-flash-image';
const DEFAULT_IMAGE_OUTPUT_COST_USD = 0.039;
const DEFAULT_INPUT_COST_PER_MILLION_TOKENS_USD = 0.3;

export interface GenerateImagesInput {
  imagePath: string;
  category: ProductCategory;
  sceneId: string;
  variants: number;
}

export interface VariantResult {
  index: number;
  key: string;
  costUsd: number;
  durationMs: number;
  mimeType: string;
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

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);
  private readonly ai: GoogleGenAI;
  private readonly imageOutputCostUsd: number;
  private readonly inputCostPerMillionTokensUsd: number;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is missing. Copy apps/api/.env.example to apps/api/.env and add a Gemini API key.',
      );
    }

    this.ai = new GoogleGenAI({ apiKey });
    this.imageOutputCostUsd =
      this.config.get<number>('GEMINI_IMAGE_OUTPUT_COST_USD') ?? DEFAULT_IMAGE_OUTPUT_COST_USD;
    this.inputCostPerMillionTokensUsd =
      this.config.get<number>('GEMINI_INPUT_COST_PER_MILLION_TOKENS_USD') ??
      DEFAULT_INPUT_COST_PER_MILLION_TOKENS_USD;
  }

  async generate(
    input: GenerateImagesInput,
    context: GenerationContext = {},
  ): Promise<GenerationResult> {
    this.validateInput(input);

    const sourceImage = await readFile(input.imagePath);
    const mimeType = lookup(input.imagePath) || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      throw new Error(`Input must be an image; detected MIME type "${mimeType}"`);
    }

    const startedAt = Date.now();
    const timestamp = this.outputTimestamp();
    const outputPrefix = context.outputPrefix ?? timestamp;
    const runId = await this.prepareRun(input, context.inputKey ?? input.imagePath, context.runId);
    const basePrompt = composePrompt(input.category, input.sceneId);
    const results: VariantResult[] = [];

    try {
      for (let index = 1; index <= input.variants; index += 1) {
        const variant = await this.generateVariant({
          image: sourceImage,
          mimeType,
          prompt: this.variantPrompt(basePrompt, index, input.variants),
          index,
          outputPrefix,
        });
        results.push(variant);

        const cumulativeCost = results.reduce((sum, result) => sum + result.costUsd, 0);
        const cumulativeDuration = Date.now() - startedAt;
        await this.prisma.generation.update({
          where: { id: runId },
          data: {
            status: GenerationStatus.GENERATING,
            outputKeys: results.map(({ key }) => key),
            costUsd: new Prisma.Decimal(cumulativeCost.toFixed(6)),
            durationMs: cumulativeDuration,
          },
        });
        await context.onVariantComplete?.(variant);
      }

      const durationMs = Date.now() - startedAt;
      const costUsd = results.reduce((sum, result) => sum + result.costUsd, 0);
      const outputKeys = results.map(({ key }) => key);
      await this.prisma.generation.update({
        where: { id: runId },
        data: {
          status: GenerationStatus.DONE,
          outputKeys,
          costUsd: new Prisma.Decimal(costUsd.toFixed(6)),
          durationMs,
          error: null,
        },
      });

      return { runId, outputKeys, costUsd, durationMs, variants: results };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.generation
        .update({
          where: { id: runId },
          data: {
            status: GenerationStatus.FAILED,
            durationMs: Date.now() - startedAt,
            error: message,
          },
        })
        .catch((persistenceError: unknown) => {
          this.logger.error('Could not persist generation failure', persistenceError);
        });
      throw error;
    }
  }

  private async generateVariant(args: {
    image: Buffer;
    mimeType: string;
    prompt: string;
    index: number;
    outputPrefix: string;
  }): Promise<VariantResult> {
    const startedAt = Date.now();
    const response = await this.ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          inlineData: {
            data: args.image.toString('base64'),
            mimeType: args.mimeType,
          },
        },
        { text: args.prompt },
      ],
      config: {
        responseModalities: ['Image'],
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.data,
    );
    const imageData = imagePart?.inlineData?.data;
    if (!imageData) {
      const modelText = response.text?.trim();
      throw new Error(
        `Gemini returned no image for variant ${args.index}${
          modelText ? `: ${modelText.slice(0, 300)}` : ''
        }`,
      );
    }

    const outputMimeType = imagePart.inlineData?.mimeType ?? 'image/png';
    const extension = this.extensionForMime(outputMimeType);
    const key = await this.storage.putOutput(
      args.outputPrefix,
      `variant-${String(args.index).padStart(2, '0')}${extension}`,
      Buffer.from(imageData, 'base64'),
      outputMimeType,
    );
    const durationMs = Date.now() - startedAt;
    const promptTokens = response.usageMetadata?.promptTokenCount ?? 0;
    const costUsd =
      this.imageOutputCostUsd + (promptTokens / 1_000_000) * this.inputCostPerMillionTokensUsd;

    this.logger.log(
      `Variant ${args.index}: ${durationMs} ms, estimated $${costUsd.toFixed(6)}, output ${key}`,
    );
    return { index: args.index, key, costUsd, durationMs, mimeType: outputMimeType };
  }

  private async prepareRun(
    input: GenerateImagesInput,
    inputKey: string,
    existingRunId?: string,
  ): Promise<string> {
    if (existingRunId) {
      const run = await this.prisma.generation.update({
        where: { id: existingRunId },
        data: { status: GenerationStatus.GENERATING, error: null },
        select: { id: true },
      });
      return run.id;
    }

    const run = await this.prisma.generation.create({
      data: {
        status: GenerationStatus.GENERATING,
        category: input.category,
        sceneId: input.sceneId,
        inputKey,
      },
      select: { id: true },
    });
    return run.id;
  }

  private validateInput(input: GenerateImagesInput): void {
    if (!isProductCategory(input.category)) {
      throw new Error(`Unknown category "${String(input.category)}"`);
    }
    if (!getScene(input.category, input.sceneId)) {
      composePrompt(input.category, input.sceneId);
    }
    if (!Number.isInteger(input.variants) || input.variants < 1 || input.variants > 8) {
      throw new Error('variants must be an integer between 1 and 8');
    }
  }

  private variantPrompt(basePrompt: string, index: number, total: number): string {
    return `${basePrompt}

VARIANT DIRECTION:
Create image ${index} of ${total}. Make this composition meaningfully distinct through a fresh but
physically plausible arrangement, camera distance, and supporting-light nuance while obeying every
product-fidelity constraint above. Return one finished image only.`;
  }

  private outputTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  private extensionForMime(mimeType: string): string {
    if (mimeType === 'image/jpeg') return '.jpg';
    if (mimeType === 'image/webp') return '.webp';
    return '.png';
  }
}
