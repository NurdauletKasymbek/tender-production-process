import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { FileType, UserRole } from '@prisma/client';
import 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';

export const UPLOAD_ROOT = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {
    if (!fs.existsSync(UPLOAD_ROOT)) {
      fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    }
  }

  async createMetadata(args: {
    orderId: string;
    file: Express.Multer.File;
    fileType: FileType;
    uploadedById: string;
  }) {
    const { orderId, file, fileType, uploadedById } = args;

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      // remove the orphan file
      try { fs.unlinkSync(file.path); } catch { /* ignore */ }
      throw new NotFoundException('Тапсырыс табылмады');
    }

    return this.prisma.orderFile.create({
      data: {
        orderId,
        fileName: file.originalname,
        fileType,
        filePath: path.relative(UPLOAD_ROOT, file.path).replace(/\\/g, '/'),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedById,
      },
      include: { uploadedBy: { select: { fullName: true, role: true } } },
    });
  }

  async listForOrder(orderId: string) {
    return this.prisma.orderFile.findMany({
      where: { orderId },
      include: { uploadedBy: { select: { fullName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const file = await this.prisma.orderFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('Файл табылмады');
    return file;
  }

  /** Get the absolute disk path for a stored file (with traversal protection) */
  resolveDiskPath(relativePath: string): string {
    const abs = path.resolve(UPLOAD_ROOT, relativePath);
    if (!abs.startsWith(UPLOAD_ROOT)) {
      throw new BadRequestException('Жарамсыз файл жолы');
    }
    return abs;
  }

  async remove(id: string, user: { id: string; role: UserRole }) {
    const file = await this.findOne(id);
    // ADMIN мен DIRECTOR — кез келген файлды жоя алады (басшылық).
    // Қалғандары — тек өздері жүктегенін.
    const canAny = user.role === UserRole.ADMIN || user.role === UserRole.DIRECTOR;
    if (!canAny && file.uploadedById !== user.id) {
      throw new ForbiddenException('Жою құқығы жоқ');
    }
    const abs = this.resolveDiskPath(file.filePath);
    try { fs.unlinkSync(abs); } catch { /* ignore */ }
    await this.prisma.orderFile.delete({ where: { id } });
    return { ok: true };
  }
}
