import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateStockItemDto,
  CreateStockMovementDto,
  UpdateStockItemDto,
} from './dto/stock.dto';
import { StockService } from './stock.service';

@ApiTags('Склад')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('stock')
export class StockController {
  constructor(private stock: StockService) {}

  @Get()
  @ApiOperation({ summary: 'Склад бірліктерінің тізімі' })
  list(
    @Query('search') search?: string,
    @Query('lowOnly') lowOnly?: string,
    @Query('all') all?: string,
  ) {
    return this.stock.list({
      search,
      lowOnly: lowOnly === 'true',
      activeOnly: all !== 'true',
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Склад статистикасы' })
  stats() {
    return this.stock.stats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Бірлік мәліметі + соңғы 50 қозғалыс' })
  findOne(@Param('id') id: string) {
    return this.stock.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.LOADING)
  @ApiOperation({ summary: 'Жаңа склад бірлігін жасау' })
  create(@Body() dto: CreateStockItemDto, @Req() req: any) {
    return this.stock.create(dto, req.user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.LOADING)
  @ApiOperation({ summary: 'Бірлік мәліметін жаңарту' })
  update(@Param('id') id: string, @Body() dto: UpdateStockItemDto) {
    return this.stock.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Бірлікті өшіру (soft — isActive=false)' })
  remove(@Param('id') id: string) {
    return this.stock.remove(id);
  }

  @Post(':id/movements')
  @Roles(UserRole.ADMIN, UserRole.LOADING)
  @ApiOperation({ summary: 'Қозғалыс жазу (IN/OUT/ADJUST)' })
  createMovement(
    @Param('id') id: string,
    @Body() dto: CreateStockMovementDto,
    @Req() req: any,
  ) {
    return this.stock.createMovement(id, dto, req.user.id);
  }
}
