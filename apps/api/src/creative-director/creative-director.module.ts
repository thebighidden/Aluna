import { Module } from '@nestjs/common';
import { BrandProfileModule } from '../brand-profile/brand-profile.module';
import { ProductAnalysisModule } from '../product-analysis/product-analysis.module';
import { CreativeDirectorService } from './creative-director.service';
import { CreativeDirectorController } from './creative-director.controller';

@Module({
  imports: [BrandProfileModule, ProductAnalysisModule],
  controllers: [CreativeDirectorController],
  providers: [CreativeDirectorService],
  exports: [CreativeDirectorService],
})
export class CreativeDirectorModule {}
