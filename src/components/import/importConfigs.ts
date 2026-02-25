// Column mappings for different entity types

export interface FieldDefinition {
  field: string;
  label: string;
  aliases: string[];
  required?: boolean;
  description?: string;
}

// =================== QUESTION Field Definitions & Mapping ===================

export const QUESTION_COLUMN_MAPPING: Record<string, string> = {
  'id вопроса': 'question_id',
  'question id': 'question_id',
  'id': 'question_id',

  'planned publication date': 'publication_date',
  'дата публикации': 'publication_date',
  'плановая дата публикации': 'publication_date',
  'publication date': 'publication_date',

  'безопасность вопроса': 'safety_score',
  'безопасность': 'safety_score',
  'safety': 'safety_score',
  'safety score': 'safety_score',

  'хук рус': 'hook_rus',
  'hook rus': 'hook_rus',

  'вопрос к духовнику рус': 'question_rus',
  'вопрос рус': 'question_rus',
  'question rus': 'question_rus',

  'плейлист рус': 'playlist_rus',
  'playlist rus': 'playlist_rus',

  'хук eng': 'hook',
  'хук': 'hook',
  'hook eng': 'hook',
  'hook': 'hook',

  'вопрос к духовнику eng': 'question',
  'вопрос к духовнику': 'question',
  'вопрос eng': 'question',
  'вопрос': 'question',
  'question eng': 'question',
  'question': 'question',

  'плейлист eng': 'playlist_name',
  'плейлист': 'playlist_name',
  'playlist': 'playlist_name',
  'playlist eng': 'playlist_name',

  'статус вопроса': 'question_status',
  'статус': 'question_status',
  'status': 'question_status',

  'актуальность': 'relevance_score',
  'relevance': 'relevance_score',
  'relevance score': 'relevance_score',
};

export const QUESTION_FIELD_DEFINITIONS: FieldDefinition[] = [
  { field: 'question_id', label: 'ID Вопроса', aliases: ['id вопроса', 'question id', 'id'], required: true },
  { field: 'publication_date', label: 'Плановая дата публикации', aliases: ['planned publication date', 'дата публикации', 'плановая дата публикации'] },
  { field: 'safety_score', label: 'Безопасность вопроса', aliases: ['безопасность вопроса', 'безопасность', 'safety'] },
  { field: 'hook_rus', label: 'Хук рус', aliases: ['хук рус', 'hook rus'] },
  { field: 'question_rus', label: 'Вопрос к духовнику рус', aliases: ['вопрос к духовнику рус', 'вопрос рус'] },
  { field: 'playlist_rus', label: 'Плейлист рус', aliases: ['плейлист рус', 'playlist rus'] },
  { field: 'hook', label: 'Хук eng', aliases: ['хук eng', 'хук', 'hook eng', 'hook'] },
  { field: 'question', label: 'Вопрос к духовнику eng', aliases: ['вопрос к духовнику eng', 'вопрос', 'question'] },
  { field: 'playlist_name', label: 'Плейлист eng', aliases: ['плейлист eng', 'плейлист', 'playlist'] },
  { field: 'question_status', label: 'Статус вопроса', aliases: ['статус вопроса', 'статус', 'status'] },
  { field: 'relevance_score', label: 'Актуальность', aliases: ['актуальность', 'relevance'] },
];

export const QUESTION_PREVIEW_COLUMNS = [
  { key: 'question_id', label: 'ID' },
  { key: 'question_rus', label: 'Вопрос (рус)' },
  { key: 'question', label: 'Вопрос (eng)' },
  { key: 'safety_score', label: 'Безопасность' },
  { key: 'relevance_score', label: 'Актуальность' },
];

// =================== VIDEO (Ролики) Field Definitions & Mapping ===================

