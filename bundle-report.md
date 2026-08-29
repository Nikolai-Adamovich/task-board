# UI Bundle Report

> Снимок состояния бандла UI после waves 1–4 исправлений (аудит report-1/2/3 → report-result.md) и точки входа для
> дальнейшей оптимизации. Создан агентской сессией 2026-08-29.

## Как собрать и посмотреть

```bash
npm run build --workspace=ui      # output: ui/dist/ui/browser
```

Статистика печатается в конце сборки (Initial chunk files / Lazy chunk files). Для полного списка чанков:
`ng build --verbose`.

## Текущие цифры (после waves 1–4)

### Initial (загружается при старте)

| Файл              | Raw           | Transfer     |
| ----------------- | ------------- | ------------ |
| main-*.js         | 252.57 kB     | 50.70 kB     |
| styles-*.css      | 121.28 kB     | 15.88 kB     |
| **Initial total** | **373.85 kB** | **66.58 kB** |

### Топ-5 lazy-чанков

| Чанк              | Имя                          | Raw           | Transfer  |
| ----------------- | ---------------------------- | ------------- | --------- |
| chunk-B8I-sia_.js | index (**milkdown/unified**) | **957.95 kB** | 239.73 kB |
| chunk-O4wOD6Co.js | —                            | 187.69 kB     | 50.72 kB  |
| chunk-jLbkuxBE.js | —                            | 184.40 kB     | 54.14 kB  |
| chunk-CmTtxc9u.js | —                            | 133.58 kB     | 36.94 kB  |
| chunk-CNNeqslD.js | —                            | 93.03 kB      | 12.45 kB  |

Прочее: task-table 79.33 kB, board-view 74.66 kB, task-detail 41.66 kB, gfm 82.97 kB. Всего lazy-чанков: ~102.
`ui/dist/ui/browser` целиком: 4.2M (107 файлов, включая i18n JSON, темы, медиа).

## Влияние изменений сессии (сравнение с baseline через git stash)

Baseline = коммит `7157804` (до waves 1–4). Сборки идентичны по конфигурации.

| Метрика                  | Baseline                                  | С изменениями | Δ        |
| ------------------------ | ----------------------------------------- | ------------- | -------- |
| Initial total (raw)      | 374.00 kB                                 | 373.85 kB     | −0.15 kB |
| Initial total (transfer) | 66.66 kB                                  | 66.58 kB      | −0.08 kB |
| Топ-5 lazy               | 957.95 / 187.69 / 184.40 / 133.58 / 93.03 | идентично     | 0        |
| task-table chunk         | 76.54 kB                                  | 79.33 kB      | +2.79 kB |

**Вывод**: влияние исправлений сессии на бандл — в пределах погрешности. task-table +2.79 kB — это lastKnownPagination,
пробная строка Auto-режима и логика гейтинга.

## Главный кандидат на оптимизацию: lazy-чанк `index` — 958 kB

Это стек milkdown (WYSIWYG-редактор): unified / remark / mdast и плагины. Признак: warning при сборке —
`Module 'extend' used by '../node_modules/unified/lib/index.js' is not ESM` (CommonJS bailout). Чанк ленивый (грузится
только на страницах с редактором), но он в ~4 раза больше следующего чанка.

### Идеи для следующей сессии

1. **Проанализировать состав чанка**: `ng build --stats-json` + `source-map-explorer` или `esbuild --metafile` — понять,
   какие milkdown-плагины дают основной объём.
2. **Проверить полноту tree-shaking** milkdown-плагинов (импорт `@milkdown/kit` vs точечные пакеты).
3. **Дробление**: если редактор используется только в task-detail/comments — убедиться, что чанк не подтягивается
   другими страницами (сейчас он один общий `index` — вероятно, общий re-export из `ui-milkdown-editor`).
4. **CommonJS bailout** `unified` — рассмотреть `allowedCommonJsDependencies` в `angular.json`, если bailout неустраним,
   либо перейти на ESM-сборку unified.
5. **styles 121 kB** — проверить, не попадают ли в бандл все 104 темы (манифест тем грузится отдельно —
   `generate-theme-manifest.mjs`; убедиться, что CSS тем не инлайнятся в styles).

## Контекст: что менялось в этой сессии (для калибровки +2.79 kB)

- task-table: rxResource-пагинация с заморозкой lastKnownPagination, пробная строка Auto-режима, гейтинг готовности,
  ellipsis-пагинация (maxSize 5), кнопки 32px
- member/audit таблицы: measured row pitch, density через input, AUTO_MIN_ROWS 5 → 3
- useAutoRowMeasurement: probe-строки, медиана + компенсация 1px бордера
- shell: --header-height 2.5rem ниже lg, padding 12×12 ниже lg
