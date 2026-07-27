import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisConnectionFromUrl } from './config/redis';
import { envValidationSchema } from './config/env.validation';
import { GenerationModule } from './generation/generation.module';
import { GenerationsModule } from './generations/generations.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/api/.env'],
      validationSchema: envValidationSchema,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnectionFromUrl(config.getOrThrow<string>('REDIS_URL')),
      }),
    }),
    PrismaModule,
    StorageModule,
    GenerationModule,
    GenerationsModule,
  ],
})
export class AppModule {}
