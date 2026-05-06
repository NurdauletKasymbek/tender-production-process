import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios, { AxiosInstance } from 'axios';
import { Prisma, OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Goszakup интеграциясы (v3 GraphQL).
 *
 * Қолданылатын endpoint: https://ows.goszakup.gov.kz/v3/graphql
 * Сүзгі: `supplierBiin` = біздің компания БСН-і + `refContractStatusId` (190 = қол қойылған)
 *
 * .env үшін:
 *   GOSZAKUP_API_TOKEN — жеке токен (Bearer)
 *   GOSZAKUP_BIN       — компания БСН-і (supplier_biin)
 *   GOSZAKUP_API_URL   — әдепкі: https://ows.goszakup.gov.kz/v3
 */

// 190 = "подписан/действующий", 200 = "исполнен", 110/120 = "проект/на согласовании"
const SIGNED_STATUS_IDS = [190, 200];

interface ContractNode {
  id: number;
  contractNumber: string;
  contractNumberSys: string;
  customerBin: string;
  contractSum: string | number;
  signDate: string | null;
  ecEndDate: string | null;
  planExecDate: string | null;
  contractEndDate: string | null;
  refContractStatusId: number;
  trdBuyNameRu: string | null;
  descriptionRu: string | null;
  refCurrencyCode: string | null;
  supplierLegalAddress: string | null;
  Customer: {
    nameRu: string | null;
    fullNameRu: string | null;
  } | null;
}

const CONTRACT_QUERY = `
  query WonContracts($filter: FilterContract, $limit: Int, $after: Int) {
    Contract(filter: $filter, limit: $limit, after: $after) {
      id
      contractNumber
      contractNumberSys
      customerBin
      contractSum
      signDate
      ecEndDate
      planExecDate
      contractEndDate
      refContractStatusId
      trdBuyNameRu
      descriptionRu
      refCurrencyCode
      supplierLegalAddress
      Customer { nameRu fullNameRu }
    }
  }
`;

@Injectable()
export class GoszakupService {
  private readonly logger = new Logger(GoszakupService.name);
  private http: AxiosInstance;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {
    const baseURL =
      this.config.get<string>('GOSZAKUP_API_URL') || 'https://ows.goszakup.gov.kz/v3';
    const token = this.config.get<string>('GOSZAKUP_API_TOKEN');
    this.http = axios.create({
      baseURL,
      timeout: 20000,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  /** Әр 5 минут сайын жаңа жеңімпаз тендерлерді іздеу */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async pollWonTenders() {
    if (!this.isConfigured()) {
      // Token немесе BIN орнатылмаған — поллинг өткізіледі
      return;
    }

    try {
      const contracts = await this.fetchWonLots();
      this.logger.log(`Goszakup-тан ${contracts.length} келісімшарт алынды`);

      let created = 0;
      for (const c of contracts) {
        const wasCreated = await this.processContract(c);
        if (wasCreated) created += 1;
      }
      if (created > 0) {
        this.logger.log(`✅ Жаңа тапсырыс: ${created}`);
      }
    } catch (e: any) {
      this.logger.error(`Goszakup поллингі сәтсіз: ${e?.message || e}`);
    }
  }

  /**
   * Жеңіске жеткен (қол қойылған) келісімшарттарды алу.
   * GraphQL арқылы supplier_biin және статус бойынша сүзгі.
   */
  private async fetchWonLots(): Promise<ContractNode[]> {
    const bin = this.config.get<string>('GOSZAKUP_BIN');
    if (!bin) {
      this.logger.warn('GOSZAKUP_BIN орнатылмаған');
      return [];
    }

    const all: ContractNode[] = [];
    let after: number | undefined;
    const PAGE = 100;
    const MAX_PAGES = 10; // қауіпсіздік шегі

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const variables = {
        filter: { supplierBiin: bin, refContractStatusId: SIGNED_STATUS_IDS },
        limit: PAGE,
        after,
      };
      const { data } = await this.http.post('/graphql', {
        query: CONTRACT_QUERY,
        variables,
      });

      if (data.errors) {
        this.logger.error(`GraphQL қатесі: ${JSON.stringify(data.errors)}`);
        throw new Error(data.errors[0]?.message || 'GraphQL error');
      }

      const items: ContractNode[] = data.data?.Contract || [];
      if (items.length === 0) break;
      all.push(...items);

      const nextLastId = data.extensions?.pageInfo?.lastId;
      const hasNext = data.extensions?.pageInfo?.hasNextPage;
      if (!hasNext || !nextLastId) break;
      after = Number(nextLastId);
    }

    return all;
  }

  /** Келісімшартты тапсырысқа айналдыру (бар болса өткізіп жібереді) */
  private async processContract(c: ContractNode): Promise<boolean> {
    const goszakupId = String(c.id);
    const exists = await this.prisma.order.findUnique({ where: { goszakupId } });
    if (exists) return false;

    const productName =
      (c.trdBuyNameRu && c.trdBuyNameRu.trim()) ||
      (c.descriptionRu && c.descriptionRu.trim()) ||
      `Келісімшарт №${c.contractNumber}`;

    const deadlineRaw = c.planExecDate || c.contractEndDate || c.ecEndDate;
    const deadline = deadlineRaw ? new Date(deadlineRaw.replace(' ', 'T')) : null;
    if (!deadline || Number.isNaN(deadline.getTime())) {
      this.logger.warn(`Келісімшарт ${goszakupId}: жарамды deadline жоқ — өткізілді`);
      return false;
    }

    const contractDate = c.signDate ? new Date(c.signDate.replace(' ', 'T')) : null;

    const order = await this.prisma.order.create({
      data: {
        goszakupId,
        tenderNumber: c.contractNumber || c.contractNumberSys || goszakupId,
        contractNumber: c.contractNumberSys || c.contractNumber || null,
        customerName: c.Customer?.nameRu || c.Customer?.fullNameRu || `БСН ${c.customerBin}`,
        customerBin: c.customerBin || null,
        productName,
        productDescription: c.descriptionRu || null,
        quantity: 1, // Goszakup-та контракт деңгейінде сан жоқ; ContractUnits қажет (кейін)
        unit: 'жинақ',
        totalAmount: new Prisma.Decimal(c.contractSum || 0),
        currency: c.refCurrencyCode || 'KZT',
        deadline,
        contractDate,
        deliveryAddress: c.supplierLegalAddress || null,
        status: OrderStatus.NEW_TENDER,
      },
    });

    this.logger.log(`✅ Жаңа тапсырыс: ${order.tenderNumber}`);

    await this.notifications.notifyByRole(
      UserRole.TENDER_DEPARTMENT,
      'NEW_ORDER',
      'Goszakup-тан жаңа тендер келді',
      `Тендер №${order.tenderNumber}\n` +
        `Тапсырыс беруші: ${order.customerName}\n` +
        `Сома: ${Number(c.contractSum).toLocaleString('kk-KZ')} ${order.currency}\n` +
        `Мерзім: ${deadline.toISOString().slice(0, 10)}`,
      order.id,
    );
    return true;
  }

  /** Админ батырмасы үшін қолмен синхрондау */
  async manualSync() {
    if (!this.isConfigured()) {
      return {
        ok: false,
        message: 'GOSZAKUP_API_TOKEN немесе GOSZAKUP_BIN орнатылмаған',
        configured: false,
      };
    }
    try {
      const contracts = await this.fetchWonLots();
      let created = 0;
      for (const c of contracts) {
        if (await this.processContract(c)) created += 1;
      }
      return {
        ok: true,
        configured: true,
        fetched: contracts.length,
        created,
        skipped: contracts.length - created,
      };
    } catch (e: any) {
      return {
        ok: false,
        configured: true,
        message: e?.message || 'Goszakup қатесі',
      };
    }
  }

  isConfigured(): boolean {
    const token = this.config.get<string>('GOSZAKUP_API_TOKEN');
    const bin = this.config.get<string>('GOSZAKUP_BIN');
    return !!token && token !== 'your_token' && !!bin && bin !== 'your_company_bin';
  }
}
