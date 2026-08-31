# DO — Durable Object как держатель MongoClient

> Статус: **IMPLEMENTED / ACCEPTED** (2026-08-31). Вариант B реализован и подтверждён production benchmark'ом;
> включается переменной `DB_CLIENT_MODE=durable` (production default), откат — `DB_CLIENT_MODE=per-request` (проверен
> реально). Основано на реальных production-замерах (см. §1 и §7) и актуальной документации Cloudflare.

## 1. Текущее состояние и проблема

Production сейчас: `DB_CLIENT_MODE=per-request` + `placement.region = "aws:eu-central-1"`.

Замеры (реальные authenticated requests, 2026-08-31):

| Конфигурация                         | Mongo connect | tenants warm (total) |
| ------------------------------------ | ------------- | -------------------- |
| per-request + local-WAW (smart)      | 274-404ms     | 396-879ms            |
| per-request + remote-FRA (Frankfurt) | 86-149ms      | 201-284ms            |

Каждый HTTP-запрос платит полный lifecycle:

```text
request → new MongoClient → DNS/SRV → TCP → TLS → SCRAM auth → topology → query → close
```

Даже рядом с Atlas это 86-149ms накладных на каждый запрос. Цель DO — платить handshake один раз за жизнь DO:

```text
DO lifetime → MongoClient + pool
request 1..N → existing connections → query
```

## 2. Исследование (актуально на 2026-08-31)

| Источник                 | Вывод                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| workerd discussion #2721 | Переиспользование пула между invocations в обычном Worker невозможно («Cannot perform I/O on behalf of a different request», hang + error 1101 — подтверждено нашим экспериментом). DO, держащий клиент, — рабочий паттерн: «2000ms → 300ms end-to-end» |
| DO Data Location docs    | `locationHint` — **best effort, не гарантия**; учитывается только первым `get()`; поддерживаемые хинты: `weur` (Western Europe) — ближайший к Frankfurt                                                                                                 |
| DO Limits docs           | Free-план: только SQLite-backed DO; soft limit **1000 req/s на один объект**; simultaneous outgoing connections per request: **6** (как у Workers) — пул `maxPoolSize ≤ 5` помещается                                                                   |
| DO Pricing docs          | Free: 100k requests/day, 13,000 GB-s/day duration. **Важно**: DO, удерживающий открытые сокеты, не hibernate-eligible → duration billing идёт всё время жизни. 13,000 GB-s/day ≈ один постоянно живой DO 128MB (~28h) — впритык хватает на Free         |
| Atlas M0                 | Лимит ~500 одновременных соединений на кластер; каждый DO-инстанс держит свой пул — количество DO × pool size должно оставаться малым                                                                                                                   |
| MongoDB driver docs      | Один клиент на процесс/контекст; пул переиспользуется; `maxIdleTimeMS` закрывает неактивные соединения                                                                                                                                                  |

## 3. Архитектурные варианты

### Вариант A — Worker/Hono снаружи, только DB-слой в DO

```text
Angular → Worker/Hono → DO (MongoClient/pool) → Atlas
```

- Hono, auth, RBAC остаются в Worker; репозитории вызывают Mongo через RPC-прокси в DO.
- **Отклонён**: требует RPC-обёртки над каждым запросом репозиториев (десятки методов, сериализация курсоров/документов)
  — большой рефакторинг с высоким риском, ради того чтобы auth/JWT (микросекунды) остались в Worker.

### Вариант B — тонкий Worker-прокси, весь Hono внутри DO ✅ (ВЫБРАН И РЕАЛИЗОВАН)

```text
Angular → Worker (fetch-прокси, ~20 строк) → DO (Hono app + MongoClient/pool) → Atlas
```

- Существующий Hono-код переиспользуется **100%**: `index.ts` превращается в тонкий прокси, DO-класс владеет
  `app.fetch()` и одним `MongoClient`.
- Auth/headers/cookies/streaming — без изменений (DO `fetch()` прозрачно передаёт Request/Response, streaming
  поддерживается).
- Latency: +1 внутренний hop Worker→DO (~1-15ms в зависимости от colo DO); экономия 86-149ms handshake на каждый запрос.
- Concurrency: DO однопоточен — как и Worker; await-ы освобождают event loop, узким местом не является при текущем
  workload (soft limit 1000 req/s ≫ нагрузка).
- Failure recovery: деплой кода или eviction DO → reconnect один раз (~86-149ms + cold bundle), не на каждый запрос.
- Путь к sharding не закрывается: namespace поддерживает неограниченное число объектов — переход на per-tenant ID
  (вариант C) возможен позже без смены архитектуры.

### Вариант C — DO на тенанта

