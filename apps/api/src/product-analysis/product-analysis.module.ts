import { Module } from '@nestjs/common';
import { BrandProfileModule } from '../brand-profile/brand-profile.module';
import { GenerationModule } from '../generation/generation.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductAnalysisService } from './product-analysis.service';

@Module({
  imports: [PrismaModule, GenerationModule, BrandProfileModule],
  providers: [ProductAnalysisService],
  exports: [ProductAnalysisService],
})
export class ProductAnalysisModule {}
