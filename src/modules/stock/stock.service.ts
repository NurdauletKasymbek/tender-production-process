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
 * "a;b;""c с ;""" → ["a", "b", "c с ;"]
 * Қарапайым CSV жолын бөлу: тырнақшалардағы ; бөлгіш емес,
 * ал екі тырнақша ("") тырнақша литералы ретінде есептеледі.
 */
function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let i = 0;
  let cur = '';
  let inQuote = false;
  while (i < line.length) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 2; continue; }
      if (ch === '"') { inQuote = false; i += 1; continue; }
      cur += ch; i += 1; continue;
    }
    if (ch === '"') { inQuote = true; i += 1; continue; }
    if (ch === sep) { out.push(cur); cur = ''; i += 1; continue; }
    cur += ch; i += 1;
  }
  out.push(cur);
  return out;
}

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

  // ============== CSV ==============

  /**
   * CSV экспорт — Excel ашуға болады (BOM + ; бөлгіш).
   */
  async exportCsv(): Promise<string> {
    const items = await this.prisma.stockItem.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    const header = ['SKU', 'Атау', 'Санат', 'Өлшем', 'Қалдық', 'Мин', 'Орны', 'Ескертпе'];
    const rows = items.map((i) => [
      i.sku || '',
      i.name,
      i.category || '',
      i.unit,
      i.quantity.toString(),
      i.minQuantity?.toString() || '',
      i.location || '',
      i.notes || '',
    ]);

    const escape = (v: string) => {
      const needsQuotes = /[",\n;]/.test(v);
      const escaped = v.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };

    const csv = [header, ...rows]
      .map((r) => r.map((c) => escape(c ?? '')).join(';'))
      .join('\r\n');

    return '﻿' + csv;
  }

  /**
   * CSV импорт. Тақырып: SKU; Атау; Санат; Өлшем; Қалдық; Мин; Орны; Ескертпе
   * (бағана аттары — алғашқы жолда. Бөлгіш: ; немесе ,)
   * - SKU бар бірлік табылса — мета жаңартылады, қалдық тиілмейді.
   * - SKU бойынша табылмаса — жаңа бірлік жасалады, қалдық IN қозғалысы ретінде.
   */
  async importCsv(content: string, userId: string) {
    const text = content.replace(/^﻿/, '').trim();
    if (!text) {
      return { ok: false, message: 'CSV бос', created: 0, updated: 0, errors: [] };
    }

    const lines = text.split(/\r?\n/);
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = parseCsvLine(lines[0], sep).map((h) => h.trim().toLowerCase());

    const idx = (key: string) => headers.findIndex((h) => h === key);
    const colSku = idx('sku');
    const colName = headers.findIndex((h) => h === 'атау' || h === 'name');
    const colCategory = headers.findIndex((h) => h === 'санат' || h === 'category');
    const colUnit = headers.findIndex((h) => h === 'өлшем' || h === 'unit');
    const colQty = headers.findIndex((h) => h === 'қалдық' || h === 'quantity');
    const colMin = headers.findIndex((h) => h === 'мин' || h === 'min' || h === 'minquantity');
    const colLocation = headers.findIndex((h) => h === 'орны' || h === 'location');
    const colNotes = headers.findIndex((h) => h === 'ескертпе' || h === 'notes');

    if (colName === -1) {
      return {
        ok: false,
        message: '"Атау" (name) бағанасы табылмады',
        created: 0,
        updated: 0,
        errors: [],
      };
    }

    let created = 0;
    let updated = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 1; i < lines.length; i += 1) {
      const raw = lines[i];
      if (!raw.trim()) continue;
      const cells = parseCsvLine(raw, sep);
      const get = (col: number) => (col >= 0 && col < cells.length ? cells[col].trim() : '');

      const name = get(colName);
      if (!name) {
        errors.push({ row: i + 1, message: 'Атау бос' });
        continue;
      }

      const sku = get(colSku) || null;
      const category = get(colCategory) || null;
      const unit = get(colUnit) || 'дана';
      const qtyStr = get(colQty);
      const minStr = get(colMin);
      const location = get(colLocation) || null;
      const notes = get(colNotes) || null;

      const qty = qtyStr ? Number(qtyStr.replace(',', '.')) : 0;
      const minQty = minStr ? Number(minStr.replace(',', '.')) : null;

      if (qtyStr && !Number.isFinite(qty)) {
        errors.push({ row: i + 1, message: `Дұрыс қалдық емес: "${qtyStr}"` });
        continue;
      }
      if (minStr && !Number.isFinite(minQty as number)) {
        errors.push({ row: i + 1, message: `Дұрыс мин емес: "${minStr}"` });
        continue;
      }

      try {
        const existing = sku
          ? await this.prisma.stockItem.findUnique({ where: { sku } })
          : null;

        if (existing) {
          await this.prisma.stockItem.update({
            where: { id: existing.id },
            data: {
              name,
              category,
              unit,
              location,
              notes,
              minQuantity: minQty != null ? new Prisma.Decimal(minQty) : null,
            },
          });
          updated += 1;
        } else {
          const initial = new Prisma.Decimal(qty || 0);
          await this.prisma.$transaction(async (tx) => {
            const item = await tx.stockItem.create({
              data: {
                name,
                sku,
                category,
                unit,
                location,
                notes,
                quantity: initial,
                minQuantity: minQty != null ? new Prisma.Decimal(minQty) : null,
              },
            });
            if (initial.greaterThan(0)) {
              await tx.stockMovement.create({
                data: {
                  stockItemId: item.id,
                  type: StockMovementType.IN,
                  quantity: initial,
                  balanceAfter: initial,
                  comment: 'CSV импорттан',
                  createdById: userId,
                },
              });
            }
          });
          created += 1;
        }
      } catch (e: any) {
        errors.push({ row: i + 1, message: e?.message || 'Қате' });
      }
    }

    return { ok: true, created, updated, errors };
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
