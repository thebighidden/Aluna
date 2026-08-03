import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerationStatus, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { GenerationService, GenerationProvider } from '../generation/generation.service';
import { PrismaService } from '../prisma/prisma.service';
import { GENERATION_QUEUE, GenerationJobData } from '../generations/generation-queue.constants';
import { AdminGenerationQueryDto } from './dto/admin-generation-query.dto';

type DailyMetric = {
  date: string;
  label: string;
  requests: number;
  images: number;
  spendUsd: number;
  failures: number;
};

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @InjectQueue(GENERATION_QUEUE) private readonly queue: Queue<GenerationJobData>,
    @Inject(GenerationService) private readonly generationService: GenerationService,
  ) {}

  async overview(days: number) {
    const runtime = this.generationService.getRuntimeConfiguration();
    const now = new Date();
    const from = new Date(now);
    from.setUTCHours(0, 0, 0, 0);
    from.setUTCDate(from.getUTCDate() - (days - 1));

    const [runs, users, visits, waitlistCount, queue, platformUsage] = await Promise.all([
      this.prisma.generation.findMany({
        where: { createdAt: { gte: from } },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          loginCount: true,
          createdAt: true,
        },
      }),
      this.prisma.siteVisit.findMany({
        where: { createdAt: { gte: from } },
        orderBy: { createdAt: 'desc' },
        select: {
          path: true,
          visitorId: true,
          country: true,
          device: true,
          createdAt: true,
        },
      }),
      this.prisma.waitlistSubscriber.count(),
      this.queueHealth(),
      this.platformUsage(runtime.provider, from, now, days),
    ]);

    const completed = runs.filter((run) => run.status === GenerationStatus.DONE);
    const failed = runs.filter((run) => run.status === GenerationStatus.FAILED);
    const images = runs.reduce((sum, run) => sum + run.outputKeys.length, 0);
    const spendUsd = runs.reduce((sum, run) => sum + Number(run.costUsd), 0);
    const completedDuration = completed.reduce((sum, run) => sum + run.durationMs, 0);
    const finished = completed.length + failed.length;
    const activeProviderRuns = runs.filter((run) => run.provider === runtime.provider);
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const todayProviderUnits = activeProviderRuns
      .filter((run) => run.createdAt >= today)
      .reduce((sum, run) => sum + Number(run.providerUsageUnits), 0);
    const remainingFreeUnits =
      runtime.dailyFreeUnits === null
        ? null
        : Math.max(runtime.dailyFreeUnits - todayProviderUnits, 0);
    const estimatedImagesRemaining =
      remainingFreeUnits === null || !runtime.estimatedUnitsPerImage
        ? null
        : Math.floor(remainingFreeUnits / runtime.estimatedUnitsPerImage);
    const latestProviderFailure = activeProviderRuns.find((run) => run.error);

    return {
      range: { days, from: from.toISOString(), to: now.toISOString() },
      summary: {
        requests: runs.length,
        images,
        spendUsd: this.money(spendUsd),
        successRate: finished ? Math.round((completed.length / finished) * 1000) / 10 : 0,
        averageDurationMs: completed.length ? Math.round(completedDuration / completed.length) : 0,
        failed: failed.length,
        totalUsers: users.length,
        activeUsers: users.filter((user) => user.isActive).length,
        siteVisits: visits.length,
        uniqueVisitors: new Set(visits.map((visit) => visit.visitorId)).size,
        waitlistSubscribers: waitlistCount,
        totalTokens: runs.reduce((sum, run) => sum + run.totalTokens, 0),
        providerUsageUnits: activeProviderRuns.reduce(
          (sum, run) => sum + Number(run.providerUsageUnits),
          0,
        ),
        providerUsageUnit: runtime.usageUnit,
      },
      trend: this.trend(days, from, runs),
      trafficTrend: this.trafficTrend(days, from, visits),
      topPages: this.topPages(visits),
      deviceBreakdown: this.deviceBreakdown(visits),
      categoryBreakdown: this.categoryBreakdown(runs),
      statusBreakdown: Object.values(GenerationStatus).map((status) => ({
        status: status.toLowerCase(),
        count: runs.filter((run) => run.status === status).length,
      })),
      providerBreakdown: this.providerBreakdown(runs),
      userConsumption: users.map((user) => {
        const userRuns = runs.filter((run) => run.userId === user.id);
        const providerUsage = [...new Set(userRuns.map((run) => run.provider))].map((provider) => {
          const providerRuns = userRuns.filter((run) => run.provider === provider);
          return {
            provider,
            units: this.units(
              providerRuns.reduce((sum, run) => sum + Number(run.providerUsageUnits), 0),
            ),
            unit:
              providerRuns.find((run) => Number(run.providerUsageUnits) > 0)?.providerUsageUnit ??
              (provider === 'cloudflare' ? 'neurons' : 'tokens'),
          };
        });
        return {
          ...user,
          requests: userRuns.length,
          images: userRuns.reduce((sum, run) => sum + run.outputKeys.length, 0),
          spendUsd: this.money(userRuns.reduce((sum, run) => sum + Number(run.costUsd), 0)),
          totalTokens: userRuns.reduce((sum, run) => sum + run.totalTokens, 0),
          providerUsage,
          failures: userRuns.filter((run) => run.status === GenerationStatus.FAILED).length,
          lastActivity: userRuns[0]?.createdAt ?? null,
        };
      }),
      recentGenerations: runs.slice(0, 25).map((run) => this.serializeRun(run)),
      queue,
      configuration: {
        provider: runtime.providerLabel,
        providerId: runtime.provider,
        configured: runtime.configured,
        missingConfiguration: runtime.missingConfiguration,
        model: runtime.model,
        quality: runtime.quality,
        imageSize: runtime.imageSize,
        usageUnit: runtime.usageUnit,
        dailyFreeUnits: runtime.dailyFreeUnits,
        todayProviderUnits: this.units(todayProviderUnits),
        remainingFreeUnits: remainingFreeUnits === null ? null : this.units(remainingFreeUnits),
        estimatedImagesRemaining,
        dailyCreditValueUsd:
          runtime.dailyFreeUnits === null
            ? null
            : this.money((runtime.dailyFreeUnits / 1_000) * 0.011),
        remainingCreditValueUsd:
          remainingFreeUnits === null ? null : this.money((remainingFreeUnits / 1_000) * 0.011),
        storage: this.hasR2Configuration() ? 'Cloudflare R2' : 'Local disk',
        costMode: platformUsage.connected
          ? 'OpenAI organization costs'
          : runtime.provider === 'cloudflare'
            ? 'Cloudflare list-price estimate · daily free allocation guarded'
            : 'Internal estimate',
        latestProviderError: latestProviderFailure?.error ?? null,
        latestProviderErrorCode: latestProviderFailure?.errorCode ?? null,
      },
      platformUsage,
    };
  }

  async generations(query: AdminGenerationQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.GenerationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
              { sceneId: { contains: search, mode: 'insensitive' } },
              { ownerName: { contains: search, mode: 'insensitive' } },
              { ownerEmail: { contains: search, mode: 'insensitive' } },
              { user: { name: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [total, runs] = await Promise.all([
      this.prisma.generation.count({ where }),
      this.prisma.generation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
    ]);
    return {
      total,
      skip: query.skip,
      take: query.take,
      items: runs.map((run) => this.serializeRun(run)),
    };
  }

  private trend(days: number, from: Date, runs: Awaited<ReturnType<typeof this.runsType>>) {
    const trend: DailyMetric[] = [];
    for (let index = 0; index < days; index += 1) {
      const date = new Date(from);
      date.setUTCDate(from.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      trend.push({
        date: key,
        label: date.toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        requests: 0,
        images: 0,
        spendUsd: 0,
        failures: 0,
      });
    }
    for (const run of runs) {
      const day = trend.find((item) => item.date === run.createdAt.toISOString().slice(0, 10));
      if (!day) continue;
      day.requests += 1;
      day.images += run.outputKeys.length;
      day.spendUsd = this.money(day.spendUsd + Number(run.costUsd));
      if (run.status === GenerationStatus.FAILED) day.failures += 1;
    }
    return trend;
  }

  private categoryBreakdown(runs: Awaited<ReturnType<typeof this.runsType>>) {
    const categories = ['clothing', 'cosmetics', 'food', 'jewelry', 'furniture', 'electronics'];
    return categories.map((category) => {
      const categoryRuns = runs.filter((run) => run.category === category);
      return {
        category,
        requests: categoryRuns.length,
        images: categoryRuns.reduce((sum, run) => sum + run.outputKeys.length, 0),
        spendUsd: this.money(categoryRuns.reduce((sum, run) => sum + Number(run.costUsd), 0)),
      };
    });
  }

  private trafficTrend(
    days: number,
    from: Date,
    visits: Array<{ visitorId: string; createdAt: Date }>,
  ) {
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(from);
      date.setUTCDate(from.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      const daily = visits.filter((visit) => visit.createdAt.toISOString().slice(0, 10) === key);
      return {
        date: key,
        label: date.toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        visits: daily.length,
        visitors: new Set(daily.map((visit) => visit.visitorId)).size,
      };
    });
  }

  private topPages(visits: Array<{ path: string; visitorId: string }>) {
    const pages = new Map<string, { visits: number; visitors: Set<string> }>();
    for (const visit of visits) {
      const page = pages.get(visit.path) ?? { visits: 0, visitors: new Set<string>() };
      page.visits += 1;
      page.visitors.add(visit.visitorId);
      pages.set(visit.path, page);
    }
    return [...pages.entries()]
      .map(([path, value]) => ({ path, visits: value.visits, visitors: value.visitors.size }))
      .sort((left, right) => right.visits - left.visits)
      .slice(0, 12);
  }

  private deviceBreakdown(visits: Array<{ device: string }>) {
    return ['desktop', 'mobile', 'tablet', 'bot'].map((device) => ({
      device,
      visits: visits.filter((visit) => visit.device === device).length,
    }));
  }

  private serializeRun(run: Awaited<ReturnType<typeof this.runsType>>[number]) {
    return {
      id: run.id,
      user:
        run.user ??
        (run.ownerName || run.ownerEmail
          ? {
              id: run.userId ?? 'deleted',
              name: run.ownerName ?? 'Deleted user',
              email: run.ownerEmail ?? '',
              role: 'USER',
            }
          : null),
      status: run.status.toLowerCase(),
      provider: run.provider,
      model: run.model,
      quality: run.quality,
      imageSize: run.imageSize,
      category: run.category,
      sceneId: run.sceneId,
      brief: run.brief,
      creativeOptions: run.creativeOptions,
      inputUrl: `/generations/${run.id}/input`,
      resultUrls: run.outputKeys.map(
        (_key, index) => `/generations/${run.id}/results/${index + 1}`,
      ),
      requestedVariants: run.requestedVariants,
      completedVariants: run.outputKeys.length,
      inputTokens: run.inputTokens,
      inputTextTokens: run.inputTextTokens,
      inputImageTokens: run.inputImageTokens,
      outputTokens: run.outputTokens,
      totalTokens: run.totalTokens,
      providerUsageUnits: Number(run.providerUsageUnits),
      providerUsageUnit: run.providerUsageUnit,
      costUsd: Number(run.costUsd),
      durationMs: run.durationMs,
      error: run.error,
      errorCode: run.errorCode,
      createdAt: run.createdAt,
    };
  }

  private providerBreakdown(runs: Awaited<ReturnType<typeof this.runsType>>) {
    return [...new Set(runs.map((run) => run.provider))].map((provider) => {
      const providerRuns = runs.filter((run) => run.provider === provider);
      const units = providerRuns.reduce((sum, run) => sum + Number(run.providerUsageUnits), 0);
      return {
        provider,
        requests: providerRuns.length,
        images: providerRuns.reduce((sum, run) => sum + run.outputKeys.length, 0),
        spendUsd: this.money(providerRuns.reduce((sum, run) => sum + Number(run.costUsd), 0)),
        usageUnits: this.units(units),
        usageUnit:
          providerRuns.find((run) => Number(run.providerUsageUnits) > 0)?.providerUsageUnit ??
          (provider === 'cloudflare' ? 'neurons' : 'tokens'),
      };
    });
  }

  private async queueHealth() {
    try {
      const [counts, workers] = await Promise.all([
        this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed', 'paused'),
        this.queue.getWorkers(),
      ]);
      return {
        ...counts,
        workers: workers.length,
        healthy: true,
      };
    } catch (error) {
      return {
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 0,
        paused: 0,
        workers: 0,
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async platformUsage(provider: GenerationProvider, from: Date, to: Date, days: number) {
    if (provider === 'cloudflare') {
      return {
        connected: false,
        reason:
          'Cloudflare Workers AI usage is metered locally in neurons. The 10,000-neuron daily guard resets at 00:00 UTC.',
        images: 0,
        requests: 0,
        costUsd: 0,
        daily: [],
      };
    }
    const adminKey = this.config.get<string>('OPENAI_ADMIN_KEY')?.trim();
    if (!adminKey) {
      return {
        connected: false,
        reason: 'Add OPENAI_ADMIN_KEY to reconcile organization usage and invoice costs.',
        images: 0,
        requests: 0,
        costUsd: 0,
        daily: [],
      };
    }

    const base = 'https://api.openai.com/v1/organization';
    const startTime = String(Math.floor(from.getTime() / 1000));
    const endTime = String(Math.floor(to.getTime() / 1000));
    const imageQuery = new URLSearchParams({
      start_time: startTime,
      end_time: endTime,
      bucket_width: '1d',
      limit: String(Math.min(days, 31)),
    });
    imageQuery.append('group_by', 'model');
    imageQuery.append('group_by', 'size');
    imageQuery.append('group_by', 'source');
    const costQuery = new URLSearchParams({
      start_time: startTime,
      end_time: endTime,
      bucket_width: '1d',
      limit: String(Math.min(days, 180)),
    });
    costQuery.append('group_by', 'line_item');

    try {
      const [usageResponse, costsResponse] = await Promise.all([
        fetch(`${base}/usage/images?${imageQuery}`, {
          headers: { Authorization: `Bearer ${adminKey}` },
        }),
        fetch(`${base}/costs?${costQuery}`, {
          headers: { Authorization: `Bearer ${adminKey}` },
        }),
      ]);
      if (!usageResponse.ok || !costsResponse.ok) {
        throw new Error(
          `OpenAI Usage API returned ${usageResponse.status}/${costsResponse.status}`,
        );
      }
      const usage = (await usageResponse.json()) as {
        data: Array<{
          start_time: number;
          results: Array<{ images?: number; num_model_requests?: number; model?: string }>;
        }>;
      };
      const costs = (await costsResponse.json()) as {
        data: Array<{
          start_time: number;
          results: Array<{ amount?: { value?: number }; line_item?: string | null }>;
        }>;
      };
      const daily = usage.data.map((bucket) => ({
        date: new Date(bucket.start_time * 1000).toISOString().slice(0, 10),
        images: bucket.results.reduce((sum, result) => sum + (result.images ?? 0), 0),
        requests: bucket.results.reduce((sum, result) => sum + (result.num_model_requests ?? 0), 0),
      }));
      return {
        connected: true,
        reason: null,
        images: daily.reduce((sum, day) => sum + day.images, 0),
        requests: daily.reduce((sum, day) => sum + day.requests, 0),
        costUsd: this.money(
          costs.data.reduce(
            (total, bucket) =>
              total + bucket.results.reduce((sum, result) => sum + (result.amount?.value ?? 0), 0),
            0,
          ),
        ),
        daily,
      };
    } catch (error) {
      return {
        connected: false,
        reason: error instanceof Error ? error.message : String(error),
        images: 0,
        requests: 0,
        costUsd: 0,
        daily: [],
      };
    }
  }

  private hasR2Configuration(): boolean {
    return ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].every((key) =>
      Boolean(this.config.get<string>(key)?.trim()),
    );
  }

  private money(value: number): number {
    return Math.round(value * 1_000_000) / 1_000_000;
  }

  private units(value: number): number {
    return Math.round(value * 100) / 100;
  }

  // This method exists only to keep Prisma's inferred run type local to the service.
  private runsType() {
    return this.prisma.generation.findMany({
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
  }
}
