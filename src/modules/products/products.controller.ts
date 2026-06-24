import {
  BadRequestException,
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InquiryStatus, UserRole } from '@prisma/client';
import 'multer';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UPLOAD_ROOT } from '../files/files.service';
import {
  CreateInquiryDto,
  CreateProductDto,
  ReorderImagesDto,
  UpdateInquiryDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

const MAX_BYTES = (Number(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;

/**
 * Каталогты басқару — тек ADMIN мен DIRECTOR (және ADMIN барлығына).
 * Публичный оқу `CatalogController`-де (логинсіз).
 */
@ApiTags('Каталог (басқару)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.DIRECTOR)
@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Барлық тауарлар (жарияланбағанды қоса)' })
  list(@Query('search') search?: string, @Query('category') category?: string) {
    return this.products.adminList({ search, category });
  }

  // --- Сұраныстар (нақты :id маршруттарынан бұрын) ---

  @Get('inquiries')
  @ApiOperation({ summary: 'Клиент сұраныстарының тізімі' })
  listInquiries(@Query('status') status?: InquiryStatus) {
    return this.products.listInquiries(status);
  }

  @Get('inquiries/stats')
  @ApiOperation({ summary: 'Сұраныс статистикасы' })
  inquiryStats() {
    return this.products.inquiryStats();
  }

  @Patch('inquiries/:id')
  @ApiOperation({ summary: 'Сұраныс күйін/ескертпесін жаңарту' })
  updateInquiry(@Param('id') id: string, @Body() dto: UpdateInquiryDto) {
    return this.products.updateInquiry(id, dto);
  }

  // --- Тауар CRUD ---

  @Get(':id')
  @ApiOperation({ summary: 'Тауар мәліметі (суреттермен)' })
  findOne(@Param('id') id: string) {
    return this.products.adminFindOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Жаңа тауар жасау' })
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Тауарды жаңарту' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Тауарды өшіру (суреттермен бірге)' })
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }

  // --- Суреттер ---

  @Post(':id/images')
  @ApiOperation({ summary: 'Тауарға сурет жүктеу (JPG/PNG/WEBP/HEIC)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const productId = (req.params as any)?.id;
          if (!productId) return cb(new BadRequestException('id қажет'), '');
          const dir = path.resolve(UPLOAD_ROOT, 'products', productId);
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          const safe = path.basename(file.originalname, ext)
            .replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
          cb(null, `${Date.now()}-${safe}${ext}`);
        },
      }),
      limits: { fileSize: MAX_BYTES },
    }),
  )
  addImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл табылмады');
    return this.products.addImage(id, file);
  }

  @Patch(':id/images/reorder')
  @ApiOperation({ summary: 'Суреттерді қайта реттеу (0 — басты)' })
  reorderImages(@Param('id') id: string, @Body() dto: ReorderImagesDto) {
    return this.products.reorderImages(id, dto.imageIds);
  }

  @Delete('images/:imageId')
  @ApiOperation({ summary: 'Суретті өшіру' })
  removeImage(@Param('imageId') imageId: string) {
    return this.products.removeImage(imageId);
  }

  // --- Тестілеу/ыңғайлылық: ішкі сұраныс қалдыру ---

  @Post('inquiries')
  @ApiOperation({ summary: 'Қолмен сұраныс қосу (ішкі)' })
  createInquiry(@Body() dto: CreateInquiryDto) {
    return this.products.createInquiry(dto);
  }
}
