import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { validateTelegramInitData } from './telegram-auth.util';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  /**
   * Telegram Mini App-тан initData қабылдап, JWT қайтарады.
   * Қолданушы дерекқорда жоқ болса — қате (әкімші алдын ала қосуы керек).
   */
  async loginWithTelegram(initData: string) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const { valid, user: tgUser } = validateTelegramInitData(initData, botToken!);

    if (!valid || !tgUser) {
      throw new UnauthorizedException('Telegram деректерін тексеру сәтсіз аяқталды');
    }

    const user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(tgUser.id) },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Сіз жүйеде тіркелмегенсіз. Әкімшіге хабарласыңыз.',
      );
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Сіздің тіркелгіңіз белсенді емес');
    }

    const token = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      telegramId: user.telegramId.toString(),
    });

    return {
      accessToken: token,
      user: this.publicUser(user),
    };
  }

  /** Frontend-ке қауіпсіз қайтарылатын user жазбасы */
  private publicUser(user: {
    id: string;
    telegramId: bigint;
    telegramUsername: string | null;
    fullName: string;
    phone: string | null;
    role: string;
    isActive: boolean;
  }) {
    return {
      id: user.id,
      telegramId: user.telegramId.toString(),
      telegramUsername: user.telegramUsername,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Қолданушы табылмады');
    return this.publicUser(user);
  }
}
