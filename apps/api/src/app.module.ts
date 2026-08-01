import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisConnectionFromUrl } from './config/redis';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { GenerationModule } from './generation/generation.module';
import { GenerationsModule } from './generations/generations.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';

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
    AuthModule,
    AdminModule,
    StorageModule,
    GenerationModule,
    GenerationsModule,
    WaitlistModule,
    UsersModule,
  ],
})
export class AppModule {}
