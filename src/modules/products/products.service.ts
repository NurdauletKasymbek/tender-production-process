import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InquiryStatus, Prisma } from '@prisma/client';
import 'multer';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateInquiryDto,
  CreateProductDto,
  UpdateInquiryDto,
  UpdateProductDto,
} from './dto/product.dto';

// Кириллица → латын транслитерациясы (slug үшін).
const TRANSLIT: Record<string, string> = {
  а: 'a', ә: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'e',
  ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', қ: 'q', л: 'l', м: 'm', н: 'n',
  ң: 'n', о: 'o', ө: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ұ: 'u',
  ү: 'u', ф: 'f', х: 'h', һ: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', і: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function slugify(input: string): string {
  const lower = (input || '').toLowerCase().trim();
  let out = '';
  for (const ch of lower) {
    if (TRANSLIT[ch] !== undefined) out += TRANSLIT[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (/[\s\-_.]/.test(ch)) out += '-';
    // басқа таңбалар алынып тасталады
  }
  out = out.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return out || 'product';
}

/** Тауар фотосы — рұқсат етілген түрлер. */
const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]);

// Суреттен JSON-ға беретін өрістер (data байттарын ҚОСПАЙМЫЗ).
const IMAGE_META = {
  id: true, productId: true, mimeType: true, sizeBytes: true, sortOrder: true, createdAt: true,
} as const;

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // ============== SLUG ==============

  /** Бірегей slug — қажет болса -2, -3 ... жалғайды. */
  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = slugify(base);
    let candidate = root;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await this.prisma.product.findFirst({
        where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { id: true },
      });
      if (!exists) return candidate;
      n += 1;
      candidate = `${root}-${n}`;
    }
  }

  // ============== ПУБЛИЧНЫЙ ==============

  /** Каталог тізімі — тек жарияланған тауарлар. */
  async publicList(opts: { search?: string; category?: string } = {}) {
    const where: Prisma.ProductWhereInput = { isPublished: true };
    if (opts.category) where.category = opts.category;
    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { description: { contains: opts.search, mode: 'insensitive' } },
        { category: { contains: opts.search, mode: 'insensitive' } },
        { sku: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.product.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        images: { orderBy: { sortOrder: 'asc' }, take: 1, select: IMAGE_META }, // cover ғана
      },
    });
  }

  /** Жарияланған тауарлардың санаттары + саны. */
  async publicCategories() {
    const rows = await this.prisma.product.groupBy({
      by: ['category'],
      where: { isPublished: true },
      _count: { _all: true },
    });
    return rows
      .filter((r) => !!r.category)
      .map((r) => ({ category: r.category as string, count: r._count._all }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }

  /** Публичный тауар беті slug бойынша. */
  async publicBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, isPublished: true },
      include: { images: { orderBy: { sortOrder: 'asc' }, select: IMAGE_META } },
    });
    if (!product) throw new NotFoundException('Тауар табылмады');
    return product;
  }

  /** Сурет байттары (публичный беру үшін). */
  async getImage(id: string) {
    const img = await this.prisma.productImage.findUnique({ where: { id } });
    if (!img) throw new NotFoundException('Сурет табылмады');
    return img;
  }

  /** Клиент сұранысын қабылдау (публичный). */
  async createInquiry(dto: CreateInquiryDto) {
    if (dto.productId) {
      const exists = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Тауар табылмады');
    }
    return this.prisma.productInquiry.create({
      data: {
        productId: dto.productId || null,
        name: dto.name,
        phone: dto.phone,
        email: dto.email || null,
        company: dto.company || null,
        quantity: dto.quantity ?? null,
        message: dto.message || null,
      },
    });
  }

  // ============== ADMIN: ТАУАР CRUD ==============

  /** Толық тізім (жарияланбағанды қоса) — ішкі басқару үшін. */
  async adminList(opts: { search?: string; category?: string } = {}) {
    const where: Prisma.ProductWhereInput = {};
    if (opts.category) where.category = opts.category;
    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { sku: { contains: opts.search, mode: 'insensitive' } },
        { category: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.product.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        images: { orderBy: { sortOrder: 'asc' }, take: 1, select: IMAGE_META },
        _count: { select: { inquiries: true, images: true } },
      },
    });
  }

  async adminFindOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' }, select: IMAGE_META },
        stockItem: { select: { id: true, name: true, quantity: true, unit: true } },
      },
    });
    if (!product) throw new NotFoundException('Тауар табылмады');
    return product;
  }

  async create(dto: CreateProductDto) {
    const slug = await this.uniqueSlug(dto.slug || dto.name);
    return this.prisma.product.create({
      data: {
        slug,
        name: dto.name,
        category: dto.category || null,
        description: dto.description || null,
        unit: dto.unit || 'дана',
        price: dto.price != null ? new Prisma.Decimal(dto.price) : null,
        currency: dto.currency || 'KZT',
        sku: dto.sku || null,
        isPublished: dto.isPublished ?? true,
        sortOrder: dto.sortOrder ?? 0,
        stockItemId: dto.stockItemId || null,
      },
      include: { images: { select: IMAGE_META } },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Тауар табылмады');

    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined && dto.slug) {
      data.slug = await this.uniqueSlug(dto.slug, id);
    }
    if (dto.category !== undefined) data.category = dto.category || null;
    if (dto.description !== undefined) data.description = dto.description || null;
    if (dto.unit !== undefined) data.unit = dto.unit || 'дана';
    if (dto.price !== undefined) {
      data.price = dto.price == null ? null : new Prisma.Decimal(dto.price);
    }
    if (dto.currency !== undefined) data.currency = dto.currency || 'KZT';
    if (dto.sku !== undefined) data.sku = dto.sku || null;
    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.stockItemId !== undefined) {
      data.stockItem = dto.stockItemId
        ? { connect: { id: dto.stockItemId } }
        : { disconnect: true };
    }

    return this.prisma.product.update({
      where: { id },
      data,
      include: { images: { orderBy: { sortOrder: 'asc' }, select: IMAGE_META } },
    });
  }

  async remove(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Тауар табылмады');
    // Суреттер DB-де (bytea) — каскадпен бірге өшеді.
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }

  // ============== ADMIN: СУРЕТТЕР ==============

  async addImage(productId: string, file: Express.Multer.File) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Тауар табылмады');
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      throw new BadRequestException('Рұқсат етілген түрлер: JPG, PNG, WEBP, HEIC');
    }

    const last = await this.prisma.productImage.findFirst({
      where: { productId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = last ? last.sortOrder + 1 : 0;

    const created = await this.prisma.productImage.create({
      data: {
        productId,
        data: file.buffer,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        sortOrder,
      },
      select: { id: true, productId: true, mimeType: true, sizeBytes: true, sortOrder: true, createdAt: true },
    });
    return created;
  }

  async removeImage(imageId: string) {
    const img = await this.prisma.productImage.findUnique({
      where: { id: imageId },
      select: { id: true },
    });
    if (!img) throw new NotFoundException('Сурет табылмады');
    await this.prisma.productImage.delete({ where: { id: imageId } });
    return { ok: true };
  }

  /** Суреттерді берілген ретпен қайта нөмірлеу (0 — cover). */
  async reorderImages(productId: string, imageIds: string[]) {
    const imgs = await this.prisma.productImage.findMany({
      where: { productId },
      select: { id: true },
    });
    const owned = new Set(imgs.map((i) => i.id));
    if (!imageIds.every((id) => owned.has(id))) {
      throw new BadRequestException('Сурет осы тауарға тиесілі емес');
    }
    await this.prisma.$transaction(
      imageIds.map((id, i) =>
        this.prisma.productImage.update({ where: { id }, data: { sortOrder: i } }),
      ),
    );
    return this.prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
      select: IMAGE_META,
    });
  }

  // ============== ADMIN: СҰРАНЫСТАР ==============

  async listInquiries(status?: InquiryStatus) {
    return this.prisma.productInquiry.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });
  }

  async inquiryStats() {
    const [total, neu, contacted, closed] = await Promise.all([
      this.prisma.productInquiry.count(),
      this.prisma.productInquiry.count({ where: { status: InquiryStatus.NEW } }),
      this.prisma.productInquiry.count({ where: { status: InquiryStatus.CONTACTED } }),
      this.prisma.productInquiry.count({ where: { status: InquiryStatus.CLOSED } }),
    ]);
    return { total, new: neu, contacted, closed };
  }

  async updateInquiry(id: string, dto: UpdateInquiryDto) {
    try {
      return await this.prisma.productInquiry.update({
        where: { id },
        data: {
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
        },
        include: { product: { select: { id: true, name: true, slug: true } } },
      });
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException('Сұраныс табылмады');
      throw e;
    }
  }
}
