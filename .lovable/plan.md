

## Унификация боковых панелей и модальных окон

### Текущие проблемы

Сейчас 4 панели/модалки используют разные подходы:

```text
Компонент               | Контейнер | Хедер              | Навигация | Футер    | Ширина
------------------------|-----------|--------------------|-----------|---------|---------
QuestionSidePanel       | Sheet     | SheetTitle         | Нет       | Кнопка  | 400-540px
SceneSidePanel          | Sheet     | sr-only title      | Нет       | Нет     | 420px
VideoSidePanel          | Dialog    | custom div+arrows  | ↑↓        | Нет     | 90vw
PublicationEditDialog   | Dialog    | custom div+arrows  | ↑↓        | Отмена/Сохранить | 90vw
VideoEditorDialog       | Dialog    | DialogHeader       | Нет       | Отмена/Сохранить | max-w-2xl
```

**Различия**: разные контейнеры (Sheet vs Dialog), разные хедеры, навигация (есть/нет), футер (есть/нет), кнопки разных размеров, стили Label/Input не унифицированы.

---

### План

#### 1. Создать общий компонент `UnifiedPanel`

Новый файл `src/components/ui/unified-panel.tsx` — обёртка поверх `Dialog`, предоставляющая единый шаблон:

- **Header**: стрелки ↑↓ (опциональные), заголовок по центру, доп. кнопки справа, крестик закрытия
- **Body**: `ScrollArea` с `p-4 space-y-4`
- **Footer**: `border-t`, кнопки «Отмена» + «Сохранить» (опциональные)
- **Props**: `title`, `open`, `onOpenChange`, `onPrev?`, `onNext?`, `footer?`, `width?` (sm/md/lg/xl), `children`

Все панели переводятся на `Dialog` (включая QuestionSidePanel и SceneSidePanel — с Sheet на Dialog) для единообразия.

#### 2. Стандартизировать внутренние элементы

- **Label+Input строка**: единый паттерн `grid grid-cols-[140px_1fr] gap-2 items-center` с `Label className="text-sm"` и `Input/Select className="h-8 text-sm"`
- **Секционные разделители**: `<Separator className="my-4" />` между блоками
- **Заголовки секций**: `<h4 className="font-medium text-sm flex items-center gap-1.5">`
- **Кнопки действий**: `size="sm"` + `variant="secondary"` для вторичных, `variant="default"` для основных
- **Badge**: единый стиль `variant="outline" className="text-xs"` для метаданных
- **Tabs**: единый `TabsList className="grid w-full grid-cols-N"` с `text-xs`

#### 3. Перевести каждую панель на `UnifiedPanel`

**QuestionSidePanel** (Sheet → Dialog):
- Обернуть в `UnifiedPanel` с `width="sm"`, добавить `onPrev/onNext` пропсы, унифицировать Label/Input стиль

**SceneSidePanel** (Sheet → Dialog):
- Обернуть в `UnifiedPanel` с `width="sm"`, добавить видимый заголовок

**VideoSidePanel** (уже Dialog):
- Заменить custom header на `UnifiedPanel` с `width="xl"`

**PublicationEditDialog** (уже Dialog):
- Заменить custom header/footer на `UnifiedPanel` с `width="lg"`

**VideoEditorDialog** (уже Dialog):
- Заменить `DialogContent/DialogHeader/DialogFooter` на `UnifiedPanel` с `width="md"`

#### 4. Файлы для изменения

- `src/components/ui/unified-panel.tsx` — **новый**
- `src/components/questions/QuestionSidePanel.tsx` — переделать
- `src/components/scenes/SceneSidePanel.tsx` — переделать
- `src/components/videos/VideoSidePanel.tsx` — переделать
- `src/components/publishing/PublicationEditDialog.tsx` — переделать
- `src/components/videos/VideoEditorDialog.tsx` — переделать

### Результат

Все 5 панелей/модалок будут выглядеть единообразно: одинаковый хедер со стрелками и крестиком, одинаковые стили полей, кнопок и разделителей, одинаковый футер с кнопками сохранения.

