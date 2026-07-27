import { Injectable, MessageEvent, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobProgress, QueueEvents } from 'bullmq';
import { Observable } from 'rxjs';
import { redisConnectionFromUrl } from '../config/redis';
import { PrismaService } from '../prisma/prisma.service';
import { GENERATION_QUEUE } from './generation-queue.constants';

@Injectable()
export class GenerationsEventsService implements OnModuleInit, OnModuleDestroy {
  private queueEvents!: QueueEvents;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.config.getOrThrow<string>('REDIS_URL');
    this.queueEvents = new QueueEvents(GENERATION_QUEUE, {
      connection: redisConnectionFromUrl(redisUrl),
    });
    this.queueEvents.setMaxListeners(0);
    await this.queueEvents.waitUntilReady();
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents.close();
  }

  stream(generationId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const emit = (event: string, data: string | object): void => {
        subscriber.next({ type: event, data });
      };

      const onProgress = ({ jobId, data }: { jobId: string; data: JobProgress }): void => {
        if (jobId !== generationId) return;
        if (typeof data === 'object' && data && 'state' in data) {
          const progress = data as { state: string };
          emit(progress.state === 'variant' ? 'variant-complete' : progress.state, data);
        } else {
          emit('generating', { progress: data });
        }
      };

      const onCompleted = ({
        jobId,
        returnvalue,
      }: {
        jobId: string;
        returnvalue: string;
      }): void => {
        if (jobId !== generationId) return;
        const parsed = this.parseJson(returnvalue);
        emit('done', parsed);
        subscriber.complete();
      };

      const onFailed = ({ jobId, failedReason }: { jobId: string; failedReason: string }): void => {
        if (jobId !== generationId) return;
        emit('failed', { error: failedReason });
        subscriber.complete();
      };

      this.queueEvents.on('progress', onProgress);
      this.queueEvents.on('completed', onCompleted);
      this.queueEvents.on('failed', onFailed);

      void this.emitCurrentState(generationId, emit, subscriber);

      return () => {
        this.queueEvents.off('progress', onProgress);
        this.queueEvents.off('completed', onCompleted);
        this.queueEvents.off('failed', onFailed);
      };
    });
  }

  private async emitCurrentState(
    generationId: string,
    emit: (event: string, data: string | object) => void,
    subscriber: { complete: () => void; error: (error: unknown) => void },
  ): Promise<void> {
    try {
      const generation = await this.prisma.generation.findUnique({
        where: { id: generationId },
      });
      if (!generation) {
        subscriber.error(new Error(`Generation "${generationId}" not found`));
        return;
      }

      const event = generation.status.toLowerCase();
      emit(event, {
        id: generation.id,
        status: event,
        outputKeys: generation.outputKeys,
        costUsd: Number(generation.costUsd),
        durationMs: generation.durationMs,
        error: generation.error,
      });
      if (event === 'done' || event === 'failed') subscriber.complete();
    } catch (error) {
      subscriber.error(error);
    }
  }

  private parseJson(value: string): string | object {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === 'object' && parsed !== null ? parsed : String(parsed);
    } catch {
      return value;
    }
  }
}
