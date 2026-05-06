import { Controller, Get, Post, UseGuards, Module } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Goszakup-тан қолмен синхрондау' })
  sync() {
    return this.goszakup.manualSync();
  }

  @Get('status')
  @Roles(UserRole.ADMIN, UserRole.TENDER_DEPARTMENT, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Goszakup интеграциясының күйі' })
  status() {
    return { configured: this.goszakup.isConfigured() };
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [GoszakupController],
  providers: [GoszakupService],
  exports: [GoszakupService],
})
export class GoszakupModule {}
