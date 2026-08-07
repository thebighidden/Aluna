import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Campaign, Generation } from '@prisma/client';
import { Permission } from '../auth/auth.constants';
import { RequestWithUser } from '../auth/auth-user.interface';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { parseCampaignOptions } from '../generation/campaign-options.config';
import { getScene, isProductCategory } from '../generation/styles.config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Permissions(Permission.GenerationReadOwn)
  async list(@Req() request: RequestWithUser) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { userId: request.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        generations: {
          select: { status: true, outputKeys: true },
        },
      },
    });
    return campaigns.map((campaign) => ({
      ...this.serializeCampaign(campaign),
      runs: campaign.generations.length,
      assets: campaign.generations.reduce((total, run) => total + run.outputKeys.length, 0),
    }));
  }

  @Post()
  @Permissions(Permission.GenerationCreate)
  async create(@Req() request: RequestWithUser, @Body() dto: CreateCampaignDto) {
    const { category, sceneId, options } = this.validateDirection(
      dto.category,
      dto.sceneId,
      dto.options,
    );
    const campaign = await this.prisma.campaign.create({
      data: {
        userId: request.user.id,
        name: dto.name.trim(),
        productType: dto.productType?.trim() || null,
        category,
        sceneId,
        brief: dto.brief?.trim() || null,
        creativeOptions: options,
      },
    });
    return { ...this.serializeCampaign(campaign), runs: 0, assets: 0 };
  }

  @Get(':id')
  @Permissions(Permission.GenerationReadOwn)
  async get(@Req() request: RequestWithUser, @Param('id') id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, userId: request.user.id },
      include: { generations: { orderBy: { createdAt: 'desc' } } },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return {
      ...this.serializeCampaign(campaign),
      runs: campaign.generations.length,
      assets: campaign.generations.reduce((total, run) => total + run.outputKeys.length, 0),
      generations: campaign.generations.map((run) => this.serializeRun(run)),
    };
  }

  @Patch(':id')
  @Permissions(Permission.GenerationCreate)
  async update(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const category = dto.category ?? campaign.category;
    const sceneId = dto.sceneId ?? campaign.sceneId;
    const direction =
      dto.category !== undefined || dto.sceneId !== undefined || dto.options !== undefined
        ? this.validateDirection(category, sceneId, dto.options)
        : null;

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name?.trim() || undefined,
        productType: dto.productType !== undefined ? dto.productType.trim() || null : undefined,
        brief: dto.brief !== undefined ? dto.brief.trim() || null : undefined,
        ...(direction
          ? {
              category: direction.category,
              sceneId: direction.sceneId,
              ...(dto.options !== undefined
                ? { creativeOptions: direction.options }
                : {}),
            }
          : {}),
      },
    });
    return this.serializeCampaign(updated);
  }

  @Delete(':id')
  @Permissions(Permission.GenerationCreate)
  async remove(@Req() request: RequestWithUser, @Param('id') id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    await this.prisma.campaign.delete({ where: { id } });
    return { deleted: true };
  }

  private validateDirection(
    category: string,
    sceneId: string,
    rawOptions?: string,
  ): { category: string; sceneId: string; options: Record<string, string> } {
    if (!isProductCategory(category)) {
      throw new BadRequestException(`Unknown category "${category}"`);
    }
    if (!getScene(category, sceneId)) {
      throw new BadRequestException(
        `Scene "${sceneId}" is not valid for category "${category}"`,
      );
    }
    try {
      return { category, sceneId, options: parseCampaignOptions(category, rawOptions) };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }
  }

  private serializeCampaign(campaign: Campaign) {
    return {
      id: campaign.id,
      name: campaign.name,
      productType: campaign.productType,
      category: campaign.category,
      sceneId: campaign.sceneId,
      brief: campaign.brief,
      creativeOptions: campaign.creativeOptions,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  private serializeRun(run: Generation) {
    return {
      id: run.id,
      status: run.status.toLowerCase(),
      category: run.category,
      sceneId: run.sceneId,
      brief: run.brief,
      productType: run.productType,
      requestedVariants: run.requestedVariants,
      outputKeys: run.outputKeys,
      resultUrls: run.outputKeys.map(
        (_key, index) => `/generations/${run.id}/results/${index + 1}`,
      ),
      sharedAt: run.sharedAt,
      costUsd: Number(run.costUsd),
      error: run.error,
      createdAt: run.createdAt,
    };
  }
}
