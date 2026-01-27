
# План: Универсальный CSV-импортер с превью для всех страниц

## Обзор

Создание переиспользуемого компонента загрузки CSV/Excel с предпросмотром данных, который можно интегрировать на каждой странице приложения с настраиваемыми маппингами полей.

---

## Часть 1: Универсальный компонент CsvImporter

### 1.1 Новый файл: `src/components/import/CsvImporter.tsx`

Переиспользуемый компонент с параметрами:
- `entityType` — тип сущности (videos, advisors, playlists, scenes, channels, publications)
- `columnMapping` — карта соответствия CSV-колонок и полей БД
- `onImport` — callback для импорта данных
- `onValidate` — опциональная валидация строки
- `lookups` — справочники для связанных данных (advisors, playlists, channels)

```typescript
interface CsvImporterProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  columnMapping: Record<string, keyof T>;
  onImport: (data: Partial<T>[]) => Promise<void>;
  onValidate?: (row: Partial<T>) => { valid: boolean; errors: string[] };
  lookups?: {
    advisors?: Advisor[];
    playlists?: Playlist[];
    channels?: PublishingChannel[];
  };
  previewColumns: { key: keyof T; label: string; render?: (value: any, row: T) => React.ReactNode }[];
}
```

### 1.2 Логика парсинга CSV (из existing VideoImportDialog)

- Определение разделителя (`,`, `;`, `\t`)
- Парсинг с учетом кавычек
- Нормализация заголовков
- Автоматический маппинг колонок

```typescript
function parseCSVLine(line: string, delimiter = ','): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // удаление диакритики
}
```

### 1.3 UI компонента

```text
┌────────────────────────────────────────────────────────────────┐
│ 📄 Импорт [entity] из CSV/Excel                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │          📤 Перетащите файл сюда                        │  │
│  │              или нажмите для выбора                      │  │
│  │                                                          │  │
│  │          Поддерживаемые форматы: CSV, XLS, XLSX          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ После загрузки:                                                │
│                                                                │
│  📁 filename.csv        │ 50 строк │ ✅ 48 готово │ ⚠️ 2 ошибки │
│                                    [Выбрать другой файл]       │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ # │ Колонка 1  │ Колонка 2  │ Колонка 3  │ Статус        │  │
│  ├───┼────────────┼────────────┼────────────┼───────────────┤  │
│  │ 1 │ Значение   │ Значение   │ Badge      │ ✅ OK         │  │
│  │ 2 │ Значение   │ Значение   │ Badge      │ ⚠️ Ошибка     │  │
│  │ …                                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│                         [Отмена]  [Импортировать 48 записей]   │
└────────────────────────────────────────────────────────────────┘
```

---

## Часть 2: Конфигурации для каждого типа данных

### 2.1 Новый файл: `src/components/import/importConfigs.ts`

Хранит маппинги и конфигурации превью для каждого типа сущности:

```typescript
// Ролики (Videos)
export const VIDEO_COLUMN_MAPPING = {
  'video_number': 'video_number',
  'номер': 'video_number',
  'id ролика': 'video_number',
  'духовник': 'advisor_name',
  'advisor': 'advisor_name',
  'плейлист': 'playlist_name',
  'playlist': 'playlist_name',
  'вопрос': 'question',
  'question': 'question',
  'безопасность': 'safety_score',
  'хук': 'hook',
  'ответ духовника': 'advisor_answer',
  'озвучка': 'voiceover_url',
  // ... и т.д.
};

// Духовники (Advisors)
export const ADVISOR_COLUMN_MAPPING = {
  'name': 'name',
  'имя': 'name',
  'display_name': 'display_name',
  'отображаемое имя': 'display_name',
  'voice_id': 'elevenlabs_voice_id',
  // ...
};

// Плейлисты (Playlists)
export const PLAYLIST_COLUMN_MAPPING = {
  'name': 'name',
  'название': 'name',
  'description': 'description',
  'описание': 'description',
  'scene_prompt': 'scene_prompt',
  // ...
};

// Каналы публикации (Publishing Channels)
export const CHANNEL_COLUMN_MAPPING = {
  'network name': 'name',
  'название': 'name',
  'social network type': 'network_type',
  'тип сети': 'network_type',
  'proxy server': 'proxy_server',
  'прокси': 'proxy_server',
  'location': 'location',
  'локация': 'location',
  'prompt': 'post_text_prompt',
  // ...
};

// Публикации (Publications)
export const PUBLICATION_COLUMN_MAPPING = {
  'id ролика': 'video_number',
  'video_id': 'video_number',
  'канал': 'channel_name',
  'channel': 'channel_name',
  'post date': 'post_date',
  'дата': 'post_date',
  'status': 'publication_status',
  'статус': 'publication_status',
  // ...
};

// Сцены (Playlist Scenes)
export const SCENE_COLUMN_MAPPING = {
  'духовник': 'advisor_name',
  'плейлист': 'playlist_name',
  'промт': 'scene_prompt',
  'scene_prompt': 'scene_prompt',
  'фото': 'scene_url',
  'scene_url': 'scene_url',
  'статус': 'status',
  'review_status': 'review_status',
  // ...
};
```

---

## Часть 3: Интеграция на страницы

### 3.1 Обновить компоненты страниц

Каждая страница получает кнопку "Импорт CSV" и подключенный CsvImporter:

**Духовники (`AdvisorsGrid.tsx`):**
```tsx
<Button onClick={() => setShowImporter(true)}>
  <Upload className="w-4 h-4 mr-2" />
  Импорт CSV
</Button>

<CsvImporter
  open={showImporter}
  onClose={() => setShowImporter(false)}
  title="Импорт духовников"
  columnMapping={ADVISOR_COLUMN_MAPPING}
  onImport={bulkImportAdvisors}
  previewColumns={[
    { key: 'name', label: 'Имя' },
    { key: 'display_name', label: 'Отображаемое имя' },
  ]}
/>
```

