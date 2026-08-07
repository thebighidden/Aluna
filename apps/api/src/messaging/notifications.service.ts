import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

export type NotificationChannel = 'in_app' | 'email' | 'both';

export interface BroadcastResult {
  created: number;
  emailsSent: number;
  emailsFailed: number;
  emailConfigured: boolean;
  errors: string[];
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly email: EmailService,
  ) {}

  async listForUser(userId: string, limit = 40) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      unread,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        channel: item.channel,
        read: Boolean(item.readAt),
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    await this.prisma.notification.update({
      where: { id },
      data: { readAt: notification.readAt ?? new Date() },
    });
    return this.listForUser(userId);
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return this.listForUser(userId);
  }

  /** Sends to an explicit set of users, or to every active user when userIds is empty. */
  async broadcast(input: {
    userIds: string[];
    title: string;
    body: string;
    channel: NotificationChannel;
  }): Promise<BroadcastResult> {
    const recipients = await this.prisma.user.findMany({
      where: input.userIds.length ? { id: { in: input.userIds } } : { isActive: true },
      select: { id: true, email: true },
    });
    if (!recipients.length) {
      throw new NotFoundException('No matching recipients');
    }

    const wantsEmail = input.channel === 'email' || input.channel === 'both';
    const result: BroadcastResult = {
      created: 0,
      emailsSent: 0,
      emailsFailed: 0,
      emailConfigured: this.email.configured,
      errors: [],
    };

    for (const recipient of recipients) {
      let emailSentAt: Date | null = null;
      let emailError: string | null = null;
      if (wantsEmail) {
        const sent = await this.email.send({
          to: recipient.email,
          subject: input.title,
          body: input.body,
        });
        if (sent.sent) {
          emailSentAt = new Date();
          result.emailsSent += 1;
        } else {
          emailError = sent.error ?? 'Unknown email error';
          result.emailsFailed += 1;
          if (!result.errors.includes(emailError)) result.errors.push(emailError);
        }
      }
      // The in-app record is written even when email fails, so the message is never simply lost.
      await this.prisma.notification.create({
        data: {
          userId: recipient.id,
          title: input.title,
          body: input.body,
          channel: input.channel,
          emailSentAt,
          emailError,
        },
      });
      result.created += 1;
    }

    return result;
  }

  /** Used by the support flow to tell a user an admin replied. */
  async notifyUser(userId: string, title: string, body: string): Promise<void> {
    await this.prisma.notification.create({
      data: { userId, title, body, channel: 'in_app' },
    });
  }
}
