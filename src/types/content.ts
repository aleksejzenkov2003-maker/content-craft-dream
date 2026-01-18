export type ContentSource = 'youtube' | 'telegram' | 'instagram' | 'web';

export type ContentStatus = 'pending' | 'parsed' | 'rewritten' | 'video_created' | 'published' | 'failed';

export type VideoStatus = 'pending' | 'voiceover' | 'generating' | 'editing' | 'ready' | 'published' | 'failed';

export interface Channel {
  id: string;
  name: string;
  source: ContentSource;
  url: string;
  rssUrl?: string;
  isActive: boolean;
  lastParsed?: Date;
  postsCount: number;
}

export interface ParsedContent {
  id: string;
  channelId?: string;
  channelName: string;
  source: ContentSource;
  title: string;
  description: string;
  url: string;
  thumbnail?: string;
  publishedAt: Date;
  parsedAt: Date;
  status: ContentStatus;
  videoId?: string;
  engagementScore?: number;
  tags?: string[];
  isSelected?: boolean;
  metrics?: {
    views: number;
    likes: number;
    comments: number;
  };
}

export interface RewrittenContent {
  id: string;
  originalContentId: string;
  viralHeadline: string;
  videoScript: string;
  hook: string;
  mainStory: string;
  impact: string;
  cta: string;
  emotionTrigger?: string;
  tone: 'educational' | 'optimistic' | 'inspiring' | 'dramatic';
  createdAt: Date;
}

export interface VideoProject {
  id: string;
  title: string;
  status: VideoStatus;
  progress: number;
  thumbnail?: string;
  duration?: string;
  createdAt: Date;
  rewrittenContentId?: string;
  voiceoverUrl?: string;
  heygenVideoId?: string;
  heygenVideoUrl?: string;
  finalVideoUrl?: string;
  avatarId?: string;
  voiceId?: string;
  errorMessage?: string;
  submagicProjectId?: string;
  submagicVideoUrl?: string;
  isEdited?: boolean;
}

export interface PipelineStats {
  totalChannels: number;
  activeChannels: number;
  parsedToday: number;
  rewrittenToday: number;
  videosToday: number;
  publishedToday: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}
