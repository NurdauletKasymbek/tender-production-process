import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus, UserRole, Prisma, FulfillmentType } from '@prisma/client';
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
        fulfillmentType: dto.fulfillmentType ?? FulfillmentType.PRODUCTION,
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

    // CONFIRMATION-дан өткенде орындау түрін бекітеміз:
    //   → PACKAGING болса = STOCK (склад)
    //   → PRODUCTION болса = PRODUCTION (цех, default)
    // dto.fulfillmentType қолмен берілсе, ол басымдыққа ие.
    let fulfillmentType: FulfillmentType | undefined = dto.fulfillmentType;
    if (!fulfillmentType && order.status === OrderStatus.CONFIRMATION) {
      if (nextStatus === OrderStatus.PACKAGING) fulfillmentType = FulfillmentType.STOCK;
      else if (nextStatus === OrderStatus.PRODUCTION) fulfillmentType = FulfillmentType.PRODUCTION;
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: nextStatus,
          responsibleId: newResponsibleId,
          startedAt: order.startedAt ?? (
            nextStatus === OrderStatus.PRODUCTION || nextStatus === OrderStatus.PACKAGING
              ? new Date()
              : null
          ),
          completedAt: nextStatus === OrderStatus.CLOSED ? new Date() : null,
          ...(fulfillmentType ? { fulfillmentType } : {}),
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

  /** CSV экспорт (Excel ашуға болады, BOM қосылған) */
  async exportCsv(filters: { status?: OrderStatus }): Promise<string> {
    const orders = await this.prisma.order.findMany({
      where: filters.status ? { status: filters.status } : {},
      include: {
        responsible: { select: { fullName: true, role: true } },
      },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
    });

    const header = [
      'Тендер №', 'Келісімшарт №', 'Goszakup ID',
      'Тапсырыс беруші', 'БСН',
      'Өнім', 'Сипаттама', 'Саны', 'Өлшем бірлігі',
      'Сома', 'Валюта',
      'Кезең', 'Басымдық',
      'Жауапты', 'Рөлі',
      'Жеткізу мерзімі', 'Мекенжай',
      'Жасалған күні',
    ];

    const rows = orders.map((o) => [
      o.tenderNumber,
      o.contractNumber || '',
      o.goszakupId || '',
      o.customerName,
      o.customerBin || '',
      o.productName,
      o.productDescription || '',
      o.quantity.toString(),
      o.unit,
      o.totalAmount.toString(),
      o.currency,
      o.status,
      o.priority.toString(),
      o.responsible?.fullName || '',
      o.responsible?.role || '',
      o.deadline.toISOString().slice(0, 10),
      o.deliveryAddress || '',
      o.createdAt.toISOString().slice(0, 10),
    ]);

    const escape = (v: string) => {
      const needsQuotes = /[",\n;]/.test(v);
      const escaped = v.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };

    const csv = [header, ...rows]
      .map((r) => r.map((c) => escape(c ?? '')).join(';'))
      .join('\r\n');

    // BOM — Excel-де UTF-8 дұрыс ашылу үшін
    return '\uFEFF' + csv;
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
