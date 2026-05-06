import { Controller, Post, UseGuards, Module } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { GoszakupService } from './goszakup.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NotificationsModule } from '../notifications/notifications.module';

@ApiTags('Goszakup')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('goszakup')
export class GoszakupController {
  constructor(private goszakup: GoszakupService) {}

  @Post('sync')
  @Roles(UserRole.ADMIN, UserRole.TENDER_DEPARTMENT)
  sync() {
    return this.goszakup.manualSync();
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [GoszakupController],
  providers: [GoszakupService],
  exports: [GoszakupService],
})
export class GoszakupModule {}
