import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios, { AxiosInstance } from 'axios';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '@prisma/client';

/**
 * Goszakup API интеграциясы.
 *
 * НАЗАР: Goszakup-та REST/GraphQL endpoint-тары бар (ows.goszakup.gov.kz).
 * Нақты өндірісте: токен + БСН/ИИН арқылы фирманың жеңіске жеткен лоттарын
 * тарту керек. Бұл MVP-да негізгі механизм көрсетілген:
 *   - cron бойынша API сұранысы
 *   - дерекқорда болмаған тендерлер үшін Order жасау
 *   - тендерлік бөлімге хабарлама
 *
 * Нақты endpoint қосылғанда тек fetchWonLots() әдісін ауыстыру жеткілікті.
 */
@Injectable()
export class GoszakupService {
  private readonly logger = new Logger(GoszakupService.name);
  private http: AxiosInstance;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {
    this.http = axios.create({
      baseURL: this.config.get<string>('GOSZAKUP_API_URL'),
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${this.config.get<string>('GOSZAKUP_API_TOKEN')}`,
      },
    });
  }

  /** Әр 5 минут сайын жаңа жеңімпаз тендерлерді іздеу */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async pollWonTenders() {
    if (!this.config.get<string>('GOSZAKUP_API_TOKEN') ||
        this.config.get<string>('GOSZAKUP_API_TOKEN') === 'your_token') {
      // Токен орнатылмаған — поллинг өткізіледі
      return;
    }

    try {
      const lots = await this.fetchWonLots();
      this.logger.log(`Goszakup-тан ${lots.length} лот алынды`);

      for (const lot of lots) {
        await this.processLot(lot);
      }
    } catch (e) {
      this.logger.error('Goszakup поллингі сәтсіз', e);
    }
  }

  /**
   * Жеңіске жеткен лоттарды алу.
   * Бұл — placeholder. Нақты Goszakup схемасына сай ауыстырылады.
   */
  private async fetchWonLots(): Promise<GoszakupLot[]> {
    const bin = this.config.get<string>('GOSZAKUP_BIN');
    // Мысалы: GraphQL немесе REST endpoint
    // const { data } = await this.http.get('/contracts', { params: { winner_bin: bin, status: 'won' } });
    // return data.items;
    return []; // MVP placeholder
  }

  /** Лотты тапсырысқа айналдыру */
  private async processLot(lot: GoszakupLot) {
    const exists = await this.prisma.order.findUnique({
      where: { goszakupId: lot.lotId },
    });
    if (exists) return;

    const order = await this.prisma.order.create({
      data: {
        goszakupId: lot.lotId,
        tenderNumber: lot.tenderNumber,
        contractNumber: lot.contractNumber,
        customerName: lot.customerName,
        customerBin: lot.customerBin,
        productName: lot.productName,
        productDescription: lot.description,
        quantity: lot.quantity,
        unit: lot.unit ?? 'дана',
        totalAmount: new Prisma.Decimal(lot.totalAmount),
        deadline: new Date(lot.deadline),
        contractDate: lot.contractDate ? new Date(lot.contractDate) : null,
        deliveryAddress: lot.deliveryAddress,
        status: OrderStatus.NEW_TENDER,
      },
    });

    this.logger.log(`✅ Жаңа тапсырыс жасалды: ${order.tenderNumber}`);

    await this.notifications.notifyByRole(
      UserRole.TENDER_DEPARTMENT,
      'NEW_ORDER',
      'Goszakup-тан жаңа тендер келді',
      `Тендер №${order.tenderNumber}\nТапсырыс беруші: ${order.customerName}\nӨнім: ${order.productName}`,
      order.id,
    );
  }

  /** Қолмен синхрондау (admin батырмасы) */
  async manualSync() {
    await this.pollWonTenders();
    return { ok: true };
  }
}

interface GoszakupLot {
  lotId: string;
  tenderNumber: string;
  contractNumber?: string;
  customerName: string;
  customerBin?: string;
  productName: string;
  description?: string;
  quantity: number;
  unit?: string;
  totalAmount: number;
  deadline: string;
  contractDate?: string;
  deliveryAddress?: string;
}
