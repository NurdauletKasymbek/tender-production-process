import {
  Body, Controller, Get, Param, Patch, Post, Req, UseGuards, Module,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TaskStatus, UserRole } from '@prisma/client';
import { ProductionService } from './production.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NotificationsModule } from '../notifications/notifications.module';

@ApiTags('Өндіріс')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('production')
export class ProductionController {
  constructor(private production: ProductionService) {}

  @Post('tasks')
  @Roles(UserRole.PRODUCTION_HEAD, UserRole.ADMIN)
  createTask(@Body() body: any) {
    return this.production.createTask(body);
  }

  @Patch('tasks/:id/status/:status')
  updateStatus(
    @Param('id') id: string,
    @Param('status') status: TaskStatus,
    @Req() req: any,
  ) {
    return this.production.updateTaskStatus(id, status, req.user.id);
  }

  @Get('my-tasks')
  myTasks(@Req() req: any) {
    return this.production.getMyTasks(req.user.id);
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {}
