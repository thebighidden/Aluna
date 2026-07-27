import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { GenerationModule } from '../generation/generation.module';
import { GENERATION_QUEUE } from './generation-queue.constants';
import { GenerationProcessor } from './generation.processor';
import { GenerationsController } from './generations.controller';
import { GenerationsEventsService } from './generations-events.service';

@Module({
  imports: [BullModule.registerQueue({ name: GENERATION_QUEUE }), GenerationModule],
  controllers: [GenerationsController],
  providers: [GenerationProcessor, GenerationsEventsService],
})
export class GenerationsModule {}
