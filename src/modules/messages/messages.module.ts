import {
  Body, Controller, Get, Injectable, Module, NotFoundException, Param,
  Post, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationType, UserRole } from '@prisma/client';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';

class CreateMessageDto {
  @IsString() @MinLength(1) @MaxLength(2000) text: string;
  @IsOptional() @IsUUID() fileId?: string;
}

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async list(orderId: string) {
    return this.prisma.orderMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
        file: {
          select: {
            id: true, fileName: true, fileType: true, mimeType: true,
          },
        },
      },
    });
  }

  async create(orderId: string, dto: CreateMessageDto, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, tenderNumber: true, productName: true },
    });
    if (!order) throw new NotFoundException('Тапсырыс табылмады');

    // Файл сілтемесі болса — ол шынымен осы тапсырысқа тиесілі ме тексереміз
    if (dto.fileId) {
      const file = await this.prisma.orderFile.findUnique({
        where: { id: dto.fileId },
        select: { orderId: true },
      });
      if (!file || file.orderId !== orderId) {
        throw new NotFoundException('Тіркелген файл табылмады');
      }
    }

    const msg = await this.prisma.orderMessage.create({
      data: {
        orderId,
        authorId: userId,
        text: dto.text.trim(),
        fileId: dto.fileId || null,
        stage: order.status,
      },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
        file: {
          select: { id: true, fileName: true, fileType: true, mimeType: true },
        },
      },
    });

    // Хабарламаны барлық қатысушыларға (ADMIN + DIRECTOR + ағымдағы кезең жауаптысы)
    // жібереміз, бірақ авторға өзіне жібермейміз.
    const author = msg.author;
    const previewText = msg.text.length > 100 ? msg.text.slice(0, 97) + '...' : msg.text;
    const title = `💬 ${order.tenderNumber}: ${author.fullName}`;
    const body =
      `«${order.productName}»\n` +
      `${previewText}` +
      (msg.file ? `\n\n📎 ${msg.file.fileName}` : '');

    await this.notifyParticipants(
      orderId,
      userId,
      title,
      body,
    );

    return msg;
  }

  /**
   * Тапсырысқа қатысы бар адамдарға (жауапты + ADMIN + DIRECTOR) хабарлама жібереді.
   * Авторға өзіне жібермейді.
   */
  private async notifyParticipants(
    orderId: string,
    authorId: string,
    title: string,
    body: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { responsibleId: true },
    });
    if (!order) return;

    // Жауапты + ADMIN/DIRECTOR-лар
    const recipients = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          ...(order.responsibleId ? [{ id: order.responsibleId }] : []),
          { role: UserRole.ADMIN },
          { role: UserRole.DIRECTOR },
        ],
        NOT: { id: authorId },
      },
      select: { id: true },
    });

    for (const r of recipients) {
      await this.notifications.notifyUser(
        r.id,
        'STATUS_CHANGE' as NotificationType,
        title,
        body,
        orderId,
      );
    }
  }
}

@ApiTags('Хабарламалар (кезеңаралық)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('orders/:orderId/messages')
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Тапсырыс бойынша хабарламалар тізімі' })
  list(@Param('orderId') orderId: string) {
    return this.messages.list(orderId);
  }

  @Post()
  @ApiOperation({ summary: 'Жаңа хабарлама қалдыру' })
  create(
    @Param('orderId') orderId: string,
    @Body() dto: CreateMessageDto,
    @Req() req: any,
  ) {
    return this.messages.create(orderId, dto, req.user.id);
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
