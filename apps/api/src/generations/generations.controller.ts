import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Body,
  Controller,
  MessageEvent,
  Param,
  Post,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GenerationStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { memoryStorage } from 'multer';
import { Observable } from 'rxjs';
import { getScene, isProductCategory } from '../generation/styles.config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { GENERATION_QUEUE, GenerationJobData } from './generation-queue.constants';
import { GenerationsEventsService } from './generations-events.service';

@Controller('generations')
export class GenerationsController {
  constructor(
    @InjectQueue(GENERATION_QUEUE) private readonly queue: Queue<GenerationJobData>,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly events: GenerationsEventsService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024, files: 1 },
      fileFilter: (_request, file, callback) => {
        callback(
          file.mimetype.startsWith('image/')
            ? null
            : new BadRequestException('Only image uploads are accepted'),
          file.mimetype.startsWith('image/'),
        );
      },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateGenerationDto,
  ): Promise<{ id: string; status: string; eventsUrl: string }> {
    if (!file) throw new BadRequestException('A multipart image field named "image" is required');
    if (!isProductCategory(dto.category) || !getScene(dto.category, dto.sceneId)) {
      throw new BadRequestException(
        `Scene "${dto.sceneId}" is not valid for category "${dto.category}"`,
      );
    }

    const generationId = randomUUID();
    const inputKey = await this.storage.putInput(
      generationId,
      file.originalname,
      file.buffer,
      file.mimetype,
    );
    await this.prisma.generation.create({
      data: {
        id: generationId,
        userId: 'user_demo',
        status: GenerationStatus.QUEUED,
        category: dto.category,
        sceneId: dto.sceneId,
        inputKey,
      },
    });

    try {
      await this.queue.add(
        'generate',
        {
          generationId,
          inputKey,
          category: dto.category,
          sceneId: dto.sceneId,
          variants: dto.variants,
        },
        {
          jobId: generationId,
          attempts: 2,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: { age: 24 * 60 * 60 },
          removeOnFail: { age: 7 * 24 * 60 * 60 },
        },
      );
    } catch (error) {
      await this.prisma.generation.update({
        where: { id: generationId },
        data: {
          status: GenerationStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }

    return {
      id: generationId,
      status: 'queued',
      eventsUrl: `/generations/${generationId}/events`,
    };
  }

  @Sse(':id/events')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return this.events.stream(id);
  }
}