export const VIDEO_COLUMN_MAPPING: Record<string, string> = {
  'id ролика': 'video_number',
  'video_number': 'video_number',
  'номер': 'video_number',
  'video number': 'video_number',
  'video id': 'video_number',
  '# id ролика': 'video_number',

  'id вопроса': 'question_id',
  'question id': 'question_id',

  'духовник': 'advisor_name',
  'advisor': 'advisor_name',
  'advisor name': 'advisor_name',
  '≡ духовник': 'advisor_name',

  'вопрос': 'question',
  'question': 'question',
  'вопрос к духовнику': 'question',
  'вопрос к духовнику eng': 'question',
  'question eng': 'question',

  'ответ духовника': 'advisor_answer',
  'advisor answer': 'advisor_answer',
  'ответ': 'advisor_answer',
  'answer': 'advisor_answer',
  '≡ ответ духовника': 'advisor_answer',

  'хук': 'hook',
  'hook': 'hook',
  'хук eng': 'hook',
  'хук англ': 'hook',
  'hook eng': 'hook',

  'плейлист': 'playlist_name',
  'playlist': 'playlist_name',
  'playlist name': 'playlist_name',
  'плейлист eng': 'playlist_name',
  'плейлист англ': 'playlist_name',
  '≡ плейлист': 'playlist_name',

  'безопасность': 'safety_score',
  'безопасность вопроса': 'safety_score',
  'safety': 'safety_score',
  'safety score': 'safety_score',

  'заголовок видео': 'video_title',
  'video title': 'video_title',
  'title': 'video_title',

  'video': 'heygen_video_url',
  'video url': 'heygen_video_url',
  'video (url)': 'heygen_video_url',
  '⚙ video (url)': 'heygen_video_url',
  'heygen video': 'heygen_video_url',

  'front cover (url)': 'front_cover_url',
  'front cover url': 'front_cover_url',
  'обложка url': 'front_cover_url',

  'cover status': 'cover_status',
  'статус обложки': 'cover_status',

  'video status': 'generation_status',
  'статус видео': 'generation_status',
  'статус': 'generation_status',
  '⊙ video status': 'generation_status',

  'длина ролика': 'video_duration',
  'video duration': 'video_duration',
  'duration': 'video_duration',

  'статус вопроса': 'question_status',
  'question status': 'question_status',

  'planned publication date': 'publication_date',
  'плановая дата публикации': 'publication_date',
  'дата публикации': 'publication_date',
  'publication date': 'publication_date',

  'каналы публикаций': 'selected_channels',
  'каналы': 'selected_channels',
  'channels': 'selected_channels',

  'озвучка': 'voiceover_url',
  'voiceover': 'voiceover_url',
  'voiceover url': 'voiceover_url',
  'audio': 'voiceover_url',
  'a озвучка': 'voiceover_url',
  'voice': 'voiceover_url',

  'heygen_id': 'heygen_video_id',
  'heygen id': 'heygen_video_id',
  'a heygen_id': 'heygen_video_id',

  'вопрос рус': 'question_rus',
  'вопрос к духовнику рус': 'question_rus',
  'question rus': 'question_rus',

  'хук рус': 'hook_rus',
  'hook rus': 'hook_rus',

  'актуальность': 'relevance_score',
  'relevance': 'relevance_score',
  'relevance score': 'relevance_score',

  'безоп': 'safety_score',
  'a безоп': 'safety_score',
};

