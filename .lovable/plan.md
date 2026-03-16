## Вернуть субтитры к базовому стилю

Сейчас субтитры рендерятся жёлтым (`0xFFCC00`). Нужно вернуть классический белый текст с чёрной обводкой. Не по одному слову

### Изменения в `src/lib/videoSubtitles.ts`

Заменить `fontcolor=0xFFCC00` на `fontcolor=white` в трёх местах:

1. `**buildDrawtextFilter**` (строка ~109) — основной режим
2. `**buildHighlightDrawtextFilter**` (строки ~129, ~137) — караоке-режим

Все три drawtext-фильтра получат: `fontcolor=white:borderw=3:bordercolor=black`

Позиционирование остаётся прежним — по центру (`x=(w-text_w)/2`, `y=(h*0.55)`).