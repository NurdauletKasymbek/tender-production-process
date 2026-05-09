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

// 110 = на согласовании, 120 = подписан поставщиком, 190 = действующий,
// 200 = исполнен, 210/220 = расторгнут/отменён
// Бізге тек **190** керек — әрекет ететін, бірақ әлі орындалмаған
const ACTIVE_STATUS_ID = 190;

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
  faktExecDate: string | null;
  refContractStatusId: number;
  trdBuyNameRu: string | null;
  descriptionRu: string | null;
  refCurrencyCode: string | null;
  /** Тапсырыс берушінің заңды мекен-жайы — бұл біздің "deliveryAddress" */
  customerLegalAddress: string | null;
  /** Сатушының (біздің) мекен-жайы — қолданбаймыз */
  supplierLegalAddress: string | null;
  finYear: number | null;
  /** Орындау актілері. statusId=15 ("Утвержден") болса контракт бітіп қойған. */
  Acts: Array<{ statusId: number }> | null;
  Customer: {
    nameRu: string | null;
    fullNameRu: string | null;
  } | null;
}

/** Утвержденная акт статус коды — контракт нақты орындалған деп есептейміз */
const ACT_APPROVED_STATUS = 15;

const CONTRACT_QUERY = `
  query WonContracts($filter: ContractFiltersInput, $limit: Int, $after: Int) {
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
      faktExecDate
      refContractStatusId
      trdBuyNameRu
      descriptionRu
      refCurrencyCode
      customerLegalAddress
      supplierLegalAddress
      finYear
      Acts { statusId }
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
   * GraphQL арқылы:
   *   - supplierBiin = біздің БСН
   *   - refContractStatusId = 190 (тек әрекет ететін)
   *   - finYear = ағымдағы жыл
   * Және post-process: faktExecDate (нақты орындалу) бар контракттарды шығарамыз.
   */
  private async fetchWonLots(opts: { allYears?: boolean } = {}): Promise<ContractNode[]> {
    const bin = this.config.get<string>('GOSZAKUP_BIN');
    if (!bin) {
      this.logger.warn('GOSZAKUP_BIN орнатылмаған');
      return [];
    }

    const filter: Record<string, unknown> = {
      supplierBiin: bin,
      refContractStatusId: [ACTIVE_STATUS_ID],
    };
    if (!opts.allYears) {
      filter.finYear = new Date().getFullYear();
    }

    const all: ContractNode[] = [];
    let after: number | undefined;
    const PAGE = 100;
    const MAX_PAGES = 20; // қауіпсіздік шегі

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const variables = { filter, limit: PAGE, after };
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

    // Post-process — контракт "Действует" болғанымен орындалғандарды шығарамыз:
    //   1) Acts ішінде statusId=15 ("Утвержден") болса → нақты бітіп қойған
    //   2) faktExecDate белгілі болса → орындалған
    //   3) planExecDate бүгіннен бұрын → мерзімі өткен (қарамаймыз)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let droppedDoneByAct = 0;
    const active = all.filter((c) => {
      // 1) Утвержден актілері бар ма?
      if (c.Acts && c.Acts.some((a) => a.statusId === ACT_APPROVED_STATUS)) {
        droppedDoneByAct += 1;
        return false;
      }
      // 2) Фактически исполнен
      if (c.faktExecDate) return false;
      // 3) Мерзімі өткен
      const deadline = c.planExecDate || c.contractEndDate || c.ecEndDate;
      if (!deadline) return true;
      const d = new Date(deadline.replace(' ', 'T'));
      return d.getTime() >= today.getTime();
    });

    this.logger.log(
      `Goszakup: барлығы ${all.length} → активті ${active.length} ` +
        `(${droppedDoneByAct} утвержден актімен бітіп қойған, ${all.length - active.length - droppedDoneByAct} мерзімі өткен/орындалған)`,
    );
    return active;
  }

  /**
   * Келісімшартты тапсырысқа айналдыру.
   * Бар болса — деректерін жаңартады (мысалы, мекен-жай қате болса) және `false` қайтарады.
   * Жоқ болса — жаңасын жасап `true` қайтарады.
   */
  private async processContract(c: ContractNode, opts: { silent?: boolean } = {}): Promise<boolean> {
    const goszakupId = String(c.id);
    const exists = await this.prisma.order.findUnique({ where: { goszakupId } });
    if (exists) {
      // Дұрыс мекен-жай (тапсырыс берушінікі) сақталмаған болса — түзетеміз.
      // Бұл ескі қате (supplierLegalAddress) орнына дұрыс мәнді қояды.
      const correctAddress = c.customerLegalAddress || null;
      if (correctAddress && exists.deliveryAddress !== correctAddress) {
        await this.prisma.order.update({
          where: { id: exists.id },
          data: { deliveryAddress: correctAddress },
        });
      }
      return false;
    }

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
        // Тапсырыс берушінің мекен-жайы (біздікі емес!)
        deliveryAddress: c.customerLegalAddress || null,
        status: OrderStatus.NEW_TENDER,
      },
    });

    this.logger.log(`✅ Жаңа тапсырыс: ${order.tenderNumber}`);

    if (!opts.silent) {
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
    }
    return true;
  }

  /**
   * Goszakup-та "Утвержден" актісі бар (statusId=15) немесе faktExecDate белгіленген
   * келісімшарттарға сай тапсырыстарды CLOSED күйіне ауыстырады.
   *
   * Бұл деректер базасында бұрыннан жатқан, бірақ Goszakup жағында бітіп қойған
   * тапсырыстарды тазарту үшін қолданылады (бір реттік немесе мерзімдік).
   */
  async cleanupApprovedOrders(userId: string): Promise<{
    ok: boolean;
    configured: boolean;
    fetched?: number;
    closedDoneIds?: number;
    closed?: number;
    message?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        configured: false,
        message: 'GOSZAKUP_API_TOKEN немесе GOSZAKUP_BIN орнатылмаған',
      };
    }

    try {
      const bin = this.config.get<string>('GOSZAKUP_BIN')!;
      const filter: Record<string, unknown> = {
        supplierBiin: bin,
        refContractStatusId: [ACTIVE_STATUS_ID],
      };

      const all: ContractNode[] = [];
      let after: number | undefined;
      const PAGE = 100;
      const MAX_PAGES = 20;

      for (let page = 0; page < MAX_PAGES; page += 1) {
        const variables = { filter, limit: PAGE, after };
        const { data } = await this.http.post('/graphql', {
          query: CONTRACT_QUERY,
          variables,
        });
        if (data.errors) {
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

      const doneIds = all
        .filter(
          (c) =>
            (c.Acts && c.Acts.some((a) => a.statusId === ACT_APPROVED_STATUS)) ||
            !!c.faktExecDate,
        )
        .map((c) => String(c.id));

      if (doneIds.length === 0) {
        return {
          ok: true,
          configured: true,
          fetched: all.length,
          closedDoneIds: 0,
          closed: 0,
        };
      }

      const toClose = await this.prisma.order.findMany({
        where: {
          goszakupId: { in: doneIds },
          status: { notIn: [OrderStatus.CLOSED, OrderStatus.REJECTED] },
        },
        select: { id: true, status: true },
      });

      const now = new Date();
      let closed = 0;
      for (const o of toClose) {
        await this.prisma.$transaction([
          this.prisma.order.update({
            where: { id: o.id },
            data: {
              status: OrderStatus.CLOSED,
              completedAt: now,
              responsibleId: null,
            },
          }),
          this.prisma.orderStatusHistory.create({
            data: {
              orderId: o.id,
              fromStatus: o.status,
              toStatus: OrderStatus.CLOSED,
              changedById: userId,
              comment: 'Goszakup-та "Утвержден" актісі — автоматты тазарту',
            },
          }),
        ]);
        closed += 1;
      }

      this.logger.log(
        `Cleanup: Goszakup-та ${doneIds.length} бітіп қойған, БД-да ${closed} тапсырыс CLOSED-ке көшті`,
      );

      return {
        ok: true,
        configured: true,
        fetched: all.length,
        closedDoneIds: doneIds.length,
        closed,
      };
    } catch (e: any) {
      return {
        ok: false,
        configured: true,
        message: e?.message || 'Cleanup қатесі',
      };
    }
  }

  /**
   * Админ батырмасы үшін қолмен синхрондау.
   * `silent: true`   — Telegram хабарламаларсыз (бастапқы импорт)
   * `allYears: true` — барлық жылдар бойынша (әдепкі: тек ағымдағы жыл)
   */
  async manualSync(opts: { silent?: boolean; allYears?: boolean } = {}) {
    if (!this.isConfigured()) {
      return {
        ok: false,
        message: 'GOSZAKUP_API_TOKEN немесе GOSZAKUP_BIN орнатылмаған',
        configured: false,
      };
    }
    try {
      const contracts = await this.fetchWonLots({ allYears: opts.allYears });
      let created = 0;
      for (const c of contracts) {
        if (await this.processContract(c, { silent: opts.silent })) created += 1;
      }
      return {
        ok: true,
        configured: true,
        fetched: contracts.length,
        created,
        skipped: contracts.length - created,
        silent: !!opts.silent,
        allYears: !!opts.allYears,
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
