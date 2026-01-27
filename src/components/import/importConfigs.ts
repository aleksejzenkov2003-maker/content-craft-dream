// Column mappings for different entity types

// Videos / Questions (from Аудио и видео.csv)
export const VIDEO_COLUMN_MAPPING: Record<string, string> = {
  // Video number/ID - exact matches from file
  'id ролика': 'video_number',
  'video_number': 'video_number',
  'номер': 'video_number',
  'video number': 'video_number',
  'video id': 'video_number',
  '# id ролика': 'video_number',
  
  // Advisor - exact matches
  'духовник': 'advisor_name',
  'advisor': 'advisor_name',
  'advisor name': 'advisor_name',
  '≡ духовник': 'advisor_name',
  
  // Playlist - exact matches
  'плейлист': 'playlist_name',
  'playlist': 'playlist_name',
  'playlist name': 'playlist_name',
  'плейлист eng': 'playlist_name',
  '≡ плейлист': 'playlist_name',
  
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
  
  // Safety - exact matches from file
  'безопасность': 'safety_score',
  'безопасность вопроса': 'safety_score',
  'safety': 'safety_score',
  'safety score': 'safety_score',
  'безоп': 'safety_score',
  'a безоп': 'safety_score',
  
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
  
  // Answer - exact matches from file
  'ответ духовника': 'advisor_answer',
  'advisor answer': 'advisor_answer',
  'ответ': 'advisor_answer',
  'answer': 'advisor_answer',
  '≡ ответ духовника': 'advisor_answer',
  
  // Voiceover - exact matches from file
  'озвучка': 'voiceover_url',
  'voiceover': 'voiceover_url',
  'voiceover url': 'voiceover_url',
  'audio': 'voiceover_url',
  'a озвучка': 'voiceover_url',
  'voice': 'voiceover_url',
  
  // Video URL - exact matches from file
  'video': 'heygen_video_url',
  'video url': 'heygen_video_url',
  'heygen video': 'heygen_video_url',
  'video (url)': 'heygen_video_url',
  '⚙ video (url)': 'heygen_video_url',
  
  // HeyGen ID - exact matches from file
  'heygen_id': 'heygen_video_id',
  'heygen id': 'heygen_video_id',
  'a heygen_id': 'heygen_video_id',
  
  // Status - exact matches from file
  'video status': 'generation_status',
  'статус видео': 'generation_status',
  'статус': 'generation_status',
  '⊙ video status': 'generation_status',
  
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

// Publishing Channels (from Grid view (4).csv)
export const CHANNEL_COLUMN_MAPPING: Record<string, string> = {
  // Name - exact matches from file
  'name': 'name',
  'network name': 'name',
  'название': 'name',
  'channel': 'name',
  'канал': 'name',
  
  // Network type - exact matches from file
  'network_type': 'network_type',
  'social network type': 'network_type',
  'тип сети': 'network_type',
  'network': 'network_type',
  'сеть': 'network_type',
  
  // Proxy server - exact matches from file
  'proxy_server': 'proxy_server',
  'proxy server': 'proxy_server',
  'прокси': 'proxy_server',
  'proxy': 'proxy_server',
  
  // Location
  'location': 'location',
  'локация': 'location',
  'расположение': 'location',
  
  // Post text prompt - exact matches from file
  'post_text_prompt': 'post_text_prompt',
  'prompt': 'post_text_prompt',
  'промт': 'post_text_prompt',
  'prompt для публикации': 'post_text_prompt',
  
  // Active status
  'is_active': 'is_active',
  'active': 'is_active',
  'активен': 'is_active',
};

// Publications (from Grid view (1).csv)
export const PUBLICATION_COLUMN_MAPPING: Record<string, string> = {
  // Post ID
  'post id': 'id',
  'post_id': 'id',
  
  // Video number - exact matches from file
  'video_number': 'video_number',
  'id ролика': 'video_number',
  'video id': 'video_number',
  'номер ролика': 'video_number',
  
  // Channel name - exact matches from file
  'channel_name': 'channel_name',
  'канал': 'channel_name',
  'каналы публикаций': 'channel_name',
  'channel': 'channel_name',
  
  // Post date - exact matches from file
  'post_date': 'post_date',
  'post date': 'post_date',
  'дата': 'post_date',
  'дата публикации': 'post_date',
  
  // Publication status - exact matches from file
  'publication_status': 'publication_status',
  'status': 'publication_status',
  'статус': 'publication_status',
  
  // Post URL
  'post_url': 'post_url',
  'post url': 'post_url',
  'ссылка': 'post_url',
  
  // Network type - exact matches from file
  'network': 'network_type',
  'сеть': 'network_type',
  
  // Generated text
  'text': 'generated_text',
  'текст': 'generated_text',
  'generated_text': 'generated_text',
  
  // Title
  'заголовок публикации': 'title',
  'title': 'title',
  
  // Hook
  'хук': 'hook',
  'hook': 'hook',
  
  // Advisor
  'духовник': 'advisor_name',
  'advisor': 'advisor_name',
  
  // Question ID
  'id вопроса': 'question_id',
  'question id': 'question_id',
};

// Playlist Scenes (from Grid view (2).csv)
export const SCENE_COLUMN_MAPPING: Record<string, string> = {
  // Scene name
  'сцена': 'scene_name',
  'scene': 'scene_name',
  'scene_name': 'scene_name',
  
  // Advisor - exact matches from file
  'advisor_name': 'advisor_name',
  'духовник': 'advisor_name',
  'advisor': 'advisor_name',
  
  // Playlist - exact matches from file
  'playlist_name': 'playlist_name',
  'плейлист': 'playlist_name',
  'playlist': 'playlist_name',
  
  // Scene prompt - exact matches from file
  'scene_prompt': 'scene_prompt',
  'промт для сцены': 'scene_prompt',
  'промт': 'scene_prompt',
  'prompt': 'scene_prompt',
  
  // Scene URL - exact matches from file
  'scene_url': 'scene_url',
  'фото сцены': 'scene_url',
  'фото': 'scene_url',
  'scene url': 'scene_url',
  'сцена url': 'scene_url',
  
  // Status - exact matches from file
  'status': 'status',
  'статус': 'status',
  
  // Review status - exact matches from file
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