export const VIDEO_FIELD_DEFINITIONS: FieldDefinition[] = [
  { field: 'video_number', label: 'ID Ролика', aliases: ['id ролика', '# id ролика', 'video_number'], required: true },
  { field: 'question_id', label: 'ID Вопроса', aliases: ['id вопроса', 'question id'], description: 'Связь с таблицей Вопросы' },
  { field: 'advisor_name', label: 'Духовник', aliases: ['духовник', '≡ духовник', 'advisor'] },
  { field: 'question', label: 'Вопрос', aliases: ['вопрос', 'вопрос к духовнику eng', 'question'] },
  { field: 'advisor_answer', label: 'Ответ духовника', aliases: ['ответ духовника', '≡ ответ духовника', 'answer'] },
  { field: 'hook', label: 'Хук англ', aliases: ['хук', 'хук англ', 'hook eng', 'hook'] },
  { field: 'playlist_name', label: 'Плейлист англ', aliases: ['плейлист', 'плейлист англ', 'playlist'], description: 'Связь с таблицей Плейлисты' },
  { field: 'safety_score', label: 'Безопасность вопроса', aliases: ['безопасность', 'безопасность вопроса', 'safety'] },
  { field: 'video_title', label: 'Заголовок видео', aliases: ['заголовок видео', 'video title', 'title'] },
  { field: 'heygen_video_url', label: 'Video (URL)', aliases: ['video', 'video (url)', '⚙ video (url)'], description: 'Ссылка на сгенерированное видео' },
  { field: 'front_cover_url', label: 'Front cover (URL)', aliases: ['front cover (url)', 'front cover url', 'обложка url'] },
  { field: 'cover_status', label: 'Cover status', aliases: ['cover status', 'статус обложки'] },
  { field: 'generation_status', label: 'Video status', aliases: ['video status', '⊙ video status', 'статус видео'] },
  { field: 'video_duration', label: 'Длина ролика', aliases: ['длина ролика', 'video duration', 'duration'], description: 'Продолжительность в секундах' },
  { field: 'question_status', label: 'Статус вопроса', aliases: ['статус вопроса', 'question status'] },
  { field: 'publication_date', label: 'Плановая дата публикации', aliases: ['planned publication date', 'плановая дата публикации', 'дата публикации'] },
  { field: 'selected_channels', label: 'Каналы публикаций', aliases: ['каналы публикаций', 'каналы', 'channels'] },
  { field: 'voiceover_url', label: 'Озвучка', aliases: ['озвучка', 'a озвучка', 'voiceover'], description: 'URL озвучки' },
  { field: 'heygen_video_id', label: 'HeyGen ID', aliases: ['heygen_id', 'a heygen_id', 'heygen id'] },
  { field: 'question_rus', label: 'Вопрос (рус)', aliases: ['вопрос рус', 'вопрос к духовнику рус'] },
  { field: 'hook_rus', label: 'Хук (рус)', aliases: ['хук рус', 'hook rus'] },
  { field: 'relevance_score', label: 'Актуальность', aliases: ['актуальность', 'relevance'] },
];

export const VIDEO_PREVIEW_COLUMNS = [
  { key: 'video_number', label: '№' },
  { key: 'advisor_name', label: 'Духовник' },
  { key: 'playlist_name', label: 'Плейлист' },
  { key: 'question', label: 'Вопрос' },
  { key: 'safety_score', label: 'Безопасность' },
];

// =================== Other entity configs ===================

// Advisors
export const ADVISOR_COLUMN_MAPPING: Record<string, string> = {
  'name': 'name',
  'имя': 'name',
  'название': 'name',
  'advisor': 'name',
  'духовник': 'name',
  'display_name': 'display_name',
  'отображаемое имя': 'display_name',
  'display name': 'display_name',
  'voice_id': 'elevenlabs_voice_id',
  'elevenlabs_voice_id': 'elevenlabs_voice_id',
  'elevenlabs voice id': 'elevenlabs_voice_id',
  'speech_speed': 'speech_speed',
  'скорость речи': 'speech_speed',
  'speed': 'speech_speed',
  'active': 'is_active',
  'is_active': 'is_active',
  'активен': 'is_active',
};

// Playlists
export const PLAYLIST_COLUMN_MAPPING: Record<string, string> = {
  'name': 'name',
  'название': 'name',
  'playlist': 'name',
  'плейлист': 'name',
  'description': 'description',
  'описание': 'description',
  'scene_prompt': 'scene_prompt',
  'промт для сцены': 'scene_prompt',
  'scene prompt': 'scene_prompt',
};

// Publishing Channels
export const CHANNEL_COLUMN_MAPPING: Record<string, string> = {
  'name': 'name',
  'network name': 'name',
  'название': 'name',
  'channel': 'name',
  'канал': 'name',
  'network_type': 'network_type',
  'social network type': 'network_type',
  'тип сети': 'network_type',
  'network': 'network_type',
  'сеть': 'network_type',
  'proxy_server': 'proxy_server',
  'proxy server': 'proxy_server',
  'прокси': 'proxy_server',
  'proxy': 'proxy_server',
  'location': 'location',
  'локация': 'location',
  'расположение': 'location',
  'post_text_prompt': 'post_text_prompt',
  'prompt': 'post_text_prompt',
  'промт': 'post_text_prompt',
  'prompt для публикации': 'post_text_prompt',
  'is_active': 'is_active',
  'active': 'is_active',
  'активен': 'is_active',
};

