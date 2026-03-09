

## План: обновить layout обложки по указанным отступам

**Файл:** `supabase/functions/generate-cover/index.ts` — функция `composeCover` (строки 94–221)

### Что меняем

Текущий layout: flex-column с центрированным текстом и фото внизу слева.  
Новый layout (по картинке): абсолютное позиционирование элементов на канвасе 1080×1920.

| Элемент | Позиция | Размер |
|---------|---------|--------|
| Фото советника | `top: 100, left: 100` | `350 × 618`, `borderRadius: 24`, белая рамка |
| Имя советника | Под фото, `marginTop: 12`, `paddingLeft: 8` | `fontSize: 32` |
| Текст хука | `top: 750`, центр по ширине, `padding: 0 60px` | `fontSize: 48–64` (адаптивно по длине) |
| Градиент | Лёгкий сверху, усиленный к низу (для читаемости текста) | — |

### Технические детали

Заменяем `flex` layout в `composeCover` на `position: absolute` для каждого элемента:

```
// Advisor photo — absolute
top: 100, left: 100, width: 350, height: 618
borderRadius: 24, border: '4px solid rgba(255,255,255,0.8)'

// Advisor name — below photo
fontSize: 32, fontWeight: 600, marginTop: 12

// Hook text — absolute
top: 750, left: 0, width: '100%', centered
fontSize: adaptive (48/56/64), fontWeight: 800

// Gradient — softer, stronger at bottom
linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, ... rgba(0,0,0,0.55) 100%)
```

Остальной код функции (загрузка, upload, Step 1) не меняется.