```text
tenant → отдельный DO (свой пул) → Atlas
```

- Готовый sharding, изоляция соединений.
- **Отклонён на сейчас**: N тенантов × пул соединений → риск упереться в лимит Atlas M0 (~500 соединений); cold start
  handshake на каждого нового тенанта; tenantId неизвестен до auth (auth пришлось бы выносить или дублировать).
  Возвращаться к этому при реальном росте нагрузки.

## 4. Ключевые решения дизайна (вариант B)

- **ID DO**: `idFromName("mongo")` — приемлемо, но каждый `getByName` несёт coordination-проверку (до few hundred ms на
  первый глобальный запрос). Оптимизация: вычислить ID один раз, закэшировать строку ID в module-level переменной
  Worker'а (строка — не I/O-объект, безопасна) и использовать `idFromString`. Финальное решение — за benchmark'ом.
- **locationHint**: `weur` (Western Europe) при первом `get()`. **Не гарантия** — Cloudflare выбирает дата-центр,
  минимизирующий latency от хинта. Фактическую локацию проверить: `fetch("https://cloudflare.com/cdn-cgi/trace")`
  изнутри DO (поле `colo`) — `cf-placement` для DO не работает.
- **Пул**: `maxPoolSize: 5` (лимит 6 исходящих соединений на request у DO), `maxIdleTimeMS: 30_000`.
- **Миграции**: остаются в CD (`scripts/migrate.ts`) — в DO не переносить.
- **`perf-tmp`**: остаётся до финального benchmark, потом удаляется.

## 5. Rollout (безопасный, с откатом)

```text
1. Добавить DO-класс + binding + migration tag v1 (new_sqlite_classes)
2. DB_CLIENT_MODE=durable → Worker проксирует в DO; иначе — текущий per-request путь
3. Deploy на прод с DB_CLIENT_MODE=per-request (поведение не меняется)
4. Controlled test: переключить var на durable → прогнать benchmark
5. Rollback в любой момент: вернуть var DB_CLIENT_MODE=per-request (одна строка, без деплоя кода)
```

## 6. Benchmark-план (обязательный, реальные authenticated requests)

Тот же протокол, что в A/B placement: register → login → tenant → project; endpoints `login`, `/api/tenants`,
`/api/projects/:id/preferences`; сценарии cold / warm #1-5 / 5 concurrent / after 60s / after 5min.

Отдельно замерять: Worker total, Worker→DO hop, DO init, Mongo connect, Mongo acquisition, Mongo query, DO total.
Критерий успеха: **5 concurrent → один MongoClient, один пул, все запросы успешны** (не повторять ошибку первого
benchmark'а с 401-пробами).

## 7. Результаты production benchmark (2026-08-31, реальные authenticated requests)

| Метрика                          | per-request + FRA             | durable (вариант B)                                                                     |
| -------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| tenants warm                     | 201-284ms                     | **134-161ms**                                                                           |
| preferences warm                 | 184-257ms                     | **115-135ms**                                                                           |
| login warm                       | 399-540ms                     | **252ms**                                                                               |
| Mongo connect                    | 86-149ms **на каждый запрос** | **185ms один раз** при DO init/reconnect                                                |
| Mongo acquisition                | —                             | **0ms** на каждом запросе                                                               |
| 5 / 10 / 20 concurrent           | —                             | **5/5, 10/10, 20/20 успешны**, 142-339ms, без очередей                                  |
| 1101 / hung / I/O context errors | —                             | **0**                                                                                   |
| Redeploy / DO restart            | —                             | запросы успешны, пул переиспользуется; reconnect после eviction — один раз (~185-426ms) |

Факты о location: `locationHint=weur` — best effort, НЕ гарантия Frankfurt. Косвенное подтверждение профиля Frankfurt —
connect 185ms и db phase 6-78ms. Прямое определение colo DO (через `/cdn-cgi/trace` изнутри DO) — отдельная задача, не
требуется для acceptance.

Rollback проверен реально: `DB_CLIENT_MODE=per-request` после деплоя DO-кода работал идентично прежнему поведению
(register 201, login 200, tenants 200, `remote-FRA`).

## 8. Риски

- **Duration billing**: живой DO с открытыми сокетами не hibernate → на Free-плане 13,000 GB-s/day хватает на один
  круглосуточный DO впритык; на Paid ≈ $4/мес.
- **1000 req/s soft limit** на один DO — не проблема при текущем workload, но аргумент за будущий per-tenant sharding.
- **Деплой = рестарт DO** → один reconnect после каждого деплоя.
- **Atlas M0 connection limit (~500)** — следить, если появятся дополнительные DO-инстансы.