// Publications
export const PUBLICATION_COLUMN_MAPPING: Record<string, string> = {
  'post id': 'id',
  'post_id': 'id',
  'video_number': 'video_number',
  'id ролика': 'video_number',
  'video id': 'video_number',
  'номер ролика': 'video_number',
  'channel_name': 'channel_name',
  'канал': 'channel_name',
  'каналы публикаций': 'channel_name',
  'channel': 'channel_name',
  'post_date': 'post_date',
  'post date': 'post_date',
  'дата': 'post_date',
  'дата публикации': 'post_date',
  'publication_status': 'publication_status',
  'status': 'publication_status',
  'статус': 'publication_status',
  'post_url': 'post_url',
  'post url': 'post_url',
  'ссылка': 'post_url',
  'network': 'network_type',
  'сеть': 'network_type',
  'text': 'generated_text',
  'текст': 'generated_text',
  'generated_text': 'generated_text',
  'заголовок публикации': 'title',
  'title': 'title',
  'хук': 'hook',
  'hook': 'hook',
  'духовник': 'advisor_name',
  'advisor': 'advisor_name',
  'id вопроса': 'question_id',
  'question id': 'question_id',
};

// Playlist Scenes
export const SCENE_COLUMN_MAPPING: Record<string, string> = {
  'сцена': 'scene_name',
  'scene': 'scene_name',
  'scene_name': 'scene_name',
  'advisor_name': 'advisor_name',
  'духовник': 'advisor_name',
  'advisor': 'advisor_name',
  'playlist_name': 'playlist_name',
  'плейлист': 'playlist_name',
  'playlist': 'playlist_name',
  'scene_prompt': 'scene_prompt',
  'промт для сцены': 'scene_prompt',
  'промт': 'scene_prompt',
  'prompt': 'scene_prompt',
  'scene_url': 'scene_url',
  'фото сцены': 'scene_url',
  'фото': 'scene_url',
  'scene url': 'scene_url',
  'сцена url': 'scene_url',
  'status': 'status',
  'статус': 'status',
  'review_status': 'review_status',
  'статус проверки': 'review_status',
  'review': 'review_status',
};

// Back Cover Videos
export const BACK_COVER_VIDEO_COLUMN_MAPPING: Record<string, string> = {
  'name': 'name',
  'название': 'name',
  'имя': 'name',
  'photo / video': 'back_cover_video_url',
  'photo/video': 'back_cover_video_url',
  'video': 'back_cover_video_url',
  'видео': 'back_cover_video_url',
  'video url': 'back_cover_video_url',
  'url видео': 'back_cover_video_url',
  'back cover video': 'back_cover_video_url',
  'задняя обложка видео': 'back_cover_video_url',
  'каналы публикаций': 'channel_names',
  'каналы': 'channel_names',
  'channels': 'channel_names',
  'publishing channels': 'channel_names',
  'комментарий': 'comment',
  'comment': 'comment',
};

// =================== Preview Columns ===================

export const ADVISOR_PREVIEW_COLUMNS = [
  { key: 'name', label: 'Имя' },
  { key: 'display_name', label: 'Отображаемое имя' },
  { key: 'elevenlabs_voice_id', label: 'Voice ID' },
];

export const PLAYLIST_PREVIEW_COLUMNS = [
  { key: 'name', label: 'Название' },
  { key: 'description', label: 'Описание' },
  { key: 'scene_prompt', label: 'Промт для сцены' },
];

export const CHANNEL_PREVIEW_COLUMNS = [
  { key: 'name', label: 'Название' },
  { key: 'network_type', label: 'Тип сети' },
  { key: 'location', label: 'Локация' },
];

export const PUBLICATION_PREVIEW_COLUMNS = [
  { key: 'video_number', label: 'ID Ролика' },
  { key: 'channel_name', label: 'Канал' },
  { key: 'post_date', label: 'Дата' },
  { key: 'publication_status', label: 'Статус' },
];

export const SCENE_PREVIEW_COLUMNS = [
  { key: 'advisor_name', label: 'Духовник' },
  { key: 'playlist_name', label: 'Плейлист' },
  { key: 'scene_prompt', label: 'Промт' },
  { key: 'review_status', label: 'Статус проверки' },
];

export const BACK_COVER_VIDEO_PREVIEW_COLUMNS = [
  { key: 'name', label: 'Название' },
  { key: 'back_cover_video_url', label: 'Видео URL' },
  { key: 'channel_names', label: 'Каналы' },
];

// =================== Field Definitions ===================

