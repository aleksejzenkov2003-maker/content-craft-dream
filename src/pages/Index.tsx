import { useState, useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { PipelineStatus } from '@/components/dashboard/PipelineStatus';
import { ContentList } from '@/components/dashboard/ContentList';
import { VideoCard } from '@/components/dashboard/VideoCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { PromptEditor } from '@/components/prompts/PromptEditor';
import { SourcesManager } from '@/components/sources/SourcesManager';
import { ContentTable } from '@/components/content/ContentTable';
import { StepDebugger } from '@/components/debug/StepDebugger';
import { ManualContentForm } from '@/components/content/ManualContentForm';
import { RewriteStudio } from '@/components/rewrite/RewriteStudio';
import { NewVideoDialog } from '@/components/video/NewVideoDialog';
import VoiceoverPage from '@/pages/VoiceoverPage';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Table, LayoutGrid, Loader2, Bug, Key } from 'lucide-react';
import {
  Rss,
  FileText,
  Video,
  Upload,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

import { useChannels } from '@/hooks/useChannels';
import { useParsedContent } from '@/hooks/useParsedContent';
import { usePrompts } from '@/hooks/usePrompts';
import { useVideoProjects } from '@/hooks/useVideoProjects';
import { useVoiceovers } from '@/hooks/useVoiceovers';
import { Channel, ParsedContent, ContentSource } from '@/types/content';

const headerTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Дашборд', subtitle: 'Общая статистика и активность' },
  sources: { title: 'Источники', subtitle: 'Управление каналами парсинга' },
  parsed: { title: 'Контент', subtitle: 'Спарсенный контент из всех источников' },
  rewrite: { title: 'Рерайт-студия', subtitle: 'Управление промптами, генерация скриптов' },
  voiceover: { title: 'Озвучка', subtitle: 'Генерация и запись голосовых дорожек' },
  videos: { title: 'Видео', subtitle: 'Генерация и публикация видео' },
  pipeline: { title: 'Пайплайн', subtitle: 'Настройка автоматизации' },
  debug: { title: 'Отладка', subtitle: 'Лог операций и данные вход/выход' },
  analytics: { title: 'Аналитика', subtitle: 'Статистика и метрики' },
  settings: { title: 'Настройки', subtitle: 'Конфигурация системы' },
};

