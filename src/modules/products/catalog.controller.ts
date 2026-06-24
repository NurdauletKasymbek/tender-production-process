import {
  Controller, Get, Param, Post, Body, Query, Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';
import { CreateInquiryDto } from './dto/product.dto';
import { ProductsService } from './products.service';

/**
 * Публичный каталог — логинсіз қолжетімді (auth guard жоқ).
 * Сыртқы клиенттер тауарларды шолып, сұраныс қалдыра алады.
 */
@ApiTags('Каталог (публичный)')
@Controller('catalog')
export class CatalogController {
  constructor(private products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Жарияланған тауарлар тізімі' })
  list(@Query('search') search?: string, @Query('category') category?: string) {
    return this.products.publicList({ search, category });
  }

  @Get('categories')
  @ApiOperation({ summary: 'Санаттар (саныменен)' })
  categories() {
    return this.products.publicCategories();
  }

  @Get('image/:id')
  @ApiOperation({ summary: 'Тауар суретін беру (публичный)' })
  async image(@Param('id') id: string, @Res() res: Response) {
    const img = await this.products.getImage(id);
    const abs = this.products.resolveDiskPath(img.filePath);
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ message: 'Сурет дискіде жоқ' });
    }
    res.setHeader('Content-Type', img.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 күн кэш
    fs.createReadStream(abs).pipe(res);
  }

  @Post('inquiry')
  @ApiOperation({ summary: 'Сұраныс қалдыру (логинсіз)' })
  inquiry(@Body() dto: CreateInquiryDto) {
    return this.products.createInquiry(dto);
  }

  // НАЗАР: бұл маршрут ең соңында — басқа нақты жолдарды (categories, image) жауып қалмауы үшін.
  @Get(':slug')
  @ApiOperation({ summary: 'Тауар беті (slug бойынша)' })
  bySlug(@Param('slug') slug: string) {
    return this.products.publicBySlug(slug);
  }
}
