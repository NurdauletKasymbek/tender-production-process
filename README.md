# Тендер және өндіріс бақылау жүйесі — Backend MVP

Goszakup тендерінде жеңіске жеткеннен кейінгі толық циклді автоматтандыратын Telegram Mini App жүйесінің **серверлік бөлігі**.

## Стек

- **Node.js + NestJS** — сервер фреймворкі
- **PostgreSQL + Prisma ORM** — дерекқор
- **JWT + Telegram initData** — авторизация
- **node-telegram-bot-api** — Telegram бот және хабарламалар
- **@nestjs/schedule** — Goszakup поллингі (cron)
- **Swagger** — API құжаттамасы

## Орнату

```bash
# 1. Тәуелділіктер
npm install

# 2. .env файлын жасау
cp .env.example .env
# .env ішіне DATABASE_URL, JWT_SECRET, TELEGRAM_BOT_TOKEN-ді жазыңыз

# 3. Дерекқор + миграция
npm run prisma:generate
npm run prisma:migrate

# 4. Демо деректер
npm run prisma:seed

# 5. Серверді іске қосу
npm run start:dev
```

Сервер: `http://localhost:3000`
Swagger: `http://localhost:3000/api/docs`

## 8 рөл

| Рөл | Кіру нүктесі |
|---|---|
| `ADMIN` | Барлығы |
| `TENDER_DEPARTMENT` | Тендерлік бөлім — тексеру, растау |
| `DIRECTOR` | Басшы — растау, дашборд |
| `PRODUCTION_HEAD` | Өндіріс бастығы — тапсырмалар тарату |
| `WORKSHOP_WORKER` | Цех маманы — өз тапсырмалары |
| `PACKAGING` | Қаптау |
| `LOADING` | Тиеу |
| `LOGISTICS` | Логистика — жеткізу |

## Тапсырыс циклі (state machine)

```
NEW_TENDER (Goszakup-тан автоматты)
    ↓ Тендерлік бөлім
REVIEW (тексеру)
    ↓ Тендерлік бөлім
CONFIRMATION (растау)
    ↓ Басшы
PRODUCTION (өндіріс)
    ↓ Өндіріс бастығы
PACKAGING (қаптау)
    ↓ Қаптау
LOADING (тиеу)
    ↓ Тиеу
LOGISTICS (жолда)
    ↓ Логист
DELIVERY (жеткізу)
    ↓ Логист / Басшы
CLOSED (жабылды)
```

Әрбір ауысу:
- `order-state-machine.ts` арқылы тексеріледі (қай рөл нені істей алады),
- тарихта (`OrderStatusHistory`) сақталады,
- келесі жауаптыға автоматты түрде Telegram-арқылы хабарлама жібереді.

## Негізгі API endpoint-тары

| Метод | Жол | Сипаттама |
|---|---|---|
| POST | `/api/auth/telegram` | Mini App-тан кіру (initData) |
| GET | `/api/orders` | Тапсырыстар тізімі (фильтрлермен) |
| GET | `/api/orders/dashboard` | Басшылық статистикасы |
| GET | `/api/orders/:id` | Тапсырыс мәліметі + тарих |
| POST | `/api/orders` | Тапсырыс жасау (қолмен) |
| PATCH | `/api/orders/:id/status/:next` | Кезеңді ауыстыру |
| POST | `/api/production/tasks` | Цех тапсырмасын жасау |
| GET | `/api/production/my-tasks` | Менің тапсырмаларым |
| POST | `/api/goszakup/sync` | Қолмен синхрондау |
| GET | `/api/notifications` | Менің хабарламаларым |

## Goszakup интеграциясы

`src/modules/goszakup/goszakup.service.ts` ішінде:
- Әр 5 минут сайын cron жұмыс істейді
- Жеңіске жеткен лоттарды іздейді
- Жаңасын `Order` ретінде сақтайды
- Тендерлік бөлімге Telegram-хабарлама жібереді

**МАҢЫЗДЫ:** `fetchWonLots()` әдісі placeholder ретінде. Goszakup API-ден нақты токен мен endpoint форматын алғаннан кейін осы әдісті ауыстыру жеткілікті — қалған логика өзгеріссіз қалады.

## Frontend (келесі қадам)

Бұл — backend MVP. Telegram Mini App frontend (React + Telegram WebApp SDK) бөлек жоба ретінде осы API-мен жұмыс істейді.

## Жоба құрылымы

```
src/
├── main.ts                          # Кіру нүктесі
├── app.module.ts                    # Негізгі модуль
├── common/
│   ├── prisma/                      # Дерекқор сервисі
│   ├── decorators/roles.decorator.ts
│   └── guards/roles.guard.ts        # RBAC
└── modules/
    ├── auth/                        # Telegram + JWT
    ├── users/                       # Қолданушылар
    ├── orders/                      # Тапсырыстар + state machine
    ├── production/                  # Цех тапсырмалары
    ├── goszakup/                    # API интеграциясы
    ├── telegram/                    # Бот
    └── notifications/               # Хабарламалар
prisma/
├── schema.prisma                    # Дерекқор схемасы
└── seed.ts                          # Демо деректер
```

## Не қосу қалды (v2 жоспары)

- [ ] Файл жүктеу контроллері (multer)
- [ ] Аналитика модулі (export Excel/PDF)
- [ ] Мерзім бұзылғанда автоматты ескерту (cron)
- [ ] Frontend (React + Telegram WebApp)
- [ ] Goszakup API нақты схемасы (токен болғаннан кейін)
- [ ] Unit + E2E тесттер
- [ ] Docker + CI/CD
