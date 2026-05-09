import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { DeadlineWatcherService } from './deadline-watcher.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [NotificationsModule, StockModule],
  controllers: [OrdersController],
  providers: [OrdersService, DeadlineWatcherService],
  exports: [OrdersService],
})
export class OrdersModule {}
