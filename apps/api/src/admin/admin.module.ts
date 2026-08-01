import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { GenerationModule } from '../generation/generation.module';
import { GENERATION_QUEUE } from '../generations/generation-queue.constants';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [BullModule.registerQueue({ name: GENERATION_QUEUE }), GenerationModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
