import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { GenerationModule } from '../generation/generation.module';
import { GENERATION_QUEUE } from './generation-queue.constants';
import { GenerationProcessor } from './generation.processor';
import { GenerationsController } from './generations.controller';
import { GalleryController } from './gallery.controller';
import { GenerationsEventsService } from './generations-events.service';
import { CreativeDirectorModule } from '../creative-director/creative-director.module';
import { ProductAnalysisModule } from '../product-analysis/product-analysis.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: GENERATION_QUEUE }),
    GenerationModule,
    CreativeDirectorModule,
    ProductAnalysisModule,
  ],
  controllers: [GenerationsController, GalleryController],
  providers: [GenerationProcessor, GenerationsEventsService],
})
export class GenerationsModule {}