**Плейлисты (`PlaylistsGrid.tsx`):**
- Кнопка "Импорт CSV"
- CsvImporter с PLAYLIST_COLUMN_MAPPING

**Каналы (`PublishingChannelsGrid.tsx`):**
- Кнопка "Импорт CSV"
- CsvImporter с CHANNEL_COLUMN_MAPPING

**Публикации (`PublicationsTable.tsx`):**
- Кнопка "Импорт CSV"
- CsvImporter с PUBLICATION_COLUMN_MAPPING
- Лукап: channels, videos

**Сцены (`ScenesMatrix.tsx`):**
- Кнопка "Импорт CSV"
- CsvImporter с SCENE_COLUMN_MAPPING
- Лукап: advisors, playlists

**Вопросы (`QuestionsTable.tsx`):**
- Кнопка "Импорт CSV"
- CsvImporter с VIDEO_COLUMN_MAPPING (импорт как видео с вопросами)

---

## Часть 4: Добавление bulkImport в хуки

### 4.1 `useAdvisors.ts` — добавить `bulkImport`

```typescript
const bulkImport = async (advisors: Partial<Advisor>[]) => {
  const { error } = await supabase
    .from('advisors')
    .upsert(advisors, { onConflict: 'name' });
  
  if (error) throw error;
  await fetchAdvisors();
  toast.success(`Импортировано ${advisors.length} духовников`);
};
```

### 4.2 `usePlaylists.ts` — добавить `bulkImport`

```typescript
const bulkImport = async (playlists: Partial<Playlist>[]) => {
  const { error } = await supabase
    .from('playlists')
    .upsert(playlists, { onConflict: 'name' });
  
  if (error) throw error;
  await fetchPlaylists();
  toast.success(`Импортировано ${playlists.length} плейлистов`);
};
```

### 4.3 `usePublishingChannels.ts` — добавить `bulkImport`

```typescript
const bulkImport = async (channels: Partial<PublishingChannel>[]) => {
  const { error } = await supabase
    .from('publishing_channels')
    .upsert(channels, { onConflict: 'name' });
  
  if (error) throw error;
  await fetchChannels();
  toast.success(`Импортировано ${channels.length} каналов`);
};
```

### 4.4 `usePublications.ts` — добавить `bulkImport`

```typescript
const bulkImport = async (publications: Partial<Publication>[]) => {
  const { error } = await supabase
    .from('publications')
    .insert(publications);
  
  if (error) throw error;
  await fetchPublications();
  toast.success(`Импортировано ${publications.length} публикаций`);
};
```

### 4.5 `usePlaylistScenes.ts` — добавить `bulkImport`

```typescript
const bulkImport = async (scenes: Partial<PlaylistScene>[]) => {
  const { error } = await supabase
    .from('playlist_scenes')
    .upsert(scenes, { onConflict: 'playlist_id,advisor_id' });
  
  if (error) throw error;
  await refetch();
  toast.success(`Импортировано ${scenes.length} сцен`);
};
```

---

## Структура файлов

### Новые файлы:
```
src/components/import/
├── CsvImporter.tsx          # Универсальный компонент
├── importConfigs.ts         # Маппинги колонок
└── csvUtils.ts              # Утилиты парсинга CSV
```

### Обновляемые файлы:
```
src/hooks/
├── useAdvisors.ts           # + bulkImport
├── usePlaylists.ts          # + bulkImport  
├── usePublishingChannels.ts # + bulkImport
├── usePublications.ts       # + bulkImport
└── usePlaylistScenes.ts     # + bulkImport

src/components/
├── advisors/AdvisorsGrid.tsx
├── playlists/PlaylistsGrid.tsx
├── publishing/PublishingChannelsGrid.tsx
├── publishing/PublicationsTable.tsx
├── scenes/ScenesMatrix.tsx
└── questions/QuestionsTable.tsx
```

---

## Порядок реализации

1. **Создать утилиты парсинга CSV** (`csvUtils.ts`)
2. **Создать конфигурации маппингов** (`importConfigs.ts`)
3. **Создать универсальный CsvImporter** (`CsvImporter.tsx`)
4. **Добавить bulkImport в хуки** (advisors, playlists, channels, publications, scenes)
5. **Интегрировать на страницы**:
   - AdvisorsGrid
   - PlaylistsGrid
   - PublishingChannelsGrid
   - PublicationsTable
   - ScenesMatrix
   - QuestionsTable

---

## Технические детали

### Валидация при импорте

Каждый тип данных имеет свою валидацию:

- **Advisors**: проверка уникальности имени
- **Playlists**: проверка уникальности названия
- **Videos**: маппинг advisor_name → advisor_id, playlist_name → playlist_id
- **Publications**: маппинг video_number → video_id, channel_name → channel_id
- **Scenes**: маппинг advisor + playlist, проверка существования

### Обработка связей

```typescript
// Пример резолвинга связей для публикаций
const resolvePublicationRow = (row: ParsedRow, lookups: Lookups) => {
  const video = lookups.videos?.find(v => v.video_number === row.video_number);
  const channel = lookups.channels?.find(c => 
    c.name.toLowerCase() === row.channel_name?.toLowerCase()
  );
  
  return {
    ...row,
    video_id: video?.id || null,
    channel_id: channel?.id || null,
    errors: [
      !video && row.video_number ? `Ролик #${row.video_number} не найден` : null,
      !channel && row.channel_name ? `Канал "${row.channel_name}" не найден` : null,
    ].filter(Boolean),
  };
};
```
