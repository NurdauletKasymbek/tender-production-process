import {
  Body, Controller, Get, Param, Post, Patch, Query, UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrderStatus, UserRole } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto, ChangeStatusDto } from './dto/order.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Тапсырыстар')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TENDER_DEPARTMENT)
  @ApiOperation({ summary: 'Тапсырыс жасау (қолмен)' })
  create(@Body() dto: CreateOrderDto, @Req() req: any) {
    return this.orders.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Тапсырыстар тізімі' })
  findAll(
    @Query('status') status?: OrderStatus,
    @Query('mine') mine?: string,
    @Req() req?: any,
  ) {
    return this.orders.findAll({
      status,
      userId: mine === 'true' ? req.user.id : undefined,
    });
  }

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.PRODUCTION_HEAD)
  @ApiOperation({ summary: 'Басшылық үшін статистика' })
  dashboard() {
    return this.orders.dashboardStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Тапсырыс мәліметі' })
  findOne(@Param('id') id: string) {
    return this.orders.findOne(id);
  }

  @Patch(':id/status/:next')
  @ApiOperation({ summary: 'Тапсырыс кезеңін өзгерту' })
  changeStatus(
    @Param('id') id: string,
    @Param('next') next: OrderStatus,
    @Body() dto: ChangeStatusDto,
    @Req() req: any,
  ) {
    return this.orders.changeStatus(id, next, req.user, dto);
  }
}
