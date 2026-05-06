import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus, UserRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto, ChangeStatusDto } from './dto/order.dto';
import { canTransition, STATUS_DEFAULT_ROLE } from './order-state-machine';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** Жаңа тапсырыс жасау (қолмен немесе Goszakup-тан) */
  async create(dto: CreateOrderDto, createdById: string) {
    const order = await this.prisma.order.create({
      data: {
        ...dto,
        deadline: new Date(dto.deadline),
        contractDate: dto.contractDate ? new Date(dto.contractDate) : null,
        totalAmount: new Prisma.Decimal(dto.totalAmount),
        status: OrderStatus.NEW_TENDER,
      },
    });

    // Тендерлік бөлімге хабарлау
    await this.notifications.notifyByRole(
      UserRole.TENDER_DEPARTMENT,
      'NEW_ORDER',
      'Жаңа тендер келді',
      `Тендер №${order.tenderNumber}: ${order.productName}`,
      order.id,
    );

    return order;
  }

  async findAll(filters: { status?: OrderStatus; userId?: string; role?: UserRole }) {
    const where: Prisma.OrderWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.userId) where.responsibleId = filters.userId;

    return this.prisma.order.findMany({
      where,
      include: {
        responsible: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        responsible: true,
        statusHistory: {
          include: { changedBy: { select: { fullName: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
        productionTasks: {
          include: { assignee: { select: { fullName: true } } },
        },
        files: {
          include: { uploadedBy: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!order) throw new NotFoundException('Тапсырыс табылмады');
    return order;
  }

  /**
   * Тапсырыс күйін келесі кезеңге ауыстыру.
   * Status machine ережелерін тексереді.
   */
  async changeStatus(
    orderId: string,
    nextStatus: OrderStatus,
    user: { id: string; role: UserRole },
    dto: ChangeStatusDto,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Тапсырыс табылмады');

    const check = canTransition(order.status, nextStatus, user.role);
    if (!check.ok) throw new BadRequestException(check.reason);

    // Жаңа жауапты — DTO-да көрсетілген немесе автоматты түрде сол рөлдегі бірінші белсенді
    let newResponsibleId = dto.responsibleId ?? null;
    if (!newResponsibleId) {
      const defaultRole = STATUS_DEFAULT_ROLE[nextStatus];
      if (defaultRole) {
        const candidate = await this.prisma.user.findFirst({
          where: { role: defaultRole, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        newResponsibleId = candidate?.id ?? null;
      }
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: nextStatus,
          responsibleId: newResponsibleId,
          startedAt: order.startedAt ?? (nextStatus === OrderStatus.PRODUCTION ? new Date() : null),
          completedAt: nextStatus === OrderStatus.CLOSED ? new Date() : null,
        },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: nextStatus,
          changedById: user.id,
          comment: dto.comment,
        },
      }),
    ]);

    // Хабарлама
    if (newResponsibleId) {
      await this.notifications.notifyUser(
        newResponsibleId,
        'STATUS_CHANGE',
        'Жаңа тапсырыс сізге берілді',
        `Тапсырыс №${order.tenderNumber} — кезең: ${nextStatus}`,
        orderId,
      );
    }

    return updated;
  }

  /** Басшылық дашборды үшін статистика */
  async dashboardStats() {
    const [byStatus, overdue, totalActive] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.order.count({
        where: {
          deadline: { lt: new Date() },
          status: { notIn: [OrderStatus.CLOSED, OrderStatus.REJECTED] },
        },
      }),
      this.prisma.order.count({
        where: { status: { notIn: [OrderStatus.CLOSED, OrderStatus.REJECTED] } },
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      overdueCount: overdue,
      activeCount: totalActive,
    };
  }
}
