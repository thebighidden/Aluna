import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteVisitDto } from './dto/create-site-visit.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordVisit(dto: CreateSiteVisitDto, userAgent = '', country?: string) {
    const recent = new Date(Date.now() - 5_000);
    const duplicate = await this.prisma.siteVisit.findFirst({
      where: {
        visitorId: dto.visitorId,
        path: dto.path,
        createdAt: { gte: recent },
      },
      select: { id: true },
    });
    if (duplicate) return { recorded: false };

    await this.prisma.siteVisit.create({
      data: {
        path: dto.path,
        visitorId: dto.visitorId,
        referrer: dto.referrer?.trim() || null,
        country: country?.trim().slice(0, 2).toUpperCase() || null,
        device: this.deviceType(userAgent),
      },
    });
    return { recorded: true };
  }

  private deviceType(userAgent: string): string {
    if (/bot|crawler|spider|headless/i.test(userAgent)) return 'bot';
    if (/tablet|ipad/i.test(userAgent)) return 'tablet';
    if (/mobile|android|iphone/i.test(userAgent)) return 'mobile';
    return 'desktop';
  }
}
