import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController, CatalogController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
