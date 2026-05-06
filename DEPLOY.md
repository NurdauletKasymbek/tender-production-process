# Деплой нұсқаулығы — Production-ге шығу

Демоден нағыз Telegram Mini App-ке көшу үшін **3 бөлік** керек:

| Бөлік | Қайда | Себеп |
|---|---|---|
| **Database** | Neon Postgres | қазір орнатылған ✓ |
| **Backend** (NestJS+бот) | **Railway** | әрқашан қосулы керек (бот polling, cron) |
| **Frontend** (Vite) | Vercel | қазір орнатылған ✓ (`tender-production-process.vercel.app`) |

> ⚠️ **Vercel backend-ге жарамайды** — serverless, Telegram бот polling және 5-минуттық cron жұмыс істемейді.

---

## 1. Telegram бот жасау (BotFather)

Сізде бот бұрыннан болуы мүмкін. Жоқ болса:

1. Telegram-да [@BotFather](https://t.me/BotFather) ашыңыз
2. `/newbot` → атауы (мысалы "Тендер Өндіріс") → username (мысалы `tender_prod_bot`)
3. **Token** алынады → `123456:ABCdefGhI...` — оны сақтаңыз
4. `/setprivacy` → `Disable` (бот пайдаланушы аттарын көру үшін)

> Mini App URL-ді кейінірек, frontend деплойланғаннан кейін орнатамыз.

---

## 2. Backend-ді Railway-ге деплой

### 2.1 Railway аккаунт + проект

1. [railway.com](https://railway.com) → GitHub-пен кіру
2. **New Project** → **Deploy from GitHub repo** → `NurdauletKasymbek/tender-production-process` → branch `main` (немесе `claude/elastic-panini-61752d` егер әлі merge етпесеңіз)
3. Railway автоматты `railway.json` оқиды → `npm ci && npm run build` → `npm run start:prod`

### 2.2 Environment Variables (Railway → Variables)

```
DATABASE_URL          = <Neon-нен copy>
JWT_SECRET            = <ұзақ рандом string, мысалы: openssl rand -hex 32>
JWT_EXPIRES_IN        = 7d
PORT                  = ${{ PORT }}    ← Railway автоматты қояды

TELEGRAM_BOT_TOKEN    = 123456:ABC...
TELEGRAM_BOT_USERNAME = tender_prod_bot
TELEGRAM_WEBAPP_URL   = https://tender-production-process.vercel.app

GOSZAKUP_API_URL      = https://ows.goszakup.gov.kz/v3
GOSZAKUP_API_TOKEN    = 0c7c69a0460987735e968aad73799209
GOSZAKUP_BIN          = 200340003928
GOSZAKUP_POLL_INTERVAL_MS = 300000

UPLOAD_DIR            = /data/uploads
MAX_FILE_SIZE_MB      = 10
```

### 2.3 Persistent volume (файлдар сақтау)

Railway → проект → **Settings** → **Volumes** → **Add Volume**
- Mount path: `/data`
- Size: 5 GB

Бұл `UPLOAD_DIR=/data/uploads` арқылы PDF/фотоларды сақтайды.

### 2.4 Public domain

Railway → **Settings** → **Networking** → **Generate Domain**
→ `<your-project>.up.railway.app` сияқты URL береді.

Қалаусыз болсаңыз custom domain қосуға болады (мысалы `api.tender.kz`).

### 2.5 Тексеру

`https://<your-project>.up.railway.app/api/docs` — Swagger UI ашылу керек.

---

## 3. Frontend-ті Vercel-де backend-ке қосу

Vercel → проект (`tender-production-process`) → **Settings** → **Environment Variables**:

```
VITE_API_BASE_URL = https://<your-project>.up.railway.app/api
```

> Бұл айнымалыны `Production` және `Preview` екеуіне де қойыңыз.

Сосын **Deployments** → соңғы deployment → **... → Redeploy** (env өзгергендіктен қайта build керек).

---

## 4. BotFather-да Mini App URL орнату

Telegram-да [@BotFather](https://t.me/BotFather):

```
/mybots
→ <бот таңдау>
→ Bot Settings
→ Configure Mini App
→ Edit Mini App URL
→ https://tender-production-process.vercel.app
```

Таңдау керек: **Open Web App** немесе **Configure Menu Button**.

---

## 5. Бастапқы орнату

### 5.1 Дерекқорды seed ету (қолданушылар қосу)

Railway-де терминал ашу:
```bash
railway run npm run prisma:seed
```

Немесе локалды:
```bash
DATABASE_URL=<production-DATABASE_URL> npm run prisma:seed
```

`prisma/seed.ts`-ке нақты қызметкерлердің Telegram ID-ларын қосыңыз (қазір placeholder).

> Әр қызметкер боттың `/myid` командасын басу арқылы өз Telegram ID-ін біле алады.

### 5.2 Goszakup-тан бастапқы импорт

1. Боттан `/start` → Mini App ашылады → Әкімші ретінде кіру
2. **Әкімші панелі** → **"Бастапқы импорт (хабарламасыз)"**
3. ~65 тапсырыс жасалады (барлығы NEW_TENDER кезеңінде, тендер бөлімі бастырмайды)

### 5.3 Жаңалары автоматты түрде

Railway-дегі бэкенд әр 5 минут сайын Goszakup-ты тексереді. Жаңа "Действует" контракт пайда болғанда:
- Order жасалады
- Тендер бөліміне Telegram-арқылы хабарлама келеді

---

## Локалды тексеру (деплойсыз)

### Backend

```bash
cp .env.example .env
# .env-ге Neon DATABASE_URL, JWT_SECRET, бот токенін қойыңыз
npm install
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

Backend → `http://localhost:3000`, Swagger → `http://localhost:3000/api/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend → `http://localhost:5173`

Браузерде ашқанда demo режим қол жетімді (рөл таңдау). Telegram WebApp ретінде тестілеу үшін **HTTPS қажет** — бірақ ол тек деплой кезінде керек.

---

## Кейс: бір нәрсе жұмыс істемесе

### Бот /start командасына жауап бермейді
- Railway logs тексеріңіз: "🤖 Telegram бот іске қосылды" көрінуі керек
- TELEGRAM_BOT_TOKEN дұрыс па?

### Mini App ашылмайды (HTTPS қателігі)
- Vercel домен HTTPS болуы керек ✓ (default)
- BotFather-да Mini App URL дұрыс орнатылған ба?

### "Сіз жүйеде тіркелмегенсіз"
- Қолданушы дерекқорда жоқ. `prisma/seed.ts`-ке Telegram ID-ін қосыңыз
- Немесе Swagger арқылы `POST /api/users` (admin-only — кейін қосамыз)

### Goszakup sync 500 қайтарады
- `GOSZAKUP_API_TOKEN`, `GOSZAKUP_BIN` Railway env-те ме?
- Railway logs-та `GraphQL қатесі` көрсетіледі

### CORS қателігі (frontend backend-ке қосыла алмайды)
- `app.enableCors()` қосулы (қазір ✓)
- Бірақ продукцияда нақты origin шектеу жақсы — кейін қосамыз
