import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../messaging/notifications.service';

export const SUPPORT_STATUSES = ['open', 'pending', 'closed'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

const TICKET_INCLUDE = {
  messages: { orderBy: { createdAt: 'asc' } },
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.SupportTicketInclude;

type TicketWithRelations = Prisma.SupportTicketGetPayload<{ include: typeof TICKET_INCLUDE }>;

@Injectable()
export class SupportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async createTicket(input: { userId: string; authorName: string; subject: string; body: string }) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId: input.userId,
        subject: input.subject,
        messages: {
          create: {
            authorId: input.userId,
            authorName: input.authorName,
            fromAdmin: false,
            body: input.body,
          },
        },
      },
      include: TICKET_INCLUDE,
    });
    return this.serialize(ticket);
  }

  async listForUser(userId: string) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
      include: TICKET_INCLUDE,
    });
    return tickets.map((ticket) => this.serialize(ticket));
  }

  async listAll(status?: string) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: this.isStatus(status) ? { status } : {},
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
      include: TICKET_INCLUDE,
    });
    return tickets.map((ticket) => this.serialize(ticket));
  }

  async reply(input: {
    ticketId: string;
    authorId: string;
    authorName: string;
    body: string;
    fromAdmin: boolean;
    /** Omitted for admins, who may reply to any ticket. */
    userId?: string;
  }) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: input.userId ? { id: input.ticketId, userId: input.userId } : { id: input.ticketId },
    });
    if (!ticket) throw new NotFoundException('Support request not found');
    if (ticket.status === 'closed') {
      throw new BadRequestException('This request is closed. Open a new one to continue.');
    }

    const now = new Date();
    const updated = await this.prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        lastMessageAt: now,
        // An admin reply awaits the client; a client reply puts it back in the admin queue.
        status: input.fromAdmin ? 'pending' : 'open',
        messages: {
          create: {
            authorId: input.authorId,
            authorName: input.authorName,
            fromAdmin: input.fromAdmin,
            body: input.body,
          },
        },
      },
      include: TICKET_INCLUDE,
    });

    if (input.fromAdmin) {
      await this.notifications.notifyUser(
        ticket.userId,
        `Support replied: ${ticket.subject}`,
        input.body,
      );
    }
    return this.serialize(updated);
  }

  async setStatus(ticketId: string, status: string) {
    if (!this.isStatus(status)) {
      throw new BadRequestException(`Status must be one of ${SUPPORT_STATUSES.join(', ')}`);
    }
    const ticket = await this.prisma.supportTicket
      .update({ where: { id: ticketId }, data: { status }, include: TICKET_INCLUDE })
      .catch(() => null);
    if (!ticket) throw new NotFoundException('Support request not found');
    return this.serialize(ticket);
  }

  async counts() {
    const grouped = await this.prisma.supportTicket.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
  }

  private isStatus(value: string | undefined): value is SupportStatus {
    return SUPPORT_STATUSES.includes(value as SupportStatus);
  }

  private serialize(ticket: TicketWithRelations) {
    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
      lastMessageAt: ticket.lastMessageAt.toISOString(),
      user: ticket.user,
      messages: ticket.messages.map((message) => ({
        id: message.id,
        authorName: message.authorName,
        fromAdmin: message.fromAdmin,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }
}
