import { Processor, WorkerHost } from '@nestjs/bullmq';
import { GenerationStatus } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GenerationService } from '../generation/generation.service';
import { isProductCategory } from '../generation/styles.config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GENERATION_QUEUE, GenerationJobData } from './generation-queue.constants';

@Processor(GENERATION_QUEUE, { concurrency: 2 })
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(
    private readonly generationService: GenerationService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<GenerationJobData>): Promise<{ outputKeys: string[] }> {
    const { generationId, inputKey, category, sceneId, variants } = job.data;
    if (!isProductCategory(category)) {
      throw new Error(`Queued job contains unknown category "${category}"`);
    }

    await this.prisma.generation.update({
      where: { id: generationId },
      data: { status: GenerationStatus.ANALYZING },
    });
    await job.updateProgress({ state: 'analyzing' });

    const materialized = await this.storage.materialize(inputKey);
    try {
      await job.updateProgress({ state: 'generating', total: variants });
      const result = await this.generationService.generate(
        {
          imagePath: materialized.path,
          category,
          sceneId,
          variants,
        },
        {
          runId: generationId,
          inputKey,
          outputPrefix: `generations/${generationId}`,
          onVariantComplete: async (variant) => {
            await job.updateProgress({
              state: 'variant',
              completed: variant.index,
              total: variants,
              key: variant.key,
              costUsd: variant.costUsd,
              durationMs: variant.durationMs,
            });
          },
        },
      );
      return { outputKeys: result.outputKeys };
    } catch (error) {
      this.logger.error(`Generation job ${generationId} failed`, error);
      throw error;
    } finally {
      await materialized.cleanup();
    }
  }
}
