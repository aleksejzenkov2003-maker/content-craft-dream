import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { AdvisorsGrid } from '@/components/advisors/AdvisorsGrid';
import { PlaylistsGrid } from '@/components/playlists/PlaylistsGrid';
import { VideosTable } from '@/components/videos/VideosTable';
import { VideoEditorDialog } from '@/components/videos/VideoEditorDialog';
import { VideoImportDialog } from '@/components/videos/VideoImportDialog';
import { VideoDetailModal } from '@/components/videos/VideoDetailModal';
import { VideoSidePanel } from '@/components/videos/VideoSidePanel';
import { PublishingChannelsGrid } from '@/components/publishing/PublishingChannelsGrid';
import { PublicationsTable } from '@/components/publishing/PublicationsTable';
import { PublishingKanban } from '@/components/publishing/PublishingKanban';
import { ScenesMatrix } from '@/components/scenes/ScenesMatrix';
import { QuestionsTable } from '@/components/questions/QuestionsTable';
import { BackCoversGrid } from '@/components/covers/BackCoversGrid';
import { CoverThumbnailsGrid } from '@/components/covers/CoverThumbnailsGrid';
import { useAdvisors } from '@/hooks/useAdvisors';
import { usePlaylists } from '@/hooks/usePlaylists';
import { useVideos, Video, VideoFilters } from '@/hooks/useVideos';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';
import { usePublications } from '@/hooks/usePublications';
import { usePublishingChannels } from '@/hooks/usePublishingChannels';
import { Users, ListVideo, Video as VideoIcon, CheckCircle, Loader2, Send, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const headerTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Дашборд', subtitle: 'Общая статистика' },
  questions: { title: 'Вопросы', subtitle: 'Список вопросов для роликов' },
  videos: { title: 'Ролики', subtitle: 'Все видео с духовниками' },
  'publications-list': { title: 'Публикации', subtitle: 'Список публикаций по каналам' },
  'publications-kanban': { title: 'Канбан публикаций', subtitle: 'Управление статусами публикаций' },
  scenes: { title: 'Сцены', subtitle: 'Генерация сцен для плейлистов' },
  'back-covers': { title: 'Задние обложки', subtitle: 'Шаблоны задних обложек по духовникам' },
  'cover-thumbnails': { title: 'Миниатюры обложек', subtitle: 'Сгенерированные обложки' },
  advisors: { title: 'Духовники', subtitle: 'Управление аватарами и настройками' },
  playlists: { title: 'Плейлисты', subtitle: 'Группировка видео по категориям' },
  channels: { title: 'Каналы', subtitle: 'Настройка каналов публикации' },
  settings: { title: 'Настройки', subtitle: 'Конфигурация системы' },
};

