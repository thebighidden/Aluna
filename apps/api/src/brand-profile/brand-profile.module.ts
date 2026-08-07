import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { BrandProfileController } from './brand-profile.controller';
import { BrandProfileService } from './brand-profile.service';

@Module({
  imports: [StorageModule],
  controllers: [BrandProfileController],
  providers: [BrandProfileService],
  exports: [BrandProfileService],
})
export class BrandProfileModule {}
