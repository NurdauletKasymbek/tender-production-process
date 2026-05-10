import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus, UserRole, Prisma, FulfillmentType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StockService } from '../stock/stock.service';
import { CreateOrderDto, ChangeStatusDto, LinkStockDto } from './dto/order.dto';
import {
  canTransition, STAGE_REQUIRED_FILE, STATUS_DEFAULT_ROLE, STATUS_LABEL_KK,
} from './order-state-machine';

const FILE_TYPE_LABEL_KK: Record<string, string> = {
  CONTRACT: 'Келісімшарт',
  TECHNICAL_SPEC: 'Техникалық тапсырма',
  PRODUCTION_PHOTO: 'Өндіріс фотосы',
  PACKAGING_PHOTO: 'Қаптау фотосы',
  LOADING_PHOTO: 'Тиеу фотосы',
  DELIVERY_PHOTO: 'Жеткізу фотосы',
  INVOICE: 'Шот-фактура',
  OTHER: 'Файл',
};

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private stock: StockService,
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
        stockItem: {
          select: { id: true, name: true, unit: true, quantity: true, sku: true },
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

    // Кезеңге тиісті файл жүктелген бе? (REJECTED-ке өткенде тексермейміз)
    if (nextStatus !== OrderStatus.REJECTED) {
      const requiredType = STAGE_REQUIRED_FILE[order.status];
      if (requiredType) {
        const hasFile = await this.prisma.orderFile.findFirst({
          where: { orderId, fileType: requiredType },
          select: { id: true },
        });
        if (!hasFile) {
          const label = FILE_TYPE_LABEL_KK[requiredType] || 'Файл';
          throw new BadRequestException(
            `Келесі кезеңге өту үшін «${label}» жүктеу міндетті`,
          );
        }
      }
    }

    // LOADING → LOGISTICS өту үшін көлік ақпараты міндетті
    if (order.status === OrderStatus.LOADING && nextStatus === OrderStatus.LOGISTICS) {
      const required = ['transportProvider', 'driverName', 'driverPhone', 'vehiclePlate'] as const;
      const missing = required.filter((k) => !dto[k] && !(order as any)[k]);
      if (missing.length > 0) {
        throw new BadRequestException(
          'Көлік ақпараты толық емес. Толтырыңыз: ' + missing.join(', '),
        );
      }
    }

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
    //   → STORAGE болса = STOCK (склад — дайын тауар)
    //   → PRODUCTION болса = PRODUCTION (цех, default)
    // dto.fulfillmentType қолмен берілсе, ол басымдыққа ие.
    let fulfillmentType: FulfillmentType | undefined = dto.fulfillmentType;
    if (!fulfillmentType && order.status === OrderStatus.CONFIRMATION) {
      if (nextStatus === OrderStatus.STORAGE) fulfillmentType = FulfillmentType.STOCK;
      else if (nextStatus === OrderStatus.PRODUCTION) fulfillmentType = FulfillmentType.PRODUCTION;
    }

    // Көлік ақпараты — берілсе сақтаймыз (LOADING → LOGISTICS өту кезінде)
    const transportData: Record<string, string | Date> = {};
    if (dto.transportProvider !== undefined) transportData.transportProvider = dto.transportProvider;
    if (dto.driverName !== undefined) transportData.driverName = dto.driverName;
    if (dto.driverPhone !== undefined) transportData.driverPhone = dto.driverPhone;
    if (dto.vehicleType !== undefined) transportData.vehicleType = dto.vehicleType;
    if (dto.vehiclePlate !== undefined) transportData.vehiclePlate = dto.vehiclePlate;
    if (dto.departedAt) transportData.departedAt = new Date(dto.departedAt);
    if (dto.expectedArrival) transportData.expectedArrival = new Date(dto.expectedArrival);

    const [updated] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: nextStatus,
          responsibleId: newResponsibleId,
          startedAt: order.startedAt ?? (
            nextStatus === OrderStatus.PRODUCTION
              || nextStatus === OrderStatus.PACKAGING
              || nextStatus === OrderStatus.STORAGE
              ? new Date()
              : null
          ),
          completedAt: nextStatus === OrderStatus.CLOSED ? new Date() : null,
          ...(fulfillmentType ? { fulfillmentType } : {}),
          ...transportData,
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

    // LOADING → LOGISTICS: тапсырыс склад бірлігіне байланса, автоматты түрде шегереміз.
    // Идемпотентті — `stockDeductedAt` бар болса екінші рет шегермейді.
    if (order.status === OrderStatus.LOADING && nextStatus === OrderStatus.LOGISTICS) {
      try {
        await this.stock.deductForOrderShipment(orderId, user.id);
      } catch (e: any) {
        // Шегеру мүмкін болмаса (қалдық жетпейді) — статус өтіп қойды,
        // бірақ бақылау тобын ескертеміз.
        await this.notifications.notifyControl(
          'STATUS_CHANGE',
          `⚠️ Склад шегеру сәтсіз: ${order.tenderNumber}`,
          `Тапсырыс жолға шықты, бірақ склад қалдығы жаңартылмады:\n${e?.message || e}`,
          orderId,
        );
      }
    }

    // Хабарлама — жауаптыға
    if (newResponsibleId) {
      await this.notifications.notifyUser(
        newResponsibleId,
        'STATUS_CHANGE',
        'Жаңа тапсырыс сізге берілді',
        `Тапсырыс №${order.tenderNumber} — кезең: ${STATUS_LABEL_KK[nextStatus]}\n` +
          `Өнім: ${order.productName}\n` +
          (dto.comment ? `\nЕскертпе: ${dto.comment}` : ''),
        orderId,
      );
    }

    // Бақылау тобына (ADMIN + DIRECTOR) — әр кезең ауысуда
    await this.notifications.notifyControl(
      'STATUS_CHANGE',
      `📊 Кезең ауысты: ${order.tenderNumber}`,
      `«${order.productName}»\n` +
        `${STATUS_LABEL_KK[order.status]} → ${STATUS_LABEL_KK[nextStatus]}\n` +
        (dto.comment ? `\nЕскертпе: ${dto.comment}` : ''),
      orderId,
      user.id, // өзіне қайта жібермейміз
    );

    // Арнайы — Логистика тапсырысты жүктеп жолға шығарған сәт
    // (LOGISTICS → DELIVERY): Директорға айқын "сәтті жүктелді" хабарламасы
    if (order.status === OrderStatus.LOGISTICS && nextStatus === OrderStatus.DELIVERY) {
      const transportLine = (() => {
        const parts: string[] = [];
        const o = updated as any; // updated includes new fields
        if (o.transportProvider) parts.push(`Тасымалдаушы: ${o.transportProvider}`);
        if (o.vehicleType || o.vehiclePlate) {
          parts.push(`Көлік: ${[o.vehicleType, o.vehiclePlate].filter(Boolean).join(', ')}`);
        }
        if (o.driverName || o.driverPhone) {
          parts.push(`Жүргізуші: ${[o.driverName, o.driverPhone].filter(Boolean).join(' · ')}`);
        }
        return parts.length ? '\n\n' + parts.join('\n') : '';
      })();

      await this.notifications.notifyControl(
        'COMPLETED',
        `✅ «${order.tenderNumber}» сәтті жүктелді`,
        `Тапсырыс «${order.productName}» жүктелді және клиентке жолға шықты.\n` +
          `Тапсырыс беруші: ${order.customerName}` +
          transportLine,
        orderId,
      );
    }

    return updated;
  }

  /**
   * STOCK fulfillment-ге склад бірлігін байлау/өзгерту/алу.
   * Шегеру әлі болмаған тапсырыстарға ғана қолданылады.
   */
  async linkStock(orderId: string, dto: LinkStockDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, stockDeductedAt: true },
    });
    if (!order) throw new NotFoundException('Тапсырыс табылмады');
    if (order.stockDeductedAt) {
      throw new BadRequestException('Бұл тапсырыс үшін шегеру жасалған, қайта байлау мүмкін емес');
    }

    if (dto.stockItemId === null || dto.stockItemId === '') {
      return this.prisma.order.update({
        where: { id: orderId },
        data: { stockItemId: null, stockQuantity: null },
      });
    }

    if (!dto.stockItemId) {
      throw new BadRequestException('stockItemId қажет');
    }

    const item = await this.prisma.stockItem.findUnique({ where: { id: dto.stockItemId } });
    if (!item) throw new NotFoundException('Склад бірлігі табылмады');

    if (dto.stockQuantity == null || dto.stockQuantity <= 0) {
      throw new BadRequestException('stockQuantity > 0 болуы керек');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        stockItemId: dto.stockItemId,
        stockQuantity: new Prisma.Decimal(dto.stockQuantity),
      },
    });
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
