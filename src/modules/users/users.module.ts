import {
  BadRequestException,
  Body, Controller, Delete, Get, Injectable, Module,
  NotFoundException, Param, Patch, Post, Res, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import axios from 'axios';
import type { Response } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

const SALT_ROUNDS = 10;

class CreateUserDto {
  @IsString() fullName: string;
  @IsEnum(UserRole) role: UserRole;
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsOptional() @IsString() telegramId?: string;
  @IsOptional() @IsString() telegramUsername?: string;
  @IsOptional() @IsString() phone?: string;
}

class UpdateUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsOptional() @IsString() telegramId?: string | null;
  @IsOptional() @IsString() telegramUsername?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      select: {
        id: true,
        fullName: true,
        role: true,
        username: true,
        telegramId: true,
        telegramUsername: true,
        phone: true,
        isActive: true,
        // парольдің бар-жоғын ғана көрсетеміз — hash-тың өзін қайтармаймыз
        passwordHash: true,
        createdAt: true,
      },
    }).then((rows) => rows.map((r) => ({
      ...r,
      telegramId: r.telegramId ? r.telegramId.toString() : null,
      hasPassword: !!r.passwordHash,
      passwordHash: undefined,
    })));
  }

  async create(dto: CreateUserDto) {
    const username = dto.username?.trim().toLowerCase() || null;
    const telegramId = dto.telegramId ? BigInt(dto.telegramId) : null;

    if (username) {
      const dup = await this.prisma.user.findUnique({ where: { username } });
      if (dup) throw new BadRequestException(`Логин "${username}" қолданыста`);
    }
    if (telegramId) {
      const dup = await this.prisma.user.findUnique({ where: { telegramId } });
      if (dup) throw new BadRequestException(`Telegram ID қолданыста (${telegramId})`);
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, SALT_ROUNDS)
      : null;

    return this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        role: dto.role,
        username,
        passwordHash,
        telegramId,
        telegramUsername: dto.telegramUsername || null,
        phone: dto.phone || null,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Қолданушы табылмады');

    const data: any = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.telegramUsername !== undefined) {
      data.telegramUsername = dto.telegramUsername || null;
    }

    if (dto.username !== undefined) {
      const u = dto.username?.trim().toLowerCase() || null;
      if (u) {
        const dup = await this.prisma.user.findFirst({
          where: { username: u, NOT: { id } },
        });
        if (dup) throw new BadRequestException(`Логин "${u}" қолданыста`);
      }
      data.username = u;
    }

    if (dto.telegramId !== undefined) {
      const tg = dto.telegramId ? BigInt(dto.telegramId) : null;
      if (tg) {
        const dup = await this.prisma.user.findFirst({
          where: { telegramId: tg, NOT: { id } },
        });
        if (dup) throw new BadRequestException(`Telegram ID қолданыста (${tg})`);
      }
      data.telegramId = tg;
    }

    if (dto.password !== undefined && dto.password !== '') {
      data.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }

    const user = await this.prisma.user.update({ where: { id }, data });
    return {
      ...user,
      telegramId: user.telegramId ? user.telegramId.toString() : null,
      passwordHash: undefined,
      hasPassword: !!user.passwordHash,
    };
  }

  setActive(id: string, isActive: boolean) {
    return this.prisma.user.update({ where: { id }, data: { isActive } });
  }

  /**
   * Қолданушының Telegram профиль фотосын Telegram Bot API арқылы алу.
   * Кэшке қою үшін browser-ге Cache-Control қойылады.
   * Қолданушыда telegramId жоқ немесе фото табылмаса — null қайтарамыз
   * (фронтенд fallback көрсетеді).
   */
  async getTelegramPhotoStream(
    id: string,
    botToken: string,
  ): Promise<{ stream: NodeJS.ReadableStream; contentType: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { telegramId: true },
    });
    if (!user?.telegramId) return null;
    if (!botToken) return null;

    try {
      const tgId = user.telegramId.toString();
      const photosResp = await axios.get(
        `https://api.telegram.org/bot${botToken}/getUserProfilePhotos`,
        { params: { user_id: tgId, limit: 1 }, timeout: 5000 },
      );
      const photos = photosResp.data?.result?.photos;
      if (!photos || photos.length === 0) return null;

      // photos[0] — sizes массиві, кішісінен үлкеніне. Орташасын аламыз.
      const sizes = photos[0];
      const chosen = sizes[Math.min(1, sizes.length - 1)];
      const fileId = chosen?.file_id;
      if (!fileId) return null;

      const fileResp = await axios.get(
        `https://api.telegram.org/bot${botToken}/getFile`,
        { params: { file_id: fileId }, timeout: 5000 },
      );
      const filePath = fileResp.data?.result?.file_path;
      if (!filePath) return null;

      const fileStream = await axios.get(
        `https://api.telegram.org/file/bot${botToken}/${filePath}`,
        { responseType: 'stream', timeout: 10000 },
      );
      const ct = fileStream.headers['content-type'];
      return {
        stream: fileStream.data,
        contentType: typeof ct === 'string' ? ct : 'image/jpeg',
      };
    } catch {
      return null;
    }
  }
}

@ApiTags('Қолданушылар')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private users: UsersService,
    private config: ConfigService,
  ) {}

  @Get(':id/photo')
  @ApiOperation({ summary: 'Қолданушының Telegram профиль фотосын алу' })
  async getPhoto(@Param('id') id: string, @Res() res: Response) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN') || '';
    const result = await this.users.getTelegramPhotoStream(id, botToken);
    if (!result) {
      // Frontend сурет жоқ дегенді біледі — initials fallback көрсетеді.
      return res.status(404).json({ message: 'Фото табылмады' });
    }
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    result.stream.pipe(res);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Қызметкерлер тізімі' })
  list() {
    return this.users.list();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Жаңа қызметкер қосу' })
  create(@Body() body: CreateUserDto) {
    return this.users.create(body);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Қызметкердің мәліметтерін/құпия сөзін жаңарту' })
  update(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.users.update(id, body);
  }

  @Patch(':id/active/:value')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Тіркелгіні белсендіру/тоқтату' })
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
