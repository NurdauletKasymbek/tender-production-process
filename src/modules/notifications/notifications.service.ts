import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TelegramService))
    private telegram: TelegramService,
  ) {}

  /** Нақты қолданушыға хабарлама */
  async notifyUser(
    userId: string,
    type: NotificationType | keyof typeof NotificationType,
    title: string,
    message: string,
    orderId?: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        orderId,
        type: type as NotificationType,
        title,
        message,
      },
      include: { user: true },
    });

    // Telegram-ға жіберу
    try {
      await this.telegram.sendMessage(
        notification.user.telegramId,
        `🔔 *${title}*\n\n${message}`,
      );
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { isSent: true, sentAt: new Date() },
      });
    } catch (e) {
      console.error('Telegram хабарламасын жіберу сәтсіз:', e);
    }

    return notification;
  }

  /** Белгілі рөлдегі барлық қолданушыларға */
  async notifyByRole(
    role: UserRole,
    type: NotificationType | keyof typeof NotificationType,
    title: string,
    message: string,
    orderId?: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: { role, isActive: true },
    });
    return Promise.all(
      users.map((u) => this.notifyUser(u.id, type, title, message, orderId)),
    );
  }

  /**
   * Бақылау тобына (ADMIN + DIRECTOR) хабарлама.
   * Әр статус ауысуда қолданылады — олар бүкіл процесті көріп отыруы керек.
   * `excludeUserId` — әрекет жасаған қолданушы (өзіне қосалқы хабар жібермейміз).
   */
  async notifyControl(
    type: NotificationType | keyof typeof NotificationType,
    title: string,
    message: string,
    orderId?: string,
    excludeUserId?: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.DIRECTOR] },
        isActive: true,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
    });
    return Promise.all(
      users.map((u) => this.notifyUser(u.id, type, title, message, orderId)),
    );
  }

  async getUserNotifications(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }
}
