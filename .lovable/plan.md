

## Добавить структуру полей и настройку маппинга во все CSV-импорты

### Что будет сделано

Перед загрузкой файла в каждом диалоге импорта будет показана **структура ожидаемых полей** (какие колонки система распознает и какие из них обязательные). После загрузки файла пользователь сможет **вручную настроить маппинг** -- переназначить колонку CSV на нужное поле через выпадающий список.

### Изменения

**1. Новый компонент: `FieldStructureInfo`** (`src/components/import/FieldStructureInfo.tsx`)
- Отображает таблицу-справку всех полей, которые система ожидает для данного типа импорта
- Для каждого поля показывает: имя поля, примеры допустимых заголовков CSV, пометку "обязательное" если применимо
- Показывается в диалоге импорта **до загрузки файла** (в зоне drag-and-drop)

**2. Новый компонент: `ColumnMappingEditor`** (`src/components/import/ColumnMappingEditor.tsx`)
- Показывается **после загрузки файла**, заменяет текущий блок "Показать все колонки"
- Для каждой колонки CSV показывает выпадающий Select с вариантами полей
- Автоматически заполненные маппинги подсвечены зеленым, нераспознанные -- пустые
- Пользователь может вручную изменить маппинг любой колонки
- Кнопка "Пересчитать" перестраивает данные предпросмотра по новому маппингу

**3. Обновление `importConfigs.ts`**
- Добавить структуру `FieldDefinition` для каждого типа импорта:
  ```
  { field: 'video_number', label: '№ ролика', aliases: ['id ролика', '# id ролика', ...], required: true }
  ```
- Экспортировать `VIDEO_FIELD_DEFINITIONS`, `ADVISOR_FIELD_DEFINITIONS`, `CHANNEL_FIELD_DEFINITIONS` и т.д. для всех 7 типов

**4. Обновление `CsvImporter.tsx`**
- Новый проп `fieldDefinitions` -- массив описаний полей
- До загрузки файла: рядом с зоной drag-and-drop показывать `FieldStructureInfo`
- После загрузки: вместо `<details>` блока показывать `ColumnMappingEditor`
- При изменении маппинга пользователем -- пересчитывать `resolvedRows`

**5. Обновление всех 7 мест использования импортера**
- `AdvisorsGrid.tsx` -- добавить `fieldDefinitions={ADVISOR_FIELD_DEFINITIONS}`
- `PlaylistsGrid.tsx` -- добавить `fieldDefinitions={PLAYLIST_FIELD_DEFINITIONS}`
- `PublishingChannelsGrid.tsx` -- добавить `fieldDefinitions={CHANNEL_FIELD_DEFINITIONS}`
- `QuestionsTable.tsx` -- добавить `fieldDefinitions={VIDEO_FIELD_DEFINITIONS}`
- `PublicationsTable.tsx` -- добавить `fieldDefinitions={PUBLICATION_FIELD_DEFINITIONS}`
- `ScenesMatrix.tsx` -- добавить `fieldDefinitions={SCENE_FIELD_DEFINITIONS}`
- `BackCoversGrid.tsx` -- добавить `fieldDefinitions={BACK_COVER_VIDEO_FIELD_DEFINITIONS}`

### Техническая структура

```text
FieldDefinition {
  field: string          -- имя поля в системе (например 'video_number')
  label: string          -- отображаемое имя ('№ ролика')
  aliases: string[]      -- все варианты заголовков CSV
  required?: boolean     -- обязательное поле
  description?: string   -- подсказка
}
```

Логика работы:
1. При открытии диалога показывается зона загрузки + список ожидаемых полей
2. После загрузки файла автоматический маппинг работает как раньше
3. Пользователь видит таблицу "Колонка CSV -> Поле системы" с возможностью менять через Select
4. При изменении маппинга данные пересчитываются и таблица предпросмотра обновляется