export const ADVISOR_FIELD_DEFINITIONS: FieldDefinition[] = [
  { field: 'name', label: 'Имя', aliases: ['name', 'имя', 'духовник', 'advisor'], required: true },
  { field: 'display_name', label: 'Отображаемое имя', aliases: ['display_name', 'отображаемое имя', 'display name'] },
  { field: 'elevenlabs_voice_id', label: 'Voice ID', aliases: ['voice_id', 'elevenlabs_voice_id'] },
  { field: 'speech_speed', label: 'Скорость речи', aliases: ['speech_speed', 'скорость речи', 'speed'] },
  { field: 'is_active', label: 'Активен', aliases: ['active', 'is_active', 'активен'] },
];

export const PLAYLIST_FIELD_DEFINITIONS: FieldDefinition[] = [
  { field: 'name', label: 'Название', aliases: ['name', 'название', 'плейлист', 'playlist'], required: true },
  { field: 'description', label: 'Описание', aliases: ['description', 'описание'] },
  { field: 'scene_prompt', label: 'Промт для сцены', aliases: ['scene_prompt', 'промт для сцены', 'scene prompt'] },
];

export const CHANNEL_FIELD_DEFINITIONS: FieldDefinition[] = [
  { field: 'name', label: 'Название', aliases: ['name', 'network name', 'канал'], required: true },
  { field: 'network_type', label: 'Тип сети', aliases: ['network_type', 'social network type', 'сеть'], required: true },
  { field: 'proxy_server', label: 'Прокси', aliases: ['proxy_server', 'proxy server', 'прокси'] },
  { field: 'location', label: 'Локация', aliases: ['location', 'локация'] },
  { field: 'post_text_prompt', label: 'Промт для поста', aliases: ['post_text_prompt', 'prompt', 'промт'] },
  { field: 'is_active', label: 'Активен', aliases: ['is_active', 'active', 'активен'] },
];

export const PUBLICATION_FIELD_DEFINITIONS: FieldDefinition[] = [
  { field: 'video_number', label: 'ID Ролика', aliases: ['video_number', 'id ролика', 'video id'] },
  { field: 'channel_name', label: 'Канал', aliases: ['channel_name', 'канал', 'каналы публикаций'] },
  { field: 'post_date', label: 'Дата', aliases: ['post_date', 'post date', 'дата', 'дата публикации'] },
  { field: 'publication_status', label: 'Статус', aliases: ['publication_status', 'status', 'статус'] },
  { field: 'post_url', label: 'Ссылка', aliases: ['post_url', 'post url', 'ссылка'] },
  { field: 'generated_text', label: 'Текст', aliases: ['text', 'текст', 'generated_text'] },
  { field: 'title', label: 'Заголовок', aliases: ['заголовок публикации', 'title'] },
  { field: 'hook', label: 'Хук', aliases: ['хук', 'hook'] },
  { field: 'advisor_name', label: 'Духовник', aliases: ['духовник', 'advisor'] },
  { field: 'question_id', label: 'ID вопроса', aliases: ['id вопроса', 'question id'] },
];

export const SCENE_FIELD_DEFINITIONS: FieldDefinition[] = [
  { field: 'advisor_name', label: 'Духовник', aliases: ['advisor_name', 'духовник', 'advisor'], required: true },
  { field: 'playlist_name', label: 'Плейлист', aliases: ['playlist_name', 'плейлист', 'playlist'], required: true },
  { field: 'scene_prompt', label: 'Промт для сцены', aliases: ['scene_prompt', 'промт для сцены', 'промт'] },
  { field: 'scene_url', label: 'URL сцены', aliases: ['scene_url', 'фото сцены', 'scene url'] },
  { field: 'status', label: 'Статус', aliases: ['status', 'статус'] },
  { field: 'review_status', label: 'Статус проверки', aliases: ['review_status', 'статус проверки'] },
];

export const BACK_COVER_VIDEO_FIELD_DEFINITIONS: FieldDefinition[] = [
  { field: 'name', label: 'Название', aliases: ['name', 'название', 'имя'] },
  { field: 'back_cover_video_url', label: 'Видео URL', aliases: ['photo / video', 'photo/video', 'video', 'видео', 'video url'] },
  { field: 'channel_names', label: 'Каналы', aliases: ['каналы публикаций', 'каналы', 'channels'] },
  { field: 'comment', label: 'Комментарий', aliases: ['комментарий', 'comment'] },
];