import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Нақты қызметкерлерді тіркеу.
 *
 * Telegram ID-сі белгілі болғандарға — нақты `telegramId`,
 * әлі белгісіз болғандарға — `placeholderTelegramId` (кейін
 * /myid командасы арқылы алып, мұнда ауыстыратын болады).
 *
 * placeholderTelegramId логикасы:
 *   1n .. 9n   — әлі тіркелмеген қызметкерлер (нақты Telegram ID
 *                болатын мән — 1 миллиардтан үлкен)
 *
 * Қызметкер `/start` басып, нақты ID алғанда — placeholder-ді
 * нақтысына ауыстырамыз. Ол үшін бұл файлды қайта seed жасау керек
 * (немесе DB Tables арқылы қолмен).
 */
async function main() {
  console.log('🌱 Қызметкерлерді тіркеу...');

  const employees = [
    {
      telegramId: 8467447289n, // нақты — өзіңіздікі
      fullName: 'Қасымбеков Нұрдәулет',
      role: UserRole.ADMIN,
      placeholder: false,
    },
    {
      telegramId: 1n, // әлі белгісіз
      fullName: 'Төлегенов Бағдат Қалдыбекұлы',
      role: UserRole.DIRECTOR,
      placeholder: true,
    },
    {
      telegramId: 2n, // Тендер бөлімі = Логистика (бір адам)
      fullName: 'Қасымбеков Мейірбек Құралбайұлы',
      role: UserRole.TENDER_DEPARTMENT,
      placeholder: true,
    },
    {
      telegramId: 3n,
      fullName: 'Лесов Жаңабай Құралбайұлы',
      role: UserRole.PRODUCTION_HEAD,
      placeholder: true,
    },
    {
      telegramId: 4n,
      fullName: 'Серікбай (Қаптау)',
      role: UserRole.PACKAGING,
      placeholder: true,
    },
    {
      // Логистика — Мейірбек өзі (екінші рөл)
      // Бір telegramId-ге екі User жасай алмаймыз, сондықтан жеке placeholder
      telegramId: 5n,
      fullName: 'Қасымбеков Мейірбек Құралбайұлы (Логистика)',
      role: UserRole.LOGISTICS,
      placeholder: true,
    },
    // LOADING рөлі — STORAGE кезеңіне сәйкес келеді (бөлек қызметкер керек болса осында қосамыз)
    {
      telegramId: 6n,
      fullName: 'Тиеу/Склад жауаптысы',
      role: UserRole.LOADING,
      placeholder: true,
    },
  ];

  for (const e of employees) {
    await prisma.user.upsert({
      where: { telegramId: e.telegramId },
      update: { fullName: e.fullName, role: e.role, isActive: true },
      create: { telegramId: e.telegramId, fullName: e.fullName, role: e.role },
    });
  }

  const placeholders = employees.filter((e) => e.placeholder).length;
  console.log(`✅ ${employees.length} қызметкер құрылды (${placeholders} placeholder Telegram ID-мен)`);
  console.log('');
  console.log('📋 Келесі қадам:');
  console.log('  Әр қызметкер @GOSCONTROL_bot-та /myid басады,');
  console.log('  өз нөмірін маған/админге жібереді.');
  console.log('  Содан кейін placeholder Telegram ID-ні нақтысына ауыстырамыз.');
  console.log('');
  console.log('🎉 Дайын!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
