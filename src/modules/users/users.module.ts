import {
  Body, Controller, Get, Param, Patch, Post, UseGuards, Module, Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  create(data: { telegramId: string; fullName: string; role: UserRole; phone?: string; telegramUsername?: string }) {
    return this.prisma.user.create({
      data: {
        telegramId: BigInt(data.telegramId),
        fullName: data.fullName,
        role: data.role,
        phone: data.phone,
        telegramUsername: data.telegramUsername,
      },
    });
  }

  list() {
    return this.prisma.user.findMany({ orderBy: [{ role: 'asc' }, { fullName: 'asc' }] });
  }

  setActive(id: string, isActive: boolean) {
    return this.prisma.user.update({ where: { id }, data: { isActive } });
  }
}

@ApiTags('Қолданушылар')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() body: any) {
    return this.users.create(body);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  list() {
    return this.users.list();
  }

  @Patch(':id/active/:value')
  @Roles(UserRole.ADMIN)
  setActive(@Param('id') id: string, @Param('value') value: string) {
    return this.users.setActive(id, value === 'true');
  }
}

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
