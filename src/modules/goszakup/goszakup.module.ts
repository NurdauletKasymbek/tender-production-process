import { Controller, Get, Post, Query, UseGuards, Module } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
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
  @ApiQuery({ name: 'silent', required: false, description: 'true → Telegram хабарламасыз (бастапқы импорт)' })
  sync(@Query('silent') silent?: string) {
    return this.goszakup.manualSync({ silent: silent === 'true' });
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
