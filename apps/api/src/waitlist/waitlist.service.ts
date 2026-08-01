import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWaitlistSubscriberDto } from './dto/create-waitlist-subscriber.dto';

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(dto: CreateWaitlistSubscriberDto): Promise<{ status: 'subscribed' }> {
    await this.prisma.waitlistSubscriber.upsert({
      where: { phone: dto.phone },
      create: {
        phone: dto.phone,
        locale: dto.locale ?? 'en',
        source: dto.source ?? 'landing',
        offerCode: 'launch_free_week',
      },
      update: {
        locale: dto.locale ?? 'en',
        source: dto.source ?? 'landing',
        offerCode: 'launch_free_week',
      },
    });

    return { status: 'subscribed' };
  }
}
