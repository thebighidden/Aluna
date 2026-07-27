import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { GenerationService } from './generation.service';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [GenerationService],
  exports: [GenerationService],
})
export class GenerationModule {}
