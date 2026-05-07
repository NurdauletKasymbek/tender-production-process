import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import 'multer';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { FileType } from '@prisma/client';
import { Response } from 'express';
import { FilesService, UPLOAD_ROOT } from './files.service';

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
]);

const MAX_BYTES = (Number(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;

@ApiTags('Файлдар')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('files')
export class FilesController {
  constructor(private files: FilesService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Файл жүктеу (JPG/PNG/WEBP/HEIC/PDF)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        orderId: { type: 'string' },
        fileType: { type: 'string', enum: Object.keys(FileType) },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const orderId = (req.body as any)?.orderId;
          if (!orderId) return cb(new BadRequestException('orderId қажет'), '');
          const dir = path.resolve(UPLOAD_ROOT, 'orders', orderId);
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          const safe = path.basename(file.originalname, ext).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
          cb(null, `${Date.now()}-${safe}${ext}`);
        },
      }),
      limits: { fileSize: MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          return cb(new BadRequestException('Рұқсат етілген түрлер: JPG, PNG, WEBP, HEIC, PDF'), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Файл табылмады');
    const orderId = req.body?.orderId as string;
    const fileType = (req.body?.fileType as FileType) || FileType.OTHER;
    if (!Object.values(FileType).includes(fileType)) {
      throw new BadRequestException('Жарамсыз fileType');
    }
    return this.files.createMetadata({
      orderId,
      file,
      fileType,
      uploadedById: req.user.id,
    });
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Тапсырыстың файлдарының тізімі' })
  list(@Param('orderId') orderId: string) {
    return this.files.listForOrder(orderId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Файлды жүктеп алу' })
  async download(@Param('id') id: string, @Res() res: Response, @Query('inline') inline?: string) {
    const meta = await this.files.findOne(id);
    const abs = this.files.resolveDiskPath(meta.filePath);
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ message: 'Файл дискіде жоқ' });
    }
    res.setHeader('Content-Type', meta.mimeType);
    const disposition = inline === 'true' ? 'inline' : 'attachment';
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(meta.fileName)}"`,
    );
    fs.createReadStream(abs).pipe(res);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Файлды жою' })
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.files.remove(id, req.user);
  }
}
