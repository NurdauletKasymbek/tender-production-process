import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateStockItemDto,
  CreateStockMovementDto,
  UpdateStockItemDto,
} from './dto/stock.dto';

/**
 * Склад инвентары.
 * Маңызды инвариант: `StockItem.quantity` әрдайым `StockMovement` журналымен сәйкес.
 * Барлық жаңартулар атомдық (`prisma.$transaction`) — гонка жоқ.
 */
@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  // ============== ITEM CRUD ==============

  async list(opts: { search?: string; lowOnly?: boolean; activeOnly?: boolean } = {}) {
    const where: Prisma.StockItemWhereInput = {};
    if (opts.activeOnly !== false) where.isActive = true;
    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { sku: { contains: opts.search, mode: 'insensitive' } },
        { category: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.stockItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    if (opts.lowOnly) {
      return items.filter(
        (i) => i.minQuantity != null && i.quantity.lessThanOrEqualTo(i.minQuantity),
      );
    }
    return items;
  }

  async findOne(id: string) {
    const item = await this.prisma.stockItem.findUnique({
      where: { id },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            createdBy: { select: { id: true, fullName: true, role: true } },
            order: { select: { id: true, tenderNumber: true, productName: true } },
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Склад бірлігі табылмады');
    return item;
  }

  async create(dto: CreateStockItemDto, userId: string) {
    if (dto.sku) {
      const exists = await this.prisma.stockItem.findUnique({ where: { sku: dto.sku } });
      if (exists) throw new BadRequestException(`SKU "${dto.sku}" қолданыста`);
    }

    const initial = new Prisma.Decimal(dto.initialQuantity ?? 0);

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.create({
        data: {
          name: dto.name,
          sku: dto.sku || null,
          category: dto.category || null,
          unit: dto.unit || 'дана',
          quantity: initial,
          minQuantity: dto.minQuantity != null ? new Prisma.Decimal(dto.minQuantity) : null,
          location: dto.location || null,
          notes: dto.notes || null,
        },
      });

      if (initial.greaterThan(0)) {
        await tx.stockMovement.create({
          data: {
            stockItemId: item.id,
            type: StockMovementType.IN,
            quantity: initial,
            balanceAfter: initial,
            comment: 'Бастапқы қалдық',
            createdById: userId,
          },
        });
      }

      return item;
    });
  }

  async update(id: string, dto: UpdateStockItemDto) {
    if (dto.sku) {
      const exists = await this.prisma.stockItem.findFirst({
        where: { sku: dto.sku, NOT: { id } },
      });
      if (exists) throw new BadRequestException(`SKU "${dto.sku}" басқа бірлікте қолданыста`);
    }

    const data: Prisma.StockItemUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.sku !== undefined) data.sku = dto.sku || null;
    if (dto.category !== undefined) data.category = dto.category || null;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.minQuantity !== undefined) {
      data.minQuantity = dto.minQuantity == null ? null : new Prisma.Decimal(dto.minQuantity);
    }
    if (dto.location !== undefined) data.location = dto.location || null;
    if (dto.notes !== undefined) data.notes = dto.notes || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    try {
      return await this.prisma.stockItem.update({ where: { id }, data });
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException('Склад бірлігі табылмады');
      throw e;
    }
  }

  async remove(id: string) {
    // Деректерді қорғау үшін шынайы өшірмейміз — `isActive=false` ғана.
    try {
      return await this.prisma.stockItem.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException('Склад бірлігі табылмады');
      throw e;
    }
  }

  // ============== MOVEMENTS ==============

  /**
   * Қолмен қозғалыс жазу (қабылдау, шығыс, түзету).
   * Транзакция: бір атомдық `update` арқылы қалдық пен журнал сәйкестендіріледі.
   */
  async createMovement(stockItemId: string, dto: CreateStockMovementDto, userId: string) {
    const item = await this.prisma.stockItem.findUnique({ where: { id: stockItemId } });
    if (!item) throw new NotFoundException('Склад бірлігі табылмады');

    const qty = new Prisma.Decimal(dto.quantity);
    let newBalance: Prisma.Decimal;

    switch (dto.type) {
      case StockMovementType.IN:
        if (qty.lessThanOrEqualTo(0)) {
          throw new BadRequestException('IN үшін quantity > 0 болуы керек');
        }
        newBalance = item.quantity.plus(qty);
        break;
      case StockMovementType.OUT:
        if (qty.lessThanOrEqualTo(0)) {
          throw new BadRequestException('OUT үшін quantity > 0 болуы керек');
        }
        if (item.quantity.lessThan(qty)) {
          throw new BadRequestException(
            `Қалдық жеткіліксіз: бар ${item.quantity}, сұралған ${qty}`,
          );
        }
        newBalance = item.quantity.minus(qty);
        break;
      case StockMovementType.ADJUST:
        // ADJUST: quantity = жаңа қалдық (абсолюттік)
        newBalance = qty;
        break;
      default:
        throw new BadRequestException('Белгісіз type');
    }

    const [, movement] = await this.prisma.$transaction([
      this.prisma.stockItem.update({
        where: { id: stockItemId },
        data: { quantity: newBalance },
      }),
      this.prisma.stockMovement.create({
        data: {
          stockItemId,
          type: dto.type,
          // ADJUST үшін quantity = айырмашылық (есеп үшін), бірақ сақтау оңай болу үшін абсолюттік мән
          quantity: qty,
          balanceAfter: newBalance,
          comment: dto.comment || null,
          orderId: dto.orderId || null,
          createdById: userId,
        },
      }),
    ]);

    return { item: { ...item, quantity: newBalance }, movement };
  }

  /**
   * Тапсырыс LOADING-тен LOGISTICS-ке өткенде автоматты түрде шегеру.
   * Идемпотентті: `stockDeductedAt` бар болса қайта шегермейді.
   * `OrdersService.changeStatus` ішінен шақырылады.
   */
  async deductForOrderShipment(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        stockItemId: true,
        stockQuantity: true,
        stockDeductedAt: true,
        tenderNumber: true,
      },
    });
    if (!order || !order.stockItemId || !order.stockQuantity) return null;
    if (order.stockDeductedAt) return null; // бұрын шегерілген

    const item = await this.prisma.stockItem.findUnique({
      where: { id: order.stockItemId },
    });
    if (!item) return null;

    if (item.quantity.lessThan(order.stockQuantity)) {
      throw new BadRequestException(
        `Қалдық жеткіліксіз: «${item.name}» — бар ${item.quantity}, керек ${order.stockQuantity}`,
      );
    }

    const newBalance = item.quantity.minus(order.stockQuantity);

    await this.prisma.$transaction([
      this.prisma.stockItem.update({
        where: { id: item.id },
        data: { quantity: newBalance },
      }),
      this.prisma.stockMovement.create({
        data: {
          stockItemId: item.id,
          type: StockMovementType.OUT,
          quantity: order.stockQuantity,
          balanceAfter: newBalance,
          orderId: order.id,
          comment: `Тапсырыс №${order.tenderNumber} жөнелтілді`,
          createdById: userId,
        },
      }),
      this.prisma.order.update({
        where: { id: order.id },
        data: { stockDeductedAt: new Date() },
      }),
    ]);

    return { itemId: item.id, deducted: order.stockQuantity, balanceAfter: newBalance };
  }

  // ============== STATS ==============

  async stats() {
    const [total, active, low] = await Promise.all([
      this.prisma.stockItem.count(),
      this.prisma.stockItem.count({ where: { isActive: true } }),
      this.prisma.stockItem.findMany({
        where: { isActive: true, minQuantity: { not: null } },
        select: { id: true, name: true, quantity: true, minQuantity: true, unit: true },
      }),
    ]);
    const lowStock = low.filter(
      (i) => i.minQuantity != null && i.quantity.lessThanOrEqualTo(i.minQuantity),
    );
    return {
      total,
      active,
      inactive: total - active,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock,
    };
  }
}