export default function Index() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [videoFilters, setVideoFilters] = useState<VideoFilters>({});
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [viewingVideo, setViewingVideo] = useState<Video | null>(null);
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [showVideoDetail, setShowVideoDetail] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [publicationsTab, setPublicationsTab] = useState('by-channel');
  const { advisors, loading: advisorsLoading, addAdvisor, updateAdvisor, deleteAdvisor, addPhoto, deletePhoto, setPrimaryPhoto, updatePhotoAssetId } = useAdvisors();
  const { playlists, loading: playlistsLoading, addPlaylist, updatePlaylist, deletePlaylist } = usePlaylists();
  // All videos without filter - for Questions table
  const { videos: allVideos, loading: allVideosLoading } = useVideos();
  // Filtered videos - for Videos table
  const { videos, loading: videosLoading, addVideo, updateVideo, deleteVideo, refetch: refetchVideos, bulkImport } = useVideos(videoFilters);
  const { publications, loading: publicationsLoading, addPublication } = usePublications();
  const { channels: publishingChannels } = usePublishingChannels();
  
  const { 
    isGenerating, 
    uploadPhotoToHeygen, 
    generateVideo, 
    cleanup: cleanupGeneration 
  } = useVideoGeneration({ onVideoUpdated: refetchVideos });

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupGeneration();
  }, [cleanupGeneration]);

  const { title, subtitle } = headerTitles[activeTab] || { title: '', subtitle: '' };

  const sidebarCounts = {
    advisors: advisors.length,
    videos: videos.length,
    playlists: playlists.length,
    publications: publications.length,
  };

  const handleUploadToHeygen = async (photo: any) => {
    toast.info('Загрузка в HeyGen будет реализована');
    // TODO: Implement HeyGen upload
  };

  const handleGenerateVideo = async (video: Video, photoAssetId: string) => {
    await generateVideo(video, photoAssetId);
  };

  const handleUploadPhotoToHeygen = async (photo: any) => {
    return await uploadPhotoToHeygen(photo);
  };

  const handleGenerateCover = async (video: Video) => {
    try {
      toast.info('Генерация обложки...');
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-cover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          videoId: video.id,
          prompt: video.cover_prompt,
          advisorPhotoUrl: video.main_photo_url,
          advisorName: video.advisor?.display_name || video.advisor?.name,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate cover');
      }

      toast.success('Обложка сгенерирована!');
      refetchVideos();
    } catch (error) {
      console.error('Error generating cover:', error);
      toast.error('Ошибка генерации обложки');
      refetchVideos();
    }
  };

  const handleViewVideo = (video: Video) => {
    setViewingVideo(video);
    setShowSidePanel(true);
  };

  const handlePublishVideo = async (video: Video, channelIds: string[]) => {
    try {
      for (const channelId of channelIds) {
        await addPublication({
          video_id: video.id,
          channel_id: channelId,
          publication_status: 'pending',
        });
      }
      toast.success(`Добавлено ${channelIds.length} публикаций`);
    } catch (error) {
      console.error('Error publishing video:', error);
    }
  };

  const handleSaveVideo = async (id: string | null, data: Partial<Video>) => {
    if (id) {
      await updateVideo(id, data);
    } else {
      await addVideo(data);
    }
  };

  const handleRefresh = () => {
    refetchVideos();
  };

  // Get unique questions from videos
  const questions = [...new Set(videos.map(v => v.question).filter(Boolean))];

  const isLoading = advisorsLoading || playlistsLoading || videosLoading;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} counts={sidebarCounts} />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} subtitle={subtitle} notificationCount={0} onRefresh={handleRefresh} />

        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                      title="Духовников"
                      value={advisors.length}
                      change="активных"
                      changeType="neutral"
                      icon={Users}
                    />
                    <StatsCard
                      title="Роликов"
                      value={videos.length}
                      change="всего"
                      changeType="positive"
                      icon={VideoIcon}
                      iconColor="text-info"
                    />
                    <StatsCard
                      title="Плейлистов"
                      value={playlists.length}
                      change="категорий"
                      changeType="neutral"
                      icon={ListVideo}
                      iconColor="text-accent"
                    />
                    <StatsCard
                      title="Готово"
                      value={videos.filter(v => v.generation_status === 'ready').length}
                      change="видео"
                      changeType="positive"
                      icon={CheckCircle}
                      iconColor="text-success"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                      title="Вопросов"
                      value={questions.length}
                      change="уникальных"
                      changeType="neutral"
                      icon={HelpCircle}
                    />
                    <StatsCard
                      title="Публикаций"
                      value={publications.length}
                      change="всего"
                      changeType="positive"
                      icon={Send}
                      iconColor="text-info"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'advisors' && (
            <AdvisorsGrid
              advisors={advisors}
              loading={advisorsLoading}
              onAddAdvisor={addAdvisor}
              onUpdateAdvisor={updateAdvisor}
              onDeleteAdvisor={deleteAdvisor}
              onAddPhoto={addPhoto}
              onDeletePhoto={deletePhoto}
              onSetPrimaryPhoto={setPrimaryPhoto}
              onUploadToHeygen={handleUploadToHeygen}
            />
          )}

          {activeTab === 'videos' && (
            <>
              <VideosTable
                videos={videos}
                advisors={advisors}
                playlists={playlists}
                publications={publications}
                loading={videosLoading}
                onEditVideo={(video) => { setEditingVideo(video); setShowVideoEditor(true); }}
                onDeleteVideo={deleteVideo}
                onGenerateVideo={(video) => handleViewVideo(video)}
                onGenerateCover={handleGenerateCover}
                onAddVideo={() => { setEditingVideo(null); setShowVideoEditor(true); }}
                onImportVideos={() => setShowImportDialog(true)}
                onViewVideo={handleViewVideo}
                filters={videoFilters}
                onFilterChange={setVideoFilters}
              />
              <VideoEditorDialog
                video={editingVideo}
                advisors={advisors}
                playlists={playlists}
                open={showVideoEditor}
                onClose={() => { setShowVideoEditor(false); setEditingVideo(null); }}
                onSave={handleSaveVideo}
              />
              <VideoImportDialog
                open={showImportDialog}
                onClose={() => setShowImportDialog(false)}
                onImport={bulkImport}
                advisors={advisors}
                playlists={playlists}
              />
              <VideoDetailModal
                open={showVideoDetail}
                onOpenChange={(open) => { setShowVideoDetail(open); if (!open) setViewingVideo(null); }}
                video={viewingVideo}
                advisors={advisors}
                onUpdateVideo={updateVideo}
                onGenerateVideo={handleGenerateVideo}
                onUploadPhotoToHeygen={handleUploadPhotoToHeygen}
                isGenerating={isGenerating}
              />
              <VideoSidePanel
                video={viewingVideo}
                open={showSidePanel}
                onOpenChange={(open) => { setShowSidePanel(open); if (!open) setViewingVideo(null); }}
                advisors={advisors}
                publishingChannels={publishingChannels}
                onGenerateCover={handleGenerateCover}
                onGenerateVideo={(video) => { setShowVideoDetail(true); }}
                onUpdateVideo={updateVideo}
                onPublish={handlePublishVideo}
                isGenerating={isGenerating}
              />
            </>
          )}

          {activeTab === 'playlists' && (
            <PlaylistsGrid
              playlists={playlists}
              loading={playlistsLoading}
              onAddPlaylist={addPlaylist}
              onUpdatePlaylist={updatePlaylist}
              onDeletePlaylist={deletePlaylist}
              onSelectPlaylist={(playlist) => {
                setVideoFilters({ playlistId: playlist.id });
                setActiveTab('videos');
              }}
            />
          )}

          {activeTab === 'questions' && (
            <QuestionsTable
              videos={allVideos}
              publications={publications}
              loading={allVideosLoading}
              selectedQuestionIds={videoFilters.questionIds || []}
              onSelectionChange={(questionIds) => {
                setVideoFilters(prev => ({ ...prev, questionIds: questionIds.length > 0 ? questionIds : undefined }));
              }}
              onAddQuestion={async (data) => {
                await addVideo({
                  question_id: data.question_id,
                  question: data.question,
                  safety_score: data.safety_score,
                });
              }}
              onGoToVideos={() => setActiveTab('videos')}
              onUpdateQuestion={async (questionId, updates) => {
                const videosToUpdate = allVideos.filter(v => v.question_id === questionId);
                for (const video of videosToUpdate) {
                  await updateVideo(video.id, updates);
                }
              }}
              onDeleteQuestion={async (questionId) => {
                // Удаляем все ролики с этим question_id
                const videosToDelete = allVideos.filter(v => v.question_id === questionId);
                for (const video of videosToDelete) {
                  await deleteVideo(video.id);
                }
              }}
            />
          )}

          {activeTab === 'scenes' && (
            <ScenesMatrix />
          )}

          {activeTab === 'publications-list' && (
            <div className="space-y-6">
              <Tabs value={publicationsTab} onValueChange={setPublicationsTab}>
                <TabsList>
                  <TabsTrigger value="by-channel">По каналам</TabsTrigger>
                  <TabsTrigger value="by-question">По вопросам</TabsTrigger>
                </TabsList>
                <TabsContent value="by-channel" className="mt-4">
                  <PublicationsTable groupBy="channel" />
                </TabsContent>
                <TabsContent value="by-question" className="mt-4">
                  <PublicationsTable groupBy="question" />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {activeTab === 'publications-kanban' && (
            <PublishingKanban />
          )}

          {activeTab === 'back-covers' && (
            <BackCoversGrid />
          )}

          {activeTab === 'cover-thumbnails' && (
            <CoverThumbnailsGrid />
          )}

          {activeTab === 'channels' && (
            <PublishingChannelsGrid />
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Настройки</h2>
              <Card className="glass-card">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground">Настройки будут добавлены позже</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
