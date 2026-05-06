# Frontend — Тендер · Өндіріс Mini App

Telegram Mini App клиенті. React 18 + Vite + TypeScript + Telegram WebApp SDK.

## Стек

- React 18, TypeScript
- Vite (dev server, build)
- React Router 6
- Axios (бэкенд API)
- Telegram WebApp JS (`telegram-web-app.js`)

## 8 рөлге арналған экрандар

| Рөл | Басты бет |
|---|---|
| `ADMIN` | Жалпы дашборд, тапсырыстар, барлық рөлдердің мүмкіндіктері |
| `TENDER_DEPARTMENT` | Жаңа тендерлер тізімі, тексеруге/растауға жіберу, қолмен жасау |
| `DIRECTOR` | KPI дашборд, растауды күтетін тапсырыстар |
| `PRODUCTION_HEAD` | Өндірістегі тапсырыстар + цех тапсырмаларын жасау |
| `WORKSHOP_WORKER` | Менің тапсырмаларым (бастау / аяқтау / кедергі) |
| `PACKAGING` | Қаптауды күтетін тапсырыстар |
| `LOADING` | Тиеуді күтетін тапсырыстар |
| `LOGISTICS` | Жолдағы / жеткізудегі тапсырыстар |

Жалпы экрандар: тапсырыс мәліметі (статус ауыстыру + тарих + файлдар), хабарламалар, профиль, барлық тапсырыстар (іздеу + фильтр).

## Іске қосу

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Әдепкі: `http://localhost:5173`. Dev режимінде `/api/*` сұрауларын `localhost:3000`
бэкендіне проксилейді. Бэкендті бөлек терминалда іске қосыңыз:

```bash
npm run start:dev   # репо түбірінде
```

## .env

```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_API_PROXY=http://localhost:3000
```

Production-та `VITE_API_BASE_URL`-ге толық HTTPS URL қойыңыз (Telegram Mini App
тек HTTPS-те жұмыс істейді).

## Дамыту режимі (Telegram-сыз)

`isTelegramApp()` тексеру арқылы браузерден ашсаңыз — логин экранда
"Демо рөл" торы шығады. Әр рөлді басып, UI-ды тексеруге болады. Бэкенд бар
болса, сұраулар әдеттегідей жұмыс істейді (бірақ JWT нақты болмайды; нақты
тестілеу үшін Telegram-нан кіру керек).

## Telegram Mini App-қа жариялау

1. `npm run build` — `dist/` папкасы жиналады.
2. `dist/`-ті HTTPS статикалық хостингке жүктеңіз (Cloudflare Pages, Vercel,
   Nginx + сертификат).
3. BotFather-да: `/newapp` → ботты таңдаңыз → URL-ды беріңіз.
4. Бэкенд: `TELEGRAM_BOT_TOKEN` дәл осы боттың токені болуы керек —
   `initData` тек дәл сол ботқа сай жасалғанда тексеруден өтеді.

## Жоба құрылымы

```
src/
├── api/
│   ├── client.ts          # axios instance + token storage
│   └── endpoints.ts       # auth / orders / production / notifications
├── components/
│   ├── BottomNav.tsx      # төменгі навигация
│   ├── Header.tsx
│   ├── Layout.tsx
│   ├── OrderCard.tsx
│   ├── TaskCard.tsx
│   ├── StatusBadge.tsx
│   ├── EmptyState.tsx
│   └── Spinner.tsx
├── hooks/
│   ├── useAuth.tsx        # Telegram + JWT кіру, демо режим
│   └── useOrders.ts
├── pages/
│   ├── HomePage.tsx       # рөл бойынша рөлдік үй экранына бағыттайды
│   ├── LoginPage.tsx
│   ├── OrdersListPage.tsx
│   ├── OrderDetailPage.tsx
│   ├── NewOrderPage.tsx
│   ├── NotificationsPage.tsx
│   ├── ProfilePage.tsx
│   └── roles/
│       ├── AdminHome.tsx
│       ├── TenderDepartmentHome.tsx
│       ├── DirectorHome.tsx
│       ├── ProductionHeadHome.tsx
│       ├── WorkshopHome.tsx
│       ├── StageQueueHome.tsx     # Қаптау + Тиеу
│       └── LogisticsHome.tsx
├── types/index.ts
├── utils/
│   ├── labels.ts          # қазақша атаулар, түстер, форматтаушылар
│   └── telegram.ts        # WebApp SDK обертка (haptics, MainButton, BackButton)
├── styles.css             # Telegram-стилі дизайн
├── App.tsx
└── main.tsx
```

## API келісімдері (бэкендтен)

- `POST /api/auth/telegram` `{ initData }` → `{ accessToken, user }`
- `GET /api/orders?status=&mine=` → `Order[]`
- `GET /api/orders/dashboard` → статистика
- `GET /api/orders/:id` → толық мәлімет
- `POST /api/orders` → қолмен тапсырыс жасау
- `PATCH /api/orders/:id/status/:next` → келесі кезеңге жіберу
- `POST /api/production/tasks` → цех тапсырмасы
- `GET /api/production/my-tasks` → менің тапсырмаларым
- `PATCH /api/production/tasks/:id/status/:status` → күй ауыстыру
- `GET /api/notifications` → хабарламалар
- `PATCH /api/notifications/:id/read` → оқылды деп белгілеу
