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
import { MessagingModule } from './messaging/messaging.module';
import { SupportModule } from './support/support.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthController } from './health/health.controller';
import { BrandProfileModule } from './brand-profile/brand-profile.module';
import { CampaignsModule } from './campaigns/campaigns.module';

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
    BrandProfileModule,
    AuthModule,
    AnalyticsModule,
    AdminModule,
    StorageModule,
    GenerationModule,
    GenerationsModule,
    CampaignsModule,
    WaitlistModule,
    UsersModule,
    MessagingModule,
    SupportModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
