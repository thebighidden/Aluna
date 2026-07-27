import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from '../config/env.validation';
import { GenerationModule } from '../generation/generation.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/api/.env'],
      validationSchema: envValidationSchema,
    }),
    PrismaModule,
    StorageModule,
    GenerationModule,
  ],
})
export class CliModule {}
