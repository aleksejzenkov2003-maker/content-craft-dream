// Column mappings for different entity types

// Videos / Questions
export const VIDEO_COLUMN_MAPPING: Record<string, string> = {
  // Video number/ID
  'video_number': 'video_number',
  'номер': 'video_number',
  'id ролика': 'video_number',
  'video number': 'video_number',
  'video id': 'video_number',
  
  // Advisor
  'духовник': 'advisor_name',
  'advisor': 'advisor_name',
  'advisor name': 'advisor_name',
  
  // Playlist
  'плейлист': 'playlist_name',
  'playlist': 'playlist_name',
  'playlist name': 'playlist_name',
  'плейлист eng': 'playlist_name',
  
  // Question
  'вопрос': 'question',
  'question': 'question',
  'вопрос к духовнику': 'question',
  'вопрос к духовнику eng': 'question',
  'question eng': 'question',
  
  // Question Russian
  'вопрос рус': 'question_rus',
  'вопрос к духовнику рус': 'question_rus',
  'question rus': 'question_rus',
  
  // Safety
  'безопасность': 'safety_score',
  'безопасность вопроса': 'safety_score',
  'safety': 'safety_score',
  'safety score': 'safety_score',
  
  // Relevance
  'актуальность': 'relevance_score',
  'relevance': 'relevance_score',
  'relevance score': 'relevance_score',
  
  // Hook
  'хук': 'hook',
  'hook': 'hook',
  'хук eng': 'hook',
  'hook eng': 'hook',
  
  // Hook Russian
  'хук рус': 'hook_rus',
  'hook rus': 'hook_rus',
  
  // Answer
  'ответ духовника': 'advisor_answer',
  'advisor answer': 'advisor_answer',
  'ответ': 'advisor_answer',
  'answer': 'advisor_answer',
  
  // Voiceover
  'озвучка': 'voiceover_url',
  'voiceover': 'voiceover_url',
  'voiceover url': 'voiceover_url',
  'audio': 'voiceover_url',
  
  // Video URL
  'video': 'heygen_video_url',
  'video url': 'heygen_video_url',
  'heygen video': 'heygen_video_url',
  
  // Status
  'video status': 'generation_status',
  'статус видео': 'generation_status',
  'статус': 'generation_status',
  
  // Publication date
  'planned publication date': 'publication_date',
  'дата публикации': 'publication_date',
  'publication date': 'publication_date',
  
  // Question ID
  'id вопроса': 'question_id',
  'question id': 'question_id',
};

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
};

// Playlist Scenes
export const SCENE_COLUMN_MAPPING: Record<string, string> = {
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
  'scene': 'scene_url',
  
  'status': 'status',
  'статус': 'status',
  
  'review_status': 'review_status',
  'статус проверки': 'review_status',
  'review': 'review_status',
};

// Preview column configurations
export interface PreviewColumn<T> {
  key: keyof T | string;
  label: string;
  render?: (value: any, row: Record<string, any>) => React.ReactNode;
}

export const VIDEO_PREVIEW_COLUMNS = [
  { key: 'video_number', label: '№' },
  { key: 'advisor_name', label: 'Духовник' },
  { key: 'playlist_name', label: 'Плейлист' },
  { key: 'question', label: 'Вопрос' },
  { key: 'safety_score', label: 'Безопасность' },
];

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
