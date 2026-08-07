import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { lookup } from 'mime-types';
import { Permission } from '../auth/auth.constants';
import { RequestWithUser } from '../auth/auth-user.interface';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Controller('gallery')
export class GalleryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @Permissions(Permission.GenerationReadOwn)
  async list(@Req() request: RequestWithUser) {
    const shared = await this.prisma.generation.findMany({
      where: { sharedAt: { not: null }, status: 'DONE' },
      orderBy: { sharedAt: 'desc' },
      take: 60,
    });
    return shared.map((generation) => ({
      id: generation.id,
      category: generation.category,
      sceneId: generation.sceneId,
      productType: generation.productType,
      brief: generation.brief,
      creativeOptions: generation.creativeOptions,
      author: generation.ownerName?.split(' ')[0] ?? 'Aluna creator',
      mine: generation.userId === request.user.id,
      assetUrls: generation.outputKeys.map(
        (_key, index) => `/gallery/${generation.id}/assets/${index + 1}`,
      ),
      sharedAt: generation.sharedAt,
    }));
  }

  @Get(':id/assets/:index')
  @Permissions(Permission.AssetRead)
  async asset(
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
  ): Promise<StreamableFile> {
    const generation = await this.prisma.generation.findFirst({
      where: { id, sharedAt: { not: null } },
    });
    if (!generation) throw new NotFoundException('This shared campaign is no longer available');
    const key = generation.outputKeys[index - 1];
    if (!key) throw new NotFoundException(`Asset ${index} was not found`);
    const body = await this.storage.get(key);
    const type = lookup(key) || 'image/png';
    return new StreamableFile(body, {
      type,
      disposition: `inline; filename="aluna-gallery-${id}-${String(index).padStart(2, '0')}"`,
    });
  }
}
