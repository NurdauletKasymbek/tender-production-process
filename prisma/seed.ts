import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Қызметкерлерді тіркеу + әдепкі логин/парольдерді қою.
 *
 * Username/password арқылы кіру (негізгі тәсіл):
 *   admin / tender2026
 *   director / tender2026
 *   tender / tender2026
 *   production / tender2026
 *   packaging / tender2026
 *   loading / tender2026
 *   logistics / tender2026
 *
 * Әр қызметкер бірінші кірген соң — ADMIN /admin/users-те өз паролін
 * жаңартып бере алады.
 *
 * Telegram ID — хабарлама жіберу үшін (қажет емес болса null қалады).
 * Әкімші /admin/users-те telegramId өрісін кейін толтырып бере алады.
 */

const DEFAULT_PASSWORD = 'tender2026';
const SALT = 10;

async function main() {
  console.log('🌱 Қызметкерлерді тіркеу...');
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT);

  const employees: Array<{
    username: string;
    fullName: string;
    role: UserRole;
    telegramId: bigint | null;
  }> = [
    {
      username: 'admin',
      fullName: 'Қасымбеков Нұрдәулет',
      role: UserRole.ADMIN,
      telegramId: 8467447289n,
    },
    {
      username: 'director',
      fullName: 'Төлегенов Бағдат Қалдыбекұлы',
      role: UserRole.DIRECTOR,
      telegramId: null,
    },
    {
      username: 'tender',
      fullName: 'Қасымбеков Мейірбек Құралбайұлы',
      role: UserRole.TENDER_DEPARTMENT,
      telegramId: null,
    },
    {
      username: 'production',
      fullName: 'Лесов Жаңабай Құралбайұлы',
      role: UserRole.PRODUCTION_HEAD,
      telegramId: null,
    },
    {
      username: 'packaging',
      fullName: 'Серікбай (Қаптау)',
      role: UserRole.PACKAGING,
      telegramId: null,
    },
    {
      username: 'logistics',
      fullName: 'Қасымбеков Мейірбек Құралбайұлы (Логистика)',
      role: UserRole.LOGISTICS,
      telegramId: null,
    },
    {
      username: 'loading',
      fullName: 'Тиеу/Склад жауаптысы',
      role: UserRole.LOADING,
      telegramId: null,
    },
  ];

  for (const e of employees) {
    // Username-мен бірегейлендіреміз (telegramId енді міндетті емес).
    const existing = await prisma.user.findUnique({ where: { username: e.username } });
    if (existing) {
      // Бар болса — паролін НИ ӨЗГЕРТПЕЙМІЗ (Admin қойған жаңасы сақталсын),
      // тек атын/рөлін/telegramId-ін жаңартамыз.
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: e.fullName,
          role: e.role,
          isActive: true,
          ...(e.telegramId !== null ? { telegramId: e.telegramId } : {}),
          // Парольсіз қалған ескі тіркелгіге — әдепкі парольді қоямыз
          ...(existing.passwordHash ? {} : { passwordHash }),
        },
      });
    } else {
      await prisma.user.create({
        data: {
          username: e.username,
          passwordHash,
          fullName: e.fullName,
          role: e.role,
          telegramId: e.telegramId,
        },
      });
    }
  }

  console.log(`✅ ${employees.length} қызметкер дайын`);
  console.log('');
  console.log('🔐 Әдепкі парольдер (бірінші кірген соң ADMIN жаңартсын):');
  console.log(`   Пароль: ${DEFAULT_PASSWORD}`);
  console.log('   Логиндер:');
  for (const e of employees) {
    console.log(`     ${e.username.padEnd(12)} → ${e.fullName} (${e.role})`);
  }
  console.log('');
  console.log('📲 Telegram хабарлама алу үшін:');
  console.log('   ADMIN /admin/users бетінде әр қызметкердің telegramId-ін қояды');
  console.log('   (қызметкер @GOSCONTROL_bot-та /myid басып ID-сін жібереді).');
  console.log('');
  console.log('🎉 Дайын!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
