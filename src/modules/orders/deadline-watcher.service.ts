import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { STATUS_LABEL_KK } from './order-state-machine';

const ACTIVE_STATUSES: OrderStatus[] = [
  'NEW_TENDER', 'REVIEW', 'CONFIRMATION',
  'PRODUCTION', 'PACKAGING', 'LOADING', 'LOGISTICS', 'DELIVERY',
];

const WARN_DAYS = 3;
const DUP_WINDOW_HOURS = 22;

@Injectable()
export class DeadlineWatcherService {
  private readonly logger = new Logger(DeadlineWatcherService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** Күн сайын таңертең 9:00-да тексеру */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async dailyCheck() {
    await this.notifyOverdue();
    await this.notifyUpcoming();
  }

  async notifyOverdue() {
    const now = new Date();
    const overdue = await this.prisma.order.findMany({
      where: {
        deadline: { lt: now },
        status: { in: ACTIVE_STATUSES },
      },
      include: { responsible: true },
    });

    for (const order of overdue) {
      if (!order.responsibleId) continue;
      if (await this.hasRecentNotification(order.id, 'DELAY')) continue;

      const daysOverdue = Math.ceil(
        (now.getTime() - order.deadline.getTime()) / (1000 * 60 * 60 * 24),
      );
      await this.notifications.notifyUser(
        order.responsibleId,
        NotificationType.DELAY,
        '🚨 Мерзім бұзылды',
        `Тапсырыс №${order.tenderNumber} мерзімінен ${daysOverdue} күн кешікті.\n` +
          `Кезең: ${STATUS_LABEL_KK[order.status]}`,
        order.id,
      );
    }
    if (overdue.length > 0) {
      this.logger.log(`Кешіктірілген тапсырыс: ${overdue.length}`);
    }
  }

  async notifyUpcoming() {
    const now = new Date();
    const horizon = new Date(now.getTime() + WARN_DAYS * 24 * 60 * 60 * 1000);

    const soon = await this.prisma.order.findMany({
      where: {
        deadline: { gte: now, lte: horizon },
        status: { in: ACTIVE_STATUSES },
      },
      include: { responsible: true },
    });

    for (const order of soon) {
      if (!order.responsibleId) continue;
      if (await this.hasRecentNotification(order.id, 'DEADLINE_WARNING')) continue;

      const daysLeft = Math.ceil(
        (order.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      await this.notifications.notifyUser(
        order.responsibleId,
        NotificationType.DEADLINE_WARNING,
        '⏰ Мерзім жақындады',
        `Тапсырыс №${order.tenderNumber} — ${daysLeft} күн қалды.\n` +
          `Кезең: ${STATUS_LABEL_KK[order.status]}`,
        order.id,
      );
    }
    if (soon.length > 0) {
      this.logger.log(`Жақын мерзімді: ${soon.length}`);
    }
  }

  private async hasRecentNotification(
    orderId: string,
    type: NotificationType,
  ): Promise<boolean> {
    const cutoff = new Date(Date.now() - DUP_WINDOW_HOURS * 60 * 60 * 1000);
    const existing = await this.prisma.notification.findFirst({
      where: {
        orderId,
        type,
        createdAt: { gte: cutoff },
      },
    });
    return !!existing;
  }
}
