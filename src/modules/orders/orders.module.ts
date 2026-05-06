import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { DeadlineWatcherService } from './deadline-watcher.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService, DeadlineWatcherService],
  exports: [OrdersService],
})
export class OrdersModule {}
