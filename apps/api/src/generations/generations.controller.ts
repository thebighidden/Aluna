import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  MessageEvent,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Sse,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Generation, GenerationStatus, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { lookup } from 'mime-types';
import { randomUUID } from 'node:crypto';
import { memoryStorage } from 'multer';
import { Observable } from 'rxjs';
import { Permission } from '../auth/auth.constants';
import { RequestWithUser } from '../auth/auth-user.interface';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { campaignOptionGroups, parseCampaignOptions } from '../generation/campaign-options.config';
import { GenerationService } from '../generation/generation.service';
import { getScene, isProductCategory, STYLES_CONFIG } from '../generation/styles.config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { AnalyzeProductDto } from './dto/analyze-product.dto';
import { ShareGenerationDto } from './dto/share-generation.dto';
import { UpdateKeptAssetsDto } from './dto/update-kept-assets.dto';
import { GENERATION_QUEUE, GenerationJobData } from './generation-queue.constants';
import { GenerationsEventsService } from './generations-events.service';
import { CreativeDirectorService } from '../creative-director/creative-director.service';
import { ProductAnalysisService } from '../product-analysis/product-analysis.service';
import { aiSceneKey, isAiSceneId } from '../product-analysis/product-analysis.types';

@Controller('generations')
export class GenerationsController {
  constructor(
    @InjectQueue(GENERATION_QUEUE) private readonly queue: Queue<GenerationJobData>,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly events: GenerationsEventsService,
    private readonly generationService: GenerationService,
    private readonly creativeDirector: CreativeDirectorService,
    private readonly productAnalysis: ProductAnalysisService,
  ) {}

  @Post('analyze')
  @Permissions(Permission.GenerationCreate)
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
  async analyze(
    @Req() request: RequestWithUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: AnalyzeProductDto,
  ) {
    if (!file) throw new BadRequestException('A multipart image field named "image" is required');
    return this.productAnalysis.analyze({
      userId: request.user.id,
      image: file.buffer,
      mimeType: file.mimetype,
      inputKey: file.originalname,
      productType: dto.productType?.trim() || undefined,
      brief: dto.brief?.trim() || undefined,
    });
  }

  @Get('presets')
  @Permissions(Permission.PresetRead)
  presets() {
    return Object.entries(STYLES_CONFIG).map(([id, category]) => ({
      id,
      label: category.label,
      scenes: category.scenes.map(({ id: sceneId, name }) => ({ id: sceneId, name })),
      optionGroups: campaignOptionGroups(id as keyof typeof STYLES_CONFIG),
    }));
  }

  @Get('configuration')
  @Permissions(Permission.PresetRead)
  async configuration() {
    return this.generationService.getRuntimeConfiguration();
  }