export default function Index() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
  const [contentViewMode, setContentViewMode] = useState<'table' | 'cards'>('table');
  const [debugEntityId, setDebugEntityId] = useState<string | undefined>(undefined);
  const [showNewVideoDialog, setShowNewVideoDialog] = useState(false);

  // Real data hooks
  const { channels, loading: channelsLoading, addChannel, toggleChannel, removeChannel, parseChannel, parseAllBySource } = useChannels();
  const { content, loading: contentLoading, rewriteContent, deleteContent, clearAllContent, refetch: refetchContent } = useParsedContent();
  const { prompts, loading: promptsLoading, updatePrompt, testPrompt, addPrompt, deletePrompt } = usePrompts();
  const { projects, loading: projectsLoading, createProject, generateVoiceover, createHeyGenVideo, checkVideoStatus, deleteProject, sendToSubmagic, checkSubmagicStatus, refetch: refetchProjects } = useVideoProjects();
  const { items: voiceoverItems, pendingCount: voiceoverPendingCount, createVideoFromVoiceover, refetch: refetchVoiceovers } = useVoiceovers();

  // Get ready voiceovers for NewVideoDialog
  const readyVoiceovers = useMemo(() => 
    voiceoverItems.filter(item => item.voiceover?.status === 'ready'),
    [voiceoverItems]
  );

  // Transform DB data to component format
  const channelsFormatted: Channel[] = useMemo(() => 
    channels.map(c => ({
      id: c.id,
      name: c.name,
      source: c.source,
      url: c.url,
      isActive: c.is_active,
      postsCount: c.posts_count,
      lastParsed: c.last_parsed_at ? new Date(c.last_parsed_at) : undefined
    })), [channels]);

  const contentFormatted: ParsedContent[] = useMemo(() => {
    console.log('Raw content from DB:', content.length, 'items');
    if (content.length > 0) {
      console.log('First item status:', content[0].status, 'channel:', content[0].channels);
    }
    
    return content.map(c => {
      // Map DB status to UI status
      let uiStatus: 'pending' | 'parsed' | 'rewritten' | 'video_created' | 'published' | 'failed';
      switch (c.status) {
        case 'parsed':
        case 'selected':
          uiStatus = 'parsed';
          break;
        case 'rewriting':
          uiStatus = 'pending';
          break;
        case 'rewritten':
        case 'voiceover':
          uiStatus = 'rewritten';
          break;
        case 'video':
          uiStatus = 'video_created';
          break;
        case 'published':
          uiStatus = 'published';
          break;
        default:
          uiStatus = 'parsed';
      }
      
      return {
        id: c.id,
        title: c.title,
        description: c.content || '',
        source: (c.channels?.source as ContentSource) || 'web',
        channelName: c.channels?.name || 'Manual',
        url: c.original_url || '',
        thumbnail: c.thumbnail_url || undefined,
        publishedAt: c.published_at ? new Date(c.published_at) : new Date(),
        parsedAt: new Date(c.parsed_at),
        status: uiStatus,
        metrics: {
          views: c.views,
          likes: c.likes,
          comments: c.comments,
        },
        engagementScore: Number(c.engagement_score) || 0,
      };
    });
  }, [content]);

  // Content for RewriteStudio
  const contentsForRewrite = useMemo(() => 
    content.map(c => ({
      id: c.id,
      title: c.title,
      content: c.content || '',
      source: c.channels?.source || 'web',
      channel: c.channels?.name,
    })), [content]);

  const handleSelectContent = (ids: string[] | string) => {
    if (typeof ids === 'string') {
      setSelectedContentIds((prev) =>
        prev.includes(ids) ? prev.filter((i) => i !== ids) : [...prev, ids]
      );
    } else {
      setSelectedContentIds(ids);
    }
  };

  const handleRewriteContent = async (id: string) => {
    // If already have selected IDs, keep them, otherwise use single id
    if (selectedContentIds.length > 0) {
      setActiveTab('rewrite');
    } else {
      setSelectedContentIds([id]);
      setActiveTab('rewrite');
    }
  };

  const handleAddChannel = async (channel: Omit<Channel, 'id' | 'lastParsed' | 'postsCount'>) => {
    await addChannel({
      name: channel.name,
      url: channel.url,
      source: channel.source
    });
  };

  const handleViewDebug = (entityId: string) => {
    setDebugEntityId(entityId);
    setActiveTab('debug');
  };

  const { title, subtitle } = headerTitles[activeTab] || { title: '', subtitle: '' };

  const isLoading = channelsLoading || contentLoading;

  // Calculate counts for sidebar
  const sidebarCounts = useMemo(() => ({
    sources: channels.length,
    content: content.length,
    videos: projects.length,
    rewrites: content.filter(c => c.status === 'rewritten').length,
    voiceovers: voiceoverPendingCount,
  }), [channels.length, content.length, projects.length, content, voiceoverPendingCount]);

  const handleRefresh = () => {
    refetchContent();
    refetchProjects();
    refetchVoiceovers();
  };

  const handleClearContentSelection = () => {
    setSelectedContentIds([]);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} counts={sidebarCounts} />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} subtitle={subtitle} notificationCount={0} onRefresh={handleRefresh} />

        <div className="flex-1 overflow-auto p-6">
          {isLoading && activeTab === 'dashboard' && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Dashboard */}
          {activeTab === 'dashboard' && !isLoading && (
            <div className="space-y-6 animate-fade-in">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                  title="Активных каналов"
                  value={channels.filter((c) => c.is_active).length}
                  change={`${channels.length} всего`}
                  changeType="neutral"
                  icon={Rss}
                />
                <StatsCard
                  title="Спарсено"
                  value={content.length}
                  change="постов в базе"
                  changeType="positive"
                  icon={FileText}
                  iconColor="text-info"
                />
                <StatsCard
                  title="Видео создано"
                  value={projects.filter(p => p.status === 'ready').length}
                  change={`${projects.filter(p => p.status === 'generating').length} в процессе`}
                  changeType="neutral"
                  icon={Video}
                  iconColor="text-accent"
                />
                <StatsCard
                  title="Опубликовано"
                  value={projects.filter(p => p.status === 'published').length}
                  change="видео"
                  changeType="positive"
                  icon={Upload}
                  iconColor="text-success"
                />
              </div>

              {/* Pipeline Status */}
              <PipelineStatus 
                parsedCount={content.length}
                rewrittenCount={content.filter(c => c.status === 'rewritten' || c.status === 'voiceover' || c.status === 'video' || c.status === 'published').length}
                videoCount={projects.filter(p => p.status === 'ready' || p.status === 'published').length}
                publishedCount={projects.filter(p => p.status === 'published').length}
                isProcessing={{
                  rewriting: content.some(c => c.status === 'rewriting'),
                  video: projects.some(p => p.status === 'generating' || p.status === 'voiceover' || p.status === 'editing'),
                }}
              />

              {/* Two columns: Activity + Recent Content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Последний контент</h3>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('parsed')}>
                      Все →
                    </Button>
                  </div>
                  {contentFormatted.length > 0 ? (
                    <ContentList
                      items={contentFormatted.slice(0, 3)}
                      onSelect={(id) => handleSelectContent(id)}
                      onRewrite={handleRewriteContent}
                      selectedIds={selectedContentIds}
                    />
                  ) : (
                    <div className="rounded-xl p-8 card-gradient border border-border text-center text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Нет спарсенного контента</p>
                      <Button 
                        variant="link" 
                        className="mt-2"
                        onClick={() => setActiveTab('sources')}
                      >
                        Добавить источники
                      </Button>
                    </div>
                  )}
                </div>
                <ActivityFeed />
              </div>
            </div>
          )}

          {/* Sources */}
          {activeTab === 'sources' && (
            <div className="space-y-6 animate-fade-in">
              <SourcesManager 
                channels={channelsFormatted}
                onAdd={handleAddChannel}
                onRemove={removeChannel}
                onToggle={toggleChannel}
                onRefresh={async (id, daysBack) => {
                  const result = await parseChannel(id, daysBack || 30);
                  return result;
                }}
                onRefreshAll={parseAllBySource}
                onNavigateToContent={() => {
                  refetchContent();
                  setActiveTab('parsed');
                }}
              />
            </div>
          )}

          {/* Parsed Content */}
          {activeTab === 'parsed' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant={contentViewMode === 'table' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setContentViewMode('table')}
                  >
                    <Table className="w-4 h-4 mr-2" />
                    Таблица
                  </Button>
                  <Button
                    variant={contentViewMode === 'cards' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setContentViewMode('cards')}
                  >
                    <LayoutGrid className="w-4 h-4 mr-2" />
                    Карточки
                  </Button>
                </div>
                <ManualContentForm onContentAdded={refetchContent} />
              </div>

              {contentLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : contentViewMode === 'table' ? (
                <ContentTable
                  items={content}
                  onSelect={handleSelectContent}
                  onRewrite={handleRewriteContent}
                  onDelete={deleteContent}
                  onClearAll={clearAllContent}
                  onRefresh={refetchContent}
                  selectedIds={selectedContentIds}
                />
              ) : (
                <ContentList
                  items={contentFormatted}
                  onSelect={(id) => handleSelectContent(id)}
                  onRewrite={handleRewriteContent}
                  selectedIds={selectedContentIds}
                />
              )}
            </div>
          )}

          {/* Rewrite Studio */}
          {activeTab === 'rewrite' && (
            <div className="space-y-6 animate-fade-in">
              <RewriteStudio
                contents={contentsForRewrite}
                prompts={prompts}
                selectedContentIds={selectedContentIds}
                onAddPrompt={addPrompt}
                onUpdatePrompt={updatePrompt}
                onDeletePrompt={async (id) => {
                  await deletePrompt(id);
                }}
                onTestPrompt={testPrompt}
                onRewrite={async (contentId, promptId) => {
                  return await rewriteContent(contentId, promptId);
                }}
                onCreateVoiceover={() => {
                  refetchVoiceovers();
                  setActiveTab('voiceover');
                }}
                onClearSelection={handleClearContentSelection}
              />
            </div>
          )}

          {/* Voiceover */}
          {activeTab === 'voiceover' && (
            <div className="space-y-6 animate-fade-in">
              <VoiceoverPage />
            </div>
          )}

          {/* Videos */}
          {activeTab === 'videos' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {projects.length} видео
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('debug')}
                  >
                    <Bug className="w-4 h-4 mr-2" />
                    Отладка
                  </Button>
                  <Button 
                    className="bg-primary hover:bg-primary/90"
                    onClick={() => setShowNewVideoDialog(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Новое видео
                  </Button>
                </div>
              </div>
              
              {projectsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project, index) => {
                    // Get script from rewritten content
                    const script = project.rewritten_content?.script || 
                                   project.rewritten_content?.rewritten_text || 
                                   'Тестовый скрипт для видео';
                    
                    return (
                      <div
                        key={project.id}
                        className="animate-slide-up"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <VideoCard 
                          video={{
                            id: project.id,
                            title: project.title,
                            status: project.status,
                            progress: project.progress,
                            thumbnail: project.heygen_video_url || undefined,
                            duration: project.duration ? `${Math.floor(project.duration / 60)}:${(project.duration % 60).toString().padStart(2, '0')}` : undefined,
                            createdAt: new Date(project.created_at),
                            avatarId: project.avatar_id || undefined,
                            heygen_video_url: project.heygen_video_url,
                            heygen_video_id: project.heygen_video_id,
                            avatar_id: project.avatar_id,
                            error_message: project.error_message,
                            rewritten_content: project.rewritten_content,
                            submagic_project_id: project.submagic_project_id,
                            submagic_video_url: project.submagic_video_url,
                            is_edited: project.is_edited,
                          }}
                          onGenerateVoiceover={(voiceId) => {
                            generateVoiceover(project.id, script, voiceId);
                          }}
                          onCreateVideo={(avatarId) => {
                            createHeyGenVideo(project.id, script, avatarId);
                          }}
                          onCheckStatus={() => checkVideoStatus(project.id)}
                          onDelete={(id) => deleteProject(id)}
                          onSendToSubmagic={() => sendToSubmagic(project.id)}
                          onCheckSubmagicStatus={() => checkSubmagicStatus(project.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl p-8 card-gradient border border-border text-center text-muted-foreground">
                  <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Нет видео проектов</p>
                  <Button 
                    variant="link" 
                    className="mt-2"
                    onClick={() => createProject('Мое первое видео')}
                  >
                    Создать первое видео
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Debug */}
          {activeTab === 'debug' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Отладка операций</h3>
                <div className="flex gap-2">
                  <Button
                    variant={debugEntityId ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDebugEntityId(undefined)}
                  >
                    Все операции
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <StepDebugger entityId={debugEntityId} />
                </div>
                <div className="space-y-4">
                  <div className="rounded-xl p-4 card-gradient border border-border">
                    <h4 className="font-medium mb-3">Фильтр по сущности</h4>
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setDebugEntityId(undefined)}
                      >
                        Все операции
                      </Button>
                      {projects.slice(0, 5).map(p => (
                        <Button
                          key={p.id}
                          variant={debugEntityId === p.id ? 'secondary' : 'ghost'}
                          size="sm"
                          className="w-full justify-start text-left"
                          onClick={() => setDebugEntityId(p.id)}
                        >
                          <Video className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span className="truncate">{p.title}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pipeline */}
          {activeTab === 'pipeline' && (
            <div className="space-y-6 animate-fade-in">
              <PromptEditor 
                prompts={prompts}
                onUpdatePrompt={updatePrompt}
                onTestPrompt={testPrompt}
              />
              
              <div className="rounded-xl p-8 card-gradient border border-border text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Настройка пайплайна</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Здесь вы сможете настроить автоматические цепочки: парсинг → рерайт → видео → публикация
                </p>
                <Button className="bg-primary hover:bg-primary/90">Создать пайплайн</Button>
              </div>
            </div>
          )}

          {/* Analytics */}
          {activeTab === 'analytics' && (
            <div className="flex items-center justify-center h-full animate-fade-in">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-accent/20 flex items-center justify-center">
                  <TrendingUp className="w-10 h-10 text-accent" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Аналитика</h3>
                <p className="text-muted-foreground mb-6">
                  Графики охватов, вовлечённости и эффективности контента появятся здесь
                </p>
                <Button variant="outline">Скоро</Button>
              </div>
            </div>
          )}

          {/* Settings */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in">
              <Tabs defaultValue="prompts">
                <TabsList>
                  <TabsTrigger value="prompts">Промпты</TabsTrigger>
                  <TabsTrigger value="api">API ключи</TabsTrigger>
                  <TabsTrigger value="avatars">Аватары</TabsTrigger>
                  <TabsTrigger value="voices">Голоса</TabsTrigger>
                </TabsList>
                
                <TabsContent value="prompts" className="mt-6">
                  <PromptEditor 
                    prompts={prompts}
                    onUpdatePrompt={updatePrompt}
                    onTestPrompt={testPrompt}
                  />
                </TabsContent>
                
                <TabsContent value="api" className="mt-6">
                  <div className="rounded-xl p-8 card-gradient border border-border">
                    <h3 className="text-xl font-bold mb-3">API Ключи</h3>
                    <p className="text-muted-foreground mb-4">
                      Ключи настроены через Lovable Cloud
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-success"></span>
                        ANTHROPIC_API_KEY
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-success"></span>
                        ELEVENLABS_API_KEY
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-success"></span>
                        HEYGEN_API_KEY
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-success"></span>
                        SUBMAGIC_API_KEY
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="avatars" className="mt-6">
                  <div className="rounded-xl p-8 card-gradient border border-border text-center">
                    <h3 className="text-xl font-bold mb-3">HeyGen Аватары</h3>
                    <p className="text-muted-foreground mb-4">
                      Управление аватарами для генерации видео
                    </p>
                    <Button variant="outline">Настроить</Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="voices" className="mt-6">
                  <div className="rounded-xl p-8 card-gradient border border-border text-center">
                    <h3 className="text-xl font-bold mb-3">ElevenLabs Голоса</h3>
                    <p className="text-muted-foreground mb-4">
                      Выбор голосов для озвучки
                    </p>
                    <Button variant="outline">Настроить</Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </main>

      {/* New Video Dialog */}
      <NewVideoDialog
        open={showNewVideoDialog}
        onOpenChange={setShowNewVideoDialog}
        readyVoiceovers={readyVoiceovers}
        onCreateVideo={async (rewriteId, avatarId, aspectRatio) => {
          await createVideoFromVoiceover(rewriteId, avatarId, aspectRatio);
          refetchProjects();
        }}
      />
    </div>
  );
}
