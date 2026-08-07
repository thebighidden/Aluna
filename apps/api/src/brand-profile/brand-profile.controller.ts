import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Permission } from '../auth/auth.constants';
import { RequestWithUser } from '../auth/auth-user.interface';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BrandProfileService } from './brand-profile.service';
import { UpdateBrandProfileDto } from './dto/update-brand-profile.dto';

@Controller('brand-profile')
export class BrandProfileController {
  constructor(private readonly profiles: BrandProfileService) {}

  @Get()
  @Permissions(Permission.BrandProfileRead)
  get(@Req() request: RequestWithUser) {
    return this.profiles.get(request.user.id, request.user.name);
  }

  @Patch()
  @Permissions(Permission.BrandProfileManage)
  update(@Req() request: RequestWithUser, @Body() dto: UpdateBrandProfileDto) {
    return this.profiles.update(request.user.id, request.user.name, dto);
  }

  @Post('logo')
  @Permissions(Permission.BrandProfileManage)
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      fileFilter: (_request, file, callback) => {
        const allowed = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype);
        callback(allowed ? null : new BadRequestException('Use a PNG, JPG, or WEBP logo'), allowed);
      },
    }),
  )
  uploadLogo(
    @Req() request: RequestWithUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('A multipart image field named "logo" is required');
    return this.profiles.saveLogo(request.user.id, request.user.name, file);
  }

  @Get('logo')
  @Permissions(Permission.BrandProfileRead)
  async logo(@Req() request: RequestWithUser) {
    const logo = await this.profiles.logo(request.user.id);
    return new StreamableFile(logo.body, {
      type: logo.mimeType,
      disposition: `inline; filename="${logo.name.replace(/["\\]/g, '')}"`,
    });
  }
}