  @Get()
  @Permissions(Permission.GenerationReadOwn)
  async list(@Req() request: RequestWithUser) {
    const canReadAll = request.user.permissions.includes(Permission.GenerationReadAll);
    const generations = await this.prisma.generation.findMany({
      where: canReadAll ? undefined : { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    return generations.map((generation) => this.serializeGeneration(generation));
  }

  @Post()
  @Permissions(Permission.GenerationCreate)
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
    @Req() request: RequestWithUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateGenerationDto,
  ): Promise<{
    id: string;
    status: string;
    provider: string;
    model: string;
    category: string;
    sceneId: string;
    contextWarnings: string[];
    statusUrl: string;
    eventsUrl: string;
  }> {
    if (!file) throw new BadRequestException('A multipart image field named "image" is required');
    if (!isProductCategory(dto.category)) {
      throw new BadRequestException(`Unknown category "${dto.category}"`);
    }

    const analysis = dto.analysisId
      ? await this.productAnalysis.findForUser(dto.analysisId, request.user.id)
      : null;
    if (dto.analysisId && !analysis) {
      throw new BadRequestException('That product analysis was not found');
    }
    if (isAiSceneId(dto.sceneId)) {
      const key = aiSceneKey(dto.sceneId);
      if (!analysis?.scenes.some((scene) => scene.id === key)) {
        throw new BadRequestException(
          `Scene "${dto.sceneId}" is not part of the supplied product analysis`,
        );
      }
    } else if (!getScene(dto.category, dto.sceneId)) {
      throw new BadRequestException(
        `Scene "${dto.sceneId}" is not valid for category "${dto.category}"`,
      );
    }
    await this.enforceGenerationPolicy(request.user.id, dto.variants);

    const campaign = dto.campaignId
      ? await this.prisma.campaign.findFirst({
          where: { id: dto.campaignId, userId: request.user.id },
          select: { id: true },
        })
      : null;
    if (dto.campaignId && !campaign) {
      throw new BadRequestException('That campaign was not found in your workspace');
    }

    let creativeOptions: Record<string, string>;
    try {
      creativeOptions = parseCampaignOptions(dto.category, dto.options);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }

    const generationId = randomUUID();
    const creativePlan = await this.creativeDirector.createPlan({
      userId: request.user.id,
      generationId,
      category: dto.category,
      sceneId: dto.sceneId,
      variants: dto.variants,
      productType: dto.productType?.trim() || undefined,
      brief: dto.brief?.trim() || undefined,
      options: creativeOptions,
      analysis,
    });
    const runtime = await this.generationService.getRuntimeConfiguration();
    const inputKey = await this.storage.putInput(
      generationId,
      file.originalname,
      file.buffer,
      file.mimetype,
    );
    await this.prisma.generation.create({
      data: {
        id: generationId,
        userId: request.user.id,
        campaignId: campaign?.id ?? null,
        ownerName: request.user.name,
        ownerEmail: request.user.email,
        provider: runtime.provider,
        model: runtime.model,
        quality: runtime.quality,
        imageSize: runtime.imageSize,
        providerUsageUnit: runtime.usageUnit,
        status: GenerationStatus.QUEUED,
        category: creativePlan.effectiveCategory,
        sceneId: creativePlan.effectiveSceneId,
        brief: dto.brief?.trim() || null,
        productType: dto.productType?.trim() || creativePlan.productContext.productType,
        creativeOptions,
        brandProfileVersion: creativePlan.brandProfileVersion,
        brandSnapshot: creativePlan.brandSnapshot
          ? (creativePlan.brandSnapshot as Prisma.InputJsonValue)
          : undefined,
        productContext: creativePlan.productContext as unknown as Prisma.InputJsonValue,
        creativePlan: creativePlan as unknown as Prisma.InputJsonValue,
        creativeFingerprint: creativePlan.fingerprint,
        contextWarnings: creativePlan.warnings,
        inputKey,
        requestedVariants: dto.variants,
      },
    });

    try {
      await this.queue.add(
        'generate',
        {
          generationId,
          userId: request.user.id,
          inputKey,
          category: creativePlan.effectiveCategory,
          sceneId: creativePlan.effectiveSceneId,
          variants: dto.variants,
          productType: dto.productType?.trim() || creativePlan.productContext.productType,
          brief: dto.brief?.trim() || undefined,
          options: creativeOptions,
          creativePlan,
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
      provider: runtime.provider,
      model: runtime.model,
      category: creativePlan.effectiveCategory,
      sceneId: creativePlan.effectiveSceneId,
      contextWarnings: creativePlan.warnings,
      statusUrl: `/generations/${generationId}`,
      eventsUrl: `/generations/${generationId}/events`,
    };
  }

  @Get(':id')
  @Permissions(Permission.GenerationReadOwn)
  async get(@Req() request: RequestWithUser, @Param('id') id: string) {
    const generation = await this.getAccessibleGeneration(request, id);
    return this.serializeGeneration(generation);
  }

  @Get(':id/results/:index')
  @Permissions(Permission.AssetRead)
  async result(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
  ): Promise<StreamableFile> {
    const generation = await this.getAccessibleGeneration(request, id);
    const key = generation.outputKeys[index - 1];
    if (!key) throw new NotFoundException(`Result ${index} was not found`);
    const body = await this.storage.get(key);
    const type = lookup(key) || 'image/png';
    return new StreamableFile(body, {
      type,
      disposition: `inline; filename="aluna-${id}-${String(index).padStart(2, '0')}"`,
    });
  }

  @Get(':id/input')
  @Permissions(Permission.AssetRead)
  async input(@Req() request: RequestWithUser, @Param('id') id: string): Promise<StreamableFile> {
    const generation = await this.getAccessibleGeneration(request, id);
    const body = await this.storage.get(generation.inputKey);
    const type = lookup(generation.inputKey) || 'image/jpeg';
    return new StreamableFile(body, {
      type,
      disposition: `inline; filename="aluna-${id}-source"`,
    });
  }

  @Sse(':id/events')
  @Permissions(Permission.GenerationReadOwn)
  async stream(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
  ): Promise<Observable<MessageEvent>> {
    await this.getAccessibleGeneration(request, id);
    return this.events.stream(id);
  }

  private async getAccessibleGeneration(request: RequestWithUser, id: string): Promise<Generation> {
    const canReadAll = request.user.permissions.includes(Permission.GenerationReadAll);
    const generation = await this.prisma.generation.findFirst({
      where: { id, ...(canReadAll ? {} : { userId: request.user.id }) },
    });
    if (!generation) throw new NotFoundException(`Generation "${id}" was not found`);
    return generation;
  }

  private async enforceGenerationPolicy(userId: string, variants: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        bannedUntil: true,
        requestLimitPerHour: true,
        requestLimitPerDay: true,
        maxVariantsPerRequest: true,
        maxConcurrentRequests: true,
      },
    });
    if (!user) throw new NotFoundException('The current user account no longer exists');
    if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
      throw new HttpException(
        `This account is banned until ${user.bannedUntil.toISOString()}`,
        HttpStatus.FORBIDDEN,
      );
    }
    if (variants > user.maxVariantsPerRequest) {
      throw new BadRequestException(
        `Your account allows at most ${user.maxVariantsPerRequest} images per request`,
      );
    }

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1_000);
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const [hourlyRequests, dailyRequests, activeRequests] = await Promise.all([
      user.requestLimitPerHour > 0
        ? this.prisma.generation.count({
            where: { userId, createdAt: { gte: hourAgo } },
          })
        : Promise.resolve(0),
      user.requestLimitPerDay > 0
        ? this.prisma.generation.count({
            where: { userId, createdAt: { gte: today } },
          })
        : Promise.resolve(0),
      this.prisma.generation.count({
        where: {
          userId,
          status: {
            in: [GenerationStatus.QUEUED, GenerationStatus.ANALYZING, GenerationStatus.GENERATING],
          },
        },
      }),
    ]);

