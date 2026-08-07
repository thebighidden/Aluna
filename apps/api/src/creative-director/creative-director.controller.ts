import { BadRequestException, Body, Controller, Post, Req } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Permission } from '../auth/auth.constants';
import { RequestWithUser } from '../auth/auth-user.interface';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { normalizeCampaignOptions } from '../generation/campaign-options.config';
import { getScene, isProductCategory } from '../generation/styles.config';
import { CreativeDirectorService } from './creative-director.service';
import { PreviewCreativePlanDto } from './dto/preview-creative-plan.dto';
import { ProductAnalysisService } from '../product-analysis/product-analysis.service';
import { aiSceneKey, isAiSceneId } from '../product-analysis/product-analysis.types';

@Controller('creative-director')
export class CreativeDirectorController {
  constructor(
    private readonly creativeDirector: CreativeDirectorService,
    private readonly productAnalysis: ProductAnalysisService,
  ) {}

  @Post('preview')
  @Permissions(Permission.GenerationCreate)
  async preview(@Req() request: RequestWithUser, @Body() dto: PreviewCreativePlanDto) {
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
    let options: Record<string, string>;
    try {
      options = normalizeCampaignOptions(dto.category, dto.options);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }
    return this.creativeDirector.createPlan({
      userId: request.user.id,
      generationId: randomUUID(),
      category: dto.category,
      sceneId: dto.sceneId,
      variants: dto.variants,
      productType: dto.productType?.trim() || undefined,
      brief: dto.brief?.trim() || undefined,
      options,
      analysis,
    });
  }
}
