import { PrismaClient, UserRole, OrderStatus, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Демо деректерді жүктеу...');

  // 8 рөл бойынша демо қолданушылар
  const users = [
    { telegramId: 1001n, fullName: 'Әлия Әкімова', role: UserRole.ADMIN },
    { telegramId: 1002n, fullName: 'Бекзат Тендеров', role: UserRole.TENDER_DEPARTMENT },
    { telegramId: 1003n, fullName: 'Дәурен Басшиев', role: UserRole.DIRECTOR },
    { telegramId: 1004n, fullName: 'Ермек Цехтанов', role: UserRole.PRODUCTION_HEAD },
    { telegramId: 1005n, fullName: 'Жанар Маманова', role: UserRole.WORKSHOP_WORKER },
    { telegramId: 1006n, fullName: 'Қанат Қаптаушы', role: UserRole.PACKAGING },
    { telegramId: 1007n, fullName: 'Мұрат Тиеуші', role: UserRole.LOADING },
    { telegramId: 1008n, fullName: 'Нұрлан Логистов', role: UserRole.LOGISTICS },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { telegramId: u.telegramId },
      update: {},
      create: u,
    });
  }
  console.log(`✅ ${users.length} қолданушы құрылды`);

  // Демо тапсырыс
  const tenderUser = await prisma.user.findUnique({ where: { telegramId: 1002n } });

  const order = await prisma.order.upsert({
    where: { goszakupId: 'DEMO-2026-001' },
    update: {},
    create: {
      goszakupId: 'DEMO-2026-001',
      tenderNumber: '12345-2026',
      contractNumber: 'ДГ-2026/156',
      customerName: 'Шымкент қаласы әкімдігі',
      customerBin: '000140000123',
      productName: 'Кеңсе мебелі (үстелдер мен орындықтар)',
      productDescription: '50 жұмыс орны үшін кеңсе мебелі жинағы',
      quantity: 50,
      unit: 'жинақ',
      totalAmount: new Prisma.Decimal(15_000_000),
      currency: 'KZT',
      contractDate: new Date(),
      deadline: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      deliveryAddress: 'Шымкент қ., Тәуке хан даңғылы 6',
      deliveryContact: 'Айдос Жұмабеков, +7 701 234 5678',
      status: OrderStatus.NEW_TENDER,
      responsibleId: tenderUser!.id,
    },
  });

  await prisma.orderStatusHistory.create({
    data: {
      orderId: order.id,
      toStatus: OrderStatus.NEW_TENDER,
      changedById: tenderUser!.id,
      comment: 'Goszakup-тан автоматты түрде жасалды (демо)',
    },
  });

  console.log(`✅ Демо тапсырыс жасалды: ${order.tenderNumber}`);
  console.log('🎉 Дайын!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