    if (user.requestLimitPerHour > 0 && hourlyRequests >= user.requestLimitPerHour) {
      throw new HttpException(
        `Hourly request limit reached (${user.requestLimitPerHour}). Try again later.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (user.requestLimitPerDay > 0 && dailyRequests >= user.requestLimitPerDay) {
      throw new HttpException(
        `Daily request limit reached (${user.requestLimitPerDay}). It resets at 00:00 UTC.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (activeRequests >= user.maxConcurrentRequests) {
      throw new HttpException(
        `Concurrent request limit reached (${user.maxConcurrentRequests}). Wait for an active generation to finish.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  @Patch(':id/share')
  @Permissions(Permission.GenerationReadOwn)
  async setShared(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: ShareGenerationDto,
  ) {
    const generation = await this.prisma.generation.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!generation) throw new NotFoundException('Generation not found');
    if (dto.shared && (generation.status !== GenerationStatus.DONE || !generation.outputKeys.length)) {
      throw new BadRequestException('Only completed campaigns with images can be shared');
    }
    const updated = await this.prisma.generation.update({
      where: { id },
      data: { sharedAt: dto.shared ? new Date() : null },
    });
    return this.serializeGeneration(updated);
  }

  @Patch(':id/kept')
  @Permissions(Permission.GenerationReadOwn)
  async setKept(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateKeptAssetsDto,
  ) {
    const generation = await this.prisma.generation.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!generation) throw new NotFoundException('Generation not found');

    const valid = new Set(generation.outputKeys);
    const invalid = dto.keptOutputKeys.filter((key) => !valid.has(key));
    if (invalid.length) {
      throw new BadRequestException('One or more selected images do not belong to this campaign');
    }
    const updated = await this.prisma.generation.update({
      where: { id },
      data: { keptOutputKeys: [...new Set(dto.keptOutputKeys)] },
    });
    return this.serializeGeneration(updated);
  }

  private serializeGeneration(generation: Generation) {
    return {
      id: generation.id,
      status: generation.status.toLowerCase(),
      provider: generation.provider,
      model: generation.model,
      quality: generation.quality,
      imageSize: generation.imageSize,
      category: generation.category,
      sceneId: generation.sceneId,
      brief: generation.brief,
      productType: generation.productType,
      creativeOptions: generation.creativeOptions,
      brandProfileVersion: generation.brandProfileVersion,
      productContext: generation.productContext,
      creativePlan: generation.creativePlan,
      creativeFingerprint: generation.creativeFingerprint,
      contextWarnings: generation.contextWarnings,
      inputUrl: `/generations/${generation.id}/input`,
      outputKeys: generation.outputKeys,
      keptOutputKeys: generation.keptOutputKeys,
      requestedVariants: generation.requestedVariants,
      resultUrls: generation.outputKeys.map(
        (_key, index) => `/generations/${generation.id}/results/${index + 1}`,
      ),
      costUsd: Number(generation.costUsd),
      inputTokens: generation.inputTokens,
      inputTextTokens: generation.inputTextTokens,
      inputImageTokens: generation.inputImageTokens,
      outputTokens: generation.outputTokens,
      totalTokens: generation.totalTokens,
      providerUsageUnits: Number(generation.providerUsageUnits),
      providerUsageUnit: generation.providerUsageUnit,
      durationMs: generation.durationMs,
      error: generation.error,
      errorCode: generation.errorCode,
      campaignId: generation.campaignId,
      sharedAt: generation.sharedAt,
      createdAt: generation.createdAt,
    };
  }
}
