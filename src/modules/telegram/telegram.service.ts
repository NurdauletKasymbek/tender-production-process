import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TelegramBot = require('node-telegram-bot-api');
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: TelegramBot;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token || token === 'your_bot_token_from_BotFather') {
      console.warn('⚠️  TELEGRAM_BOT_TOKEN орнатылмаған — бот іске қосылмайды');
      return;
    }
    this.bot = new TelegramBot(token, { polling: true });
    this.registerHandlers();
    console.log('🤖 Telegram бот іске қосылды');
  }

  private registerHandlers() {
    this.bot.onText(/\/start/, async (msg) => {
      const tgId = BigInt(msg.from!.id);
      const user = await this.prisma.user.findUnique({ where: { telegramId: tgId } });

      const webAppUrl = this.config.get<string>('TELEGRAM_WEBAPP_URL');

      if (!user) {
        await this.bot.sendMessage(
          msg.chat.id,
          `Сәлеметсіз бе, ${msg.from?.first_name}!\n\n` +
            `Сіз әлі жүйеде тіркелмегенсіз. Сіздің Telegram ID-ыңызды әкімшіге жіберіңіз: \`${msg.from!.id}\``,
          { parse_mode: 'Markdown' },
        );
        return;
      }

      await this.bot.sendMessage(
        msg.chat.id,
        `Қош келдіңіз, ${user.fullName}!\nРөл: *${user.role}*\n\nҚосымшаны ашу үшін төмендегі батырманы басыңыз:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📱 Қосымшаны ашу', web_app: { url: webAppUrl! } }],
            ],
          },
        },
      );
    });

    this.bot.onText(/\/myid/, (msg) => {
      this.bot.sendMessage(msg.chat.id, `Сіздің ID: \`${msg.from!.id}\``, {
        parse_mode: 'Markdown',
      });
    });
  }

  /** Қолданушыға хабарлама жіберу */
  async sendMessage(telegramId: bigint, text: string) {
    if (!this.bot) {
      console.log(`[MOCK Telegram] → ${telegramId}: ${text}`);
      return;
    }
    return this.bot.sendMessage(Number(telegramId), text, { parse_mode: 'Markdown' });
  }
}
