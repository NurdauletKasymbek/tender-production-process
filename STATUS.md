# Жоба күйі — қайта оралғанда

## Production стек

| Компонент | URL | Күй |
|---|---|---|
| Frontend | https://tender-production-process.vercel.app | Vercel (`main` branch auto-deploy) |
| Backend | https://tender-production-process-production.up.railway.app/api/docs | Railway (Dockerfile, `main` branch) |
| Database | Neon Postgres (`tender-mvp`) | DATABASE_URL Railway env-те |
| Bot | [@GOSCONTROL_bot](https://t.me/GOSCONTROL_bot) | Polling режимінде Railway-да |

## Қызметкерлер

| Рөл | Аты-жөні | Telegram ID |
|---|---|---|
| ADMIN | Қасымбеков Нұрдәулет | `8467447289` ✅ |
| DIRECTOR | Төлегенов Бағдат Қалдыбекұлы | placeholder `1` ⏳ |
| TENDER_DEPARTMENT | Қасымбеков Мейірбек Құралбайұлы | placeholder `2` ⏳ |
| PRODUCTION_HEAD | Лесов Жаңабай Құралбайұлы | placeholder `3` ⏳ |
| PACKAGING | Серікбай | placeholder `4` ⏳ |
| LOGISTICS | Қасымбеков Мейірбек (екі рөл) | placeholder `5` ⏳ |
| LOADING | Тиеу/Склад жауаптысы | placeholder `6` ⏳ |

> Қызметкер `@GOSCONTROL_bot` → `/myid` басу арқылы өз ID-сін алады.
> Алынған ID-ні `prisma/seed.ts`-те ауыстырып, Railway-де `npm run prisma:seed`.

## Toлық flow

```
Goszakup → NEW_TENDER → REVIEW → CONFIRMATION
                                     ↓
            Director таңдайды:
                ↓                    ↓
       PRODUCTION              STORAGE (STOCK)
            ↓                        ↓
       PACKAGING                     ↓
            ↓                        ↓
        STORAGE ───────────────────→ ↓
                                     ↓
                               LOADING (Логист көлік толтырады)
                                     ↓
                              LOGISTICS (жолда)
                                     ↓
                               DELIVERY → CLOSED
```

## Goszakup filter (қазіргі)

```
supplierBiin = 200340003928     (сіздің БСН)
refContractStatusId = [190]     ("Действует")
finYear = 2026                  (ағымдағы жыл)
Acts.statusId ≠ 15              ("Утвержден" актісі болмауы керек)
faktExecDate IS NULL            (нақты орындалмаған)
planExecDate >= today           (мерзімі әлі келмеген)

Нәтиже: ~30 нақты активті контракт
Cron: 5 минутта жаңарады
```

## Аяқталған Phase D — Склад инвентарь ✅

- `StockItem` + `StockMovement` (audit trail) моделдері
- /inventory дашборд: іздеу, төмен қалдық сүзгісі, санат бойынша топтастыру
- /inventory/:id мәлімет беті: үлкен қалдық дисплейі, IN/OUT/ADJUST форма, соңғы 50 қозғалыс
- /inventory/new + /inventory/:id/edit — CRUD
- CSV экспорт (`/stock/export.csv`) және CSV импорт (`/stock/import` multipart)
- OrderDetail-да "Склад байланысы" — STOCK тапсырысқа склад бірлігі мен мөлшерді бекіту
- LOADING → LOGISTICS өткенде автоматты `OUT` қозғалысы (идемпотентті, `stockDeductedAt` арқылы)

## Cleanup ✅

- POST /goszakup/cleanup-approved (ADMIN) — Goszakup-та "Утвержден" актісі бар тапсырыстарды CLOSED-ке тазарту
- Admin GoszakupSync картасында батырма

## Quality of life (Phase 2 идеялары)
- SLA трекер әр кезеңге (қызыл flag)
- Director Daily Digest (таңертеңгі дайджест)
- Forced acknowledgment (Telegram inline batырма)
- Weekly Excel report
- Bottleneck алерт

## Соңғы commit-тер

```
ebf116e Phase D: stock inventory with audit-trail movements
115a0fc Admin cleanup: close orders with approved Goszakup acts
0d51e2d Goszakup: skip approved acts (statusId=15)
31089e2 Use customerLegalAddress for delivery, not supplier
568246f Phase 2: STORAGE, transport info, control notifications
```

## Жаңа REST endpoints

```
GET    /stock                       # тізім (search, lowOnly, all)
GET    /stock/stats                 # дашборд статистикасы
GET    /stock/:id                   # мәлімет + соңғы 50 қозғалыс
POST   /stock                       # жаңа бірлік (ADMIN, LOADING)
PATCH  /stock/:id                   # өңдеу
DELETE /stock/:id                   # архивтеу (soft, ADMIN)
POST   /stock/:id/movements         # IN / OUT / ADJUST
GET    /stock/export.csv            # CSV экспорт
POST   /stock/import                # CSV импорт (multipart file)
PATCH  /orders/:id/stock-link       # тапсырысқа склад бірлігін бекіту
POST   /goszakup/cleanup-approved   # бітіп қойғандарды тазарту
```

## Қайта бастау командалары

```bash
# Жұмыс аймағын ашу
cd C:\Projects\tender-mvp
git pull

# Локалды тестілеу (қажет болса)
npm install
npx prisma generate
npm run start:dev   # http://localhost:3000

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## Жаңа Claude Code сессиясын бастағанда

Маған жіберіңіз:
> "Жоба C:\Projects\tender-mvp, соңғы commit 0d51e2d, STATUS.md қара."

Мен жалғастырамын.
