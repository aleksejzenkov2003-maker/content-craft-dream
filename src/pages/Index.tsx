import { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { AdvisorsGrid } from '@/components/advisors/AdvisorsGrid';
import { PlaylistsGrid } from '@/components/playlists/PlaylistsGrid';
import { VideosTable } from '@/components/videos/VideosTable';
import { VideoEditorDialog } from '@/components/videos/VideoEditorDialog';
import { CsvImporter } from '@/components/import/CsvImporter';
import { VIDEO_COLUMN_MAPPING, VIDEO_FIELD_DEFINITIONS, VIDEO_PREVIEW_COLUMNS } from '@/components/import/importConfigs';
import { VideoDetailModal } from '@/components/videos/VideoDetailModal';
import { VideoSidePanel } from '@/components/videos/VideoSidePanel';
import { PublishingChannelsGrid } from '@/components/publishing/PublishingChannelsGrid';
import { ProxyServersGrid } from '@/components/proxies/ProxyServersGrid';
import { PromptsPage } from '@/components/prompts/PromptsPage';
import { PublicationsTable } from '@/components/publishing/PublicationsTable';
import { PublishingKanban } from '@/components/publishing/PublishingKanban';
import { ScenesMatrix } from '@/components/scenes/ScenesMatrix';
import { QuestionsTable } from '@/components/questions/QuestionsTable';


import { useAdvisors } from '@/hooks/useAdvisors';
import { usePlaylists } from '@/hooks/usePlaylists';
import { useVideos, Video, VideoFilters } from '@/hooks/useVideos';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';
import { usePublications } from '@/hooks/usePublications';
import { useVideoConcat } from '@/hooks/useVideoConcat';
import { usePublishingChannels } from '@/hooks/usePublishingChannels';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { Users, ListVideo, Video as VideoIcon, CheckCircle, Loader2, Send, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const headerTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Дашборд', subtitle: 'Общая статистика' },
  questions: { title: 'Вопросы', subtitle: 'Список вопросов для роликов' },
  videos: { title: 'Ролики', subtitle: 'Все видео с духовниками' },
  'publications-list': { title: 'Публикации', subtitle: 'Список публикаций по каналам' },
  scenes: { title: 'Сцены', subtitle: 'Генерация сцен для плейлистов' },
  
  advisors: { title: 'Духовники', subtitle: 'Управление аватарами и настройками' },
  playlists: { title: 'Плейлисты', subtitle: 'Группировка видео по категориям' },
  channels: { title: 'Каналы', subtitle: 'Настройка каналов публикации' },
  proxies: { title: 'Прокси-сервера', subtitle: 'Управление прокси для публикации' },
  prompts: { title: 'Промты', subtitle: 'Управление промтами генерации' },
  settings: { title: 'Настройки', subtitle: 'Конфигурация системы' },
};

export default function Index() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [videoFilters, setVideoFilters] = useState<VideoFilters>({});
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [viewingVideoId, setViewingVideoId] = useState<string | null>(null);
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [showVideoDetail, setShowVideoDetail] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [publicationsTab, setPublicationsTab] = useState('by-channel');
  const { advisors, loading: advisorsLoading, addAdvisor, updateAdvisor, deleteAdvisor, addPhoto, deletePhoto, setPrimaryPhoto, updatePhotoAssetId, bulkImport: bulkImportAdvisors } = useAdvisors();
  const { playlists, loading: playlistsLoading, addPlaylist, updatePlaylist, deletePlaylist } = usePlaylists();
  const { videos: allVideos, loading: allVideosLoading, refetch: refetchAllVideos, bulkUpdate: bulkUpdateAll } = useVideos();
  const { videos, loading: videosLoading, addVideo, updateVideo, deleteVideo, refetch: refetchVideos, bulkImport, bulkUpdate } = useVideos(videoFilters);
  const { publications, loading: publicationsLoading, addPublication, refetch: refetchPublications } = usePublications();
  const { channels: publishingChannels } = usePublishingChannels();
  const { concatVideos } = useVideoConcat();

  // Derive live objects from arrays instead of storing snapshots
  const editingVideo = editingVideoId ? (videos.find(v => v.id === editingVideoId) ?? allVideos.find(v => v.id === editingVideoId) ?? null) : null;
  const viewingVideo = viewingVideoId ? (videos.find(v => v.id === viewingVideoId) ?? allVideos.find(v => v.id === viewingVideoId) ?? null) : null;
  
  const { 
    isGenerating, 
    uploadPhotoToHeygen, 
    generateVideo, 
    cleanup: cleanupGeneration 
  } = useVideoGeneration({ onVideoUpdated: refetchVideos });

  useEffect(() => {
    return () => cleanupGeneration();
  }, [cleanupGeneration]);

  const { title, subtitle } = headerTitles[activeTab] || { title: '', subtitle: '' };

  const sidebarCounts = {
    advisors: advisors.length,
    videos: videos.filter(v => v.question_status === 'in_progress').length,
    playlists: playlists.length,
    publications: publications.length,
  };

  const videoPollingRef = useRef<Record<string, NodeJS.Timeout>>({});
  const pollingErrorsRef = useRef<Record<string, number>>({});
  const POLL_INTERVAL_MS = 12000;
  const MAX_POLL_ERRORS = 8;

  const stopVideoPolling = useCallback((videoId: string) => {
    if (videoPollingRef.current[videoId]) {
      clearInterval(videoPollingRef.current[videoId]);
      delete videoPollingRef.current[videoId];
    }
    delete pollingErrorsRef.current[videoId];
  }, []);

  const triggerAutoConcat = useCallback(async (videoId: string) => {
    try {
      // Find publications with needs_concat status for this video
      const { data: pubs } = await supabase
        .from('publications')
        .select('id, channel_id')
        .eq('video_id', videoId)
        .eq('publication_status', 'needs_concat');

      if (!pubs || pubs.length === 0) return;

      // Get video URL
      const { data: video } = await supabase
        .from('videos')
        .select('heygen_video_url, video_path')
        .eq('id', videoId)
        .single();

      const videoUrl = video?.heygen_video_url || video?.video_path;
      if (!videoUrl) return;

      // Get channels with back cover video URLs
      const channelIds = [...new Set(pubs.map(p => p.channel_id).filter(Boolean))];
      const { data: channels } = await supabase
        .from('publishing_channels')
        .select('id, back_cover_video_url')
        .in('id', channelIds as string[]);

      const channelMap = new Map(channels?.map(c => [c.id, c.back_cover_video_url]) || []);

      for (const pub of pubs) {
        const backCoverUrl = channelMap.get(pub.channel_id);
        if (backCoverUrl) {
          toast.info(`Склейка видео для публикации...`);
          try {
            await concatVideos(pub.id, videoUrl, backCoverUrl);
          } catch (e) {
            console.error('Auto-concat failed for publication:', pub.id, e);
          }
        }
      }
      refetchPublications();
    } catch (err) {
      console.error('Auto-concat error:', err);
    }
  }, [concatVideos, refetchPublications]);

  const pollVideoStatus = useCallback(async (videoId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('check-video-status', {
        body: { videoId },
      });

      if (error) {
        pollingErrorsRef.current[videoId] = (pollingErrorsRef.current[videoId] ?? 0) + 1;
        if (pollingErrorsRef.current[videoId] >= MAX_POLL_ERRORS) {
          stopVideoPolling(videoId);
          toast.error('Не удалось обновить статус видео');
        }
        return;
      }

      pollingErrorsRef.current[videoId] = 0;

      if (data?.status === 'ready') {
        stopVideoPolling(videoId);
        toast.success('Видео готово!');
        refetchVideos();
        refetchPublications();
        
        // Auto-concat: find publications marked needs_concat for this video
        triggerAutoConcat(videoId);
      } else if (data?.status === 'error' || data?.status === 'failed') {
        stopVideoPolling(videoId);
        toast.error(data?.errorMessage || 'Ошибка генерации видео');
        refetchVideos();
      }
    } catch (err) {
      console.error('Video polling error:', err);
    }
  }, [refetchVideos, refetchPublications, stopVideoPolling, triggerAutoConcat]);

  const startVideoPolling = useCallback((videoId: string) => {
    if (videoPollingRef.current[videoId]) return;

    pollingErrorsRef.current[videoId] = 0;
    void pollVideoStatus(videoId);

    videoPollingRef.current[videoId] = setInterval(() => {
      void pollVideoStatus(videoId);
    }, POLL_INTERVAL_MS);
  }, [pollVideoStatus]);

  useEffect(() => {
    const generatingVideoIds = videos
      .filter((video) => video.generation_status === 'generating' && video.heygen_video_id && !video.heygen_video_url)
      .map((video) => video.id);

    generatingVideoIds.forEach((videoId) => startVideoPolling(videoId));

    Object.keys(videoPollingRef.current).forEach((videoId) => {
      if (!generatingVideoIds.includes(videoId)) {
        stopVideoPolling(videoId);
      }
    });
  }, [videos, startVideoPolling, stopVideoPolling]);

  useEffect(() => {
    return () => {
      Object.keys(videoPollingRef.current).forEach((videoId) => stopVideoPolling(videoId));
    };
  }, [stopVideoPolling]);

  const handleGenerateVideo = async (video: Video) => {
    if (!video.voiceover_url) {
      toast.error('Сначала создайте озвучку');
      return;
    }
    try {
      toast.info('Запуск генерации видео...');
      await updateVideo(video.id, { generation_status: 'generating' }, { silent: true });
      refetchVideos();

      const { data, error } = await supabase.functions.invoke('generate-video-heygen', {
        body: { videoId: video.id },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to start video generation');

      toast.success('Генерация видео запущена');
      startVideoPolling(video.id);
    } catch (error: any) {
      console.error('Error generating video:', error);
      toast.error('Ошибка запуска генерации видео');
      await updateVideo(video.id, { generation_status: 'error' }, { silent: true });
      refetchVideos();
    }
  };

  const handleUploadPhotoToHeygen = async (photo: any) => {
    return await uploadPhotoToHeygen(photo);
  };

  const handleGenerateAtmosphere = async (video: Video, customPrompt?: string) => {
    try {
      toast.info('Генерация фона (атмосферы)...');
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-cover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          videoId: video.id,
          step: 'atmosphere',
          ...(customPrompt ? { atmospherePrompt: customPrompt } : {}),
        }),
      });

      if (!response.ok) throw new Error('Failed to generate atmosphere');
      toast.success('Фон (атмосфера) сгенерирован!');
      refetchVideos();
    } catch (error) {
      console.error('Error generating atmosphere:', error);
      toast.error('Ошибка генерации фона');
      refetchVideos();
    }
  };

  const handleGenerateCover = async (video: Video) => {
    try {
      // Check if advisor has a thumbnail photo
      if (video.advisor_id) {
        const advisor = advisors.find(a => a.id === video.advisor_id);
        if (advisor && !advisor.thumbnail_photo_id) {
          toast.warning('У духовника не назначено фото для миниатюры. Обложка будет без портрета. Назначьте фото (М) в разделе Духовники.');
        }
      }
      
      toast.info('Генерация обложки...');
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-cover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          videoId: video.id,
          step: 'overlay',
        }),
      });

      if (!response.ok) throw new Error('Failed to generate cover');
      toast.success('Обложка сгенерирована!');
      refetchVideos();
    } catch (error) {
      console.error('Error generating cover:', error);
      toast.error('Ошибка генерации обложки');
      refetchVideos();
    }
  };

  const handleGenerateVoiceover = async (video: Video) => {
    try {
      toast.info('Генерация озвучки...');
      await updateVideo(video.id, { voiceover_status: 'generating' } as any, { silent: true });
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-voiceover-for-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ videoId: video.id }),
      });

      if (!response.ok) throw new Error('Failed to generate voiceover');
      toast.success('Озвучка сгенерирована!');
      refetchVideos();
    } catch (error) {
      console.error('Error generating voiceover:', error);
      toast.error('Ошибка генерации озвучки');
      refetchVideos();
    }
  };

  const handleViewVideo = (video: Video) => {
    setViewingVideoId(video.id);
    setShowSidePanel(true);
  };

  const handlePublishVideo = async (video: Video, channelIds: string[]) => {
    try {
      // Check existing publications to avoid duplicates
      const { data: existing } = await supabase
        .from('publications')
        .select('channel_id')
        .eq('video_id', video.id)
        .in('channel_id', channelIds);

      const existingIds = new Set((existing || []).map(e => e.channel_id));
      const newChannelIds = channelIds.filter(id => !existingIds.has(id));

      if (newChannelIds.length === 0) {
        toast.info('Публикации уже существуют');
        return;
      }

      // Determine which channels need concat (have back_cover_video_url)
      const { data: channelDetails } = await supabase
        .from('publishing_channels')
        .select('id, back_cover_video_url')
        .in('id', newChannelIds);

      const channelsWithBackCover = new Set(
        (channelDetails || []).filter(c => c.back_cover_video_url).map(c => c.id)
      );

      // Batch insert all at once, setting needs_concat for channels with back covers
      const { data: inserted, error } = await supabase
        .from('publications')
        .insert(newChannelIds.map(channelId => ({
          video_id: video.id,
          channel_id: channelId,
          publication_status: channelsWithBackCover.has(channelId) ? 'needs_concat' : 'pending',
        })))
        .select('id, channel_id');

      if (error) throw error;

      // Refresh publications list so sidebar count updates
      await refetchPublications();
      toast.success(`Добавлено ${newChannelIds.length} публикаций`);

      // Fire-and-forget text generation — no per-item toasts
      for (const pub of (inserted || [])) {
        supabase.functions.invoke('generate-post-text', {
          body: { publicationId: pub.id },
        }).catch(console.error);
      }

      // Auto-concat for channels with back covers if video is ready
      // Fetch fresh video data to check for video URL
      const { data: freshVideo } = await supabase
        .from('videos')
        .select('heygen_video_url, video_path')
        .eq('id', video.id)
        .single();
      
      const videoUrl = freshVideo?.heygen_video_url || freshVideo?.video_path;
      if (videoUrl) {
        for (const pub of (inserted || [])) {
          if (channelsWithBackCover.has(pub.channel_id)) {
            const backCoverUrl = channelDetails?.find(c => c.id === pub.channel_id)?.back_cover_video_url;
            if (backCoverUrl) {
              concatVideos(pub.id, videoUrl, backCoverUrl).then(() => {
                refetchPublications();
              }).catch(console.error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error publishing video:', error);
      toast.error('Ошибка публикации');
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

  // Auto-generation logic: when question has status 'in_progress' and planned date, generate covers and videos
  const triggerAutoGeneration = async (uniqueKey: string) => {
    const questionId = parseInt(uniqueKey);
    if (isNaN(questionId)) return;
    
    const questionVideos = allVideos.filter(v => v.question_id === questionId);
    
    if (questionVideos.length === 0) return;
    
    // Check if conditions are met: status is in_progress AND has planned date
    const firstVideo = questionVideos[0];
    if (firstVideo.question_status !== 'in_progress' || !firstVideo.publication_date) return;
    
    // Generate covers for videos that don't have them yet
    for (const video of questionVideos) {
      if (video.cover_status !== 'ready' && video.cover_status !== 'generating') {
        handleGenerateCover(video).catch(console.error);
      }
    }
    
    // Generate videos for videos that don't have them yet
    for (const video of questionVideos) {
      if (video.generation_status !== 'ready' && video.generation_status !== 'generating') {
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video-heygen`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ videoId: video.id }),
          });
          if (!response.ok) {
            console.error('Auto video generation failed for', video.id);
          }
        } catch (e) {
          console.error('Auto video generation error:', e);
        }
      }
    }
  };

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
                    <StatsCard title="Духовников" value={advisors.length} change="активных" changeType="neutral" icon={Users} />
                    <StatsCard title="Роликов" value={videos.length} change="всего" changeType="positive" icon={VideoIcon} iconColor="text-info" />
                    <StatsCard title="Плейлистов" value={playlists.length} change="категорий" changeType="neutral" icon={ListVideo} iconColor="text-accent" />
                    <StatsCard title="Готово" value={videos.filter(v => v.generation_status === 'ready').length} change="видео" changeType="positive" icon={CheckCircle} iconColor="text-success" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard title="Вопросов" value={questions.length} change="уникальных" changeType="neutral" icon={HelpCircle} />
                    <StatsCard title="Публикаций" value={publications.length} change="всего" changeType="positive" icon={Send} iconColor="text-info" />
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
              onUploadToHeygen={async () => { toast.info('Загрузка в HeyGen будет реализована'); }}
              onBulkImport={bulkImportAdvisors}
            />
          )}

          {activeTab === 'videos' && (
            <>
              <VideosTable
                videos={videos}
                advisors={advisors}
                playlists={playlists}
                publications={publications}
                publishingChannels={publishingChannels}
                loading={videosLoading}
                onEditVideo={(video) => { setEditingVideoId(video.id); setShowVideoEditor(true); }}
                onDeleteVideo={deleteVideo}
                onGenerateVideo={handleGenerateVideo}
                onGenerateCover={handleGenerateCover}
                onGenerateAtmosphere={handleGenerateAtmosphere}
                onGenerateVoiceover={handleGenerateVoiceover}
                onAddVideo={() => { setEditingVideoId(null); setShowVideoEditor(true); }}
                onImportVideos={() => setShowImportDialog(true)}
                onViewVideo={handleViewVideo}
                onUpdateVideo={updateVideo}
                onBulkDelete={async (videoIds) => {
                  for (const id of videoIds) { await deleteVideo(id); }
                }}
                onBulkGenerateCovers={async (videoIds) => {
                  const videosToProcess = videos.filter(v => videoIds.includes(v.id));
                  for (const video of videosToProcess) { await handleGenerateCover(video); }
                }}
                onBulkGenerateVideos={async (videoIds) => {
                  const videosToProcess = videos.filter(v => videoIds.includes(v.id));
                  for (const video of videosToProcess) { await handleGenerateVideo(video); }
                }}
                onBulkUpdateStatus={async (videoIds, status) => {
                  for (const id of videoIds) { await updateVideo(id, { generation_status: status }); }
                }}
                onBulkPublish={async (videoIds) => {
                  const videosToPublish = videos.filter(v => videoIds.includes(v.id));
                  const withoutDate = videosToPublish.filter(v => !v.publication_date);
                  if (withoutDate.length > 0) {
                    toast.error(`${withoutDate.length} ролик(ов) без плановой даты. Сначала укажите дату.`);
                    return;
                  }
                  let totalCreated = 0;
                  for (const video of videosToPublish) {
                    const channelIds = video.selected_channels?.length ? video.selected_channels : publishingChannels.filter(c => c.is_active).map(c => c.id);
                    if (channelIds.length > 0) {
                      await handlePublishVideo(video, channelIds);
                      totalCreated += channelIds.length;
                    }
                  }
                  if (totalCreated === 0) {
                    toast.info('Нет каналов для публикации. Добавьте каналы в настройках.');
                  }
                }}
                filters={videoFilters}
                onFilterChange={setVideoFilters}
              />
              <VideoEditorDialog
                video={editingVideo}
                advisors={advisors}
                playlists={playlists}
                open={showVideoEditor}
                onClose={() => { setShowVideoEditor(false); setEditingVideoId(null); }}
                onSave={handleSaveVideo}
              />
              <CsvImporter
                open={showImportDialog}
                onClose={() => setShowImportDialog(false)}
                title="Импорт роликов"
                columnMapping={VIDEO_COLUMN_MAPPING}
                previewColumns={VIDEO_PREVIEW_COLUMNS}
                fieldDefinitions={VIDEO_FIELD_DEFINITIONS}
                requiredFields={['video_number']}
                lookups={{ advisors, playlists }}
                resolveRow={(row, lk) => {
                  const errors: string[] = [];
                  const data = { ...row };

                  if (data.advisor_name && lk.advisors) {
                    const found = lk.advisors.find(a =>
                      a.name.toLowerCase() === String(data.advisor_name).toLowerCase() ||
                      (a.display_name && a.display_name.toLowerCase() === String(data.advisor_name).toLowerCase())
                    );
                    if (found) data.advisor_id = found.id;
                  }

                  if (data.playlist_name && lk.playlists) {
                    const found = lk.playlists.find(p =>
                      p.name.toLowerCase() === String(data.playlist_name).toLowerCase()
                    );
                    if (found) data.playlist_id = found.id;
                  }

                  return { data, errors };
                }}
                onImport={async (data) => {
                  try {
                    // Auto-create advisors
                    const advisorNames = [...new Set(
                      data.filter(row => row.advisor_name && !row.advisor_id)
                        .map(row => String(row.advisor_name).trim()).filter(Boolean)
                    )];
                    const advisorMap: Record<string, string> = {};
                    if (advisorNames.length > 0) {
                      const { data: existing } = await supabase.from('advisors').select('id, name, display_name');
                      const map = new Map<string, string>();
                      (existing || []).forEach(a => {
                        map.set(a.name.toLowerCase(), a.id);
                        if (a.display_name) map.set(a.display_name.toLowerCase(), a.id);
                      });
                      const toCreate = advisorNames.filter(n => !map.has(n.toLowerCase()));
                      if (toCreate.length > 0) {
                        const { data: created } = await supabase.from('advisors').insert(toCreate.map(name => ({ name }))).select('id, name');
                        if (created) created.forEach(a => map.set(a.name.toLowerCase(), a.id));
                        toast.success(`Создано ${toCreate.length} новых духовников`);
                      }
                      map.forEach((id, name) => { advisorMap[name] = id; });
                    }

                    // Auto-create playlists
                    const playlistNames = [...new Set(
                      data.filter(row => row.playlist_name && !row.playlist_id)
                        .map(row => String(row.playlist_name).trim()).filter(Boolean)
                    )];
                    const playlistMap: Record<string, string> = {};
                    if (playlistNames.length > 0) {
                      const { data: existing } = await supabase.from('playlists').select('id, name');
                      const map = new Map((existing || []).map(p => [p.name.toLowerCase(), p.id]));
                      const toCreate = playlistNames.filter(n => !map.has(n.toLowerCase()));
                      if (toCreate.length > 0) {
                        const { data: created } = await supabase.from('playlists').insert(toCreate.map(name => ({ name }))).select('id, name');
                        if (created) created.forEach(p => map.set(p.name.toLowerCase(), p.id));
                        toast.success(`Создано ${toCreate.length} новых плейлистов`);
                      }
                      map.forEach((id, name) => { playlistMap[name] = id; });
                    }

                    const transformed = data.map(row => {
                      const result: Record<string, any> = { ...row };

                      // Resolve names to IDs
                      if (result.advisor_name && !result.advisor_id) {
                        result.advisor_id = advisorMap[String(result.advisor_name).toLowerCase().trim()] || null;
                      }
                      if (result.playlist_name && !result.playlist_id) {
                        result.playlist_id = playlistMap[String(result.playlist_name).toLowerCase().trim()] || null;
                      }

                      // Integer fields
                      for (const f of ['question_id', 'video_number', 'relevance_score', 'video_duration']) {
                        if (result[f] !== undefined && result[f] !== '') {
                          result[f] = parseInt(String(result[f]), 10);
                          if (isNaN(result[f])) delete result[f];
                        }
                      }

                      // Normalize safety_score
                      if (result.safety_score) {
                        const s = String(result.safety_score).toLowerCase().replace(/[✅⚠️🔴❌🚫]/g, '').trim();
                        if (s.includes('безопасно') || s === 'safe') result.safety_score = 'safe';
                        else if (s.includes('критич') || s === 'critical') result.safety_score = 'critical';
                        else if (s.includes('средн') || s === 'medium') result.safety_score = 'medium_risk';
                        else if (s.includes('высок') || s === 'high') result.safety_score = 'high_risk';
                      }

                      // Normalize question_status — default to in_progress for imports
                      if (result.question_status) {
                        const st = String(result.question_status).toLowerCase().trim();
                        if (st.includes('работ') || st === 'in_progress') result.question_status = 'in_progress';
                        else if (st.includes('опубликован') || st === 'published') result.question_status = 'published';
                        else result.question_status = 'in_progress';
                      } else {
                        result.question_status = 'in_progress';
                      }

                      // Date field
                      if (result.publication_date !== undefined) {
                        const dateStr = String(result.publication_date).trim();
                        if (dateStr === '') { delete result.publication_date; }
                        else {
                          const parsed = new Date(dateStr);
                          if (!isNaN(parsed.getTime())) result.publication_date = parsed.toISOString();
                          else delete result.publication_date;
                        }
                      }

                      // Set question_eng from question
                      if (!result.question_eng && result.question) result.question_eng = result.question;

                      // Remove virtual fields
                      delete result.playlist_name;
                      delete result.playlist_rus;
                      delete result.advisor_name;
                      delete result._ignore;

                      // Sanitize empty strings to null
                      for (const key of Object.keys(result)) {
                        if (typeof result[key] === 'string' && result[key].trim() === '') result[key] = null;
                      }

                      return result;
                    }).filter(row => row.video_number !== undefined && row.video_number !== null);

                    if (transformed.length === 0) {
                      toast.error('Нет валидных строк: проверьте маппинг поля ID Ролика');
                      return;
                    }

                    await bulkImport(transformed);
                    
                    // Auto-update question_status to 'in_progress' for all matching question_ids
                    const questionIds = [...new Set(
                      transformed
                        .filter(row => row.question_id !== undefined && row.question_id !== null)
                        .map(row => row.question_id as number)
                    )];
                    if (questionIds.length > 0) {
                      const { error: statusError } = await supabase
                        .from('videos')
                        .update({ question_status: 'in_progress' })
                        .in('question_id', questionIds)
                        .neq('question_status', 'in_progress');
                      if (statusError) console.error('Failed to update question statuses:', statusError);
                    }
                    
                    await Promise.all([refetchAllVideos(), refetchVideos()]);
                  } catch (error: any) {
                    console.error('Video import error:', error);
                    toast.error(`Ошибка импорта: ${error.message || 'Unknown error'}`);
                  }
                }}
              />
              <VideoDetailModal
                open={showVideoDetail}
                onOpenChange={(open) => { setShowVideoDetail(open); if (!open) setViewingVideoId(null); }}
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
                onOpenChange={(open) => { setShowSidePanel(open); if (!open) setViewingVideoId(null); }}
                advisors={advisors}
                publishingChannels={publishingChannels}
                onGenerateAtmosphere={handleGenerateAtmosphere}
                onGenerateCover={handleGenerateCover}
                onGenerateVoiceover={handleGenerateVoiceover}
                onGenerateVideo={(video) => { setShowVideoDetail(true); }}
                onUpdateVideo={updateVideo}
                onPublish={handlePublishVideo}
                isGenerating={isGenerating}
                onPrev={viewingVideo ? (() => {
                  const idx = videos.findIndex(v => v.id === viewingVideo.id);
                  if (idx > 0) setViewingVideoId(videos[idx - 1].id);
                }) : undefined}
                onNext={viewingVideo ? (() => {
                  const idx = videos.findIndex(v => v.id === viewingVideo.id);
                  if (idx < videos.length - 1) setViewingVideoId(videos[idx + 1].id);
                }) : undefined}
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
              onBulkImport={async (data) => {
                const { error } = await supabase
                  .from('playlists')
                  .upsert(data.map((item: any) => ({
                    name: item.name!,
                    description: item.description || null,
                    scene_prompt: item.scene_prompt || null,
                  })), { onConflict: 'name' });
                if (error) throw error;
                toast.success(`Импортировано ${data.length} плейлистов`);
                window.location.reload();
              }}
            />
          )}

          {activeTab === 'questions' && (
            <QuestionsTable
              videos={allVideos}
              publications={publications}
              loading={allVideosLoading}
              playlists={playlists}
              advisors={advisors}
              onGoToVideos={() => setActiveTab('videos')}
              onUpdateQuestion={async (uniqueKey, updates) => {
                const questionId = parseInt(uniqueKey);
                const videosToUpdate = allVideos.filter(v => v.question_id === questionId);
                if (videosToUpdate.length === 0) return;
                
                // Build the update payload, including playlist_id if provided
                const updatePayload: Partial<Video> = { ...updates };
                
                await bulkUpdateAll(
                  videosToUpdate.map(v => ({ id: v.id, data: updatePayload })),
                  { silent: true }
                );
                // No toast - silent update
                
                // Refetch both video lists so Videos tab sees updated data
                await Promise.all([refetchAllVideos(), refetchVideos()]);
                
                // Check auto-generation conditions after update
                if (updates.question_status || updates.publication_date) {
                  triggerAutoGeneration(uniqueKey);
                }
              }}
              onDeleteQuestion={async (uniqueKey) => {
                const questionId = parseInt(uniqueKey);
                const videosToDelete = allVideos.filter(v => v.question_id === questionId);
                
                if (videosToDelete.length > 0) {
                  const { error } = await supabase
                    .from('videos')
                    .delete()
                    .in('id', videosToDelete.map(v => v.id));
                  if (error) throw error;
                  await Promise.all([refetchAllVideos(), refetchVideos()]);
                }
              }}
              onBulkUpdateStatus={async (uniqueKeys, status) => {
                const updates: { id: string; data: Partial<Video> }[] = [];
                for (const uniqueKey of uniqueKeys) {
                  const questionId = parseInt(uniqueKey);
                  const videosToUpdate = allVideos.filter(v => v.question_id === questionId);
                  videosToUpdate.forEach(v => updates.push({ id: v.id, data: { question_status: status } }));
                }
                if (updates.length > 0) {
                  await bulkUpdateAll(updates, { silent: true });
                }
                // Refetch both lists and check auto-generation
                await Promise.all([refetchAllVideos(), refetchVideos()]);
                if (status === 'in_progress') {
                  for (const uniqueKey of uniqueKeys) {
                    triggerAutoGeneration(uniqueKey);
                  }
                }
              }}
              onBulkUpdateDate={async (uniqueKeys, date) => {
                const updates: { id: string; data: Partial<Video> }[] = [];
                for (const uniqueKey of uniqueKeys) {
                  const questionId = parseInt(uniqueKey);
                  const videosToUpdate = allVideos.filter(v => v.question_id === questionId);
                  videosToUpdate.forEach(v => updates.push({ id: v.id, data: { publication_date: date } }));
                }
                if (updates.length > 0) {
                  await bulkUpdateAll(updates, { silent: true });
                }
                // Refetch both lists and check auto-generation
                await Promise.all([refetchAllVideos(), refetchVideos()]);
                for (const uniqueKey of uniqueKeys) {
                  triggerAutoGeneration(uniqueKey);
                }
              }}
              onBulkImport={async (data) => {
                await bulkImport(data);
                await Promise.all([refetchAllVideos(), refetchVideos()]);
              }}
            />
          )}

          {activeTab === 'scenes' && <ScenesMatrix />}

          {activeTab === 'publications-list' && (
            <div className="space-y-6">
              <Tabs value={publicationsTab} onValueChange={setPublicationsTab}>
                <TabsList>
                  <TabsTrigger value="by-channel">По каналам</TabsTrigger>
                  <TabsTrigger value="by-question">По вопросам</TabsTrigger>
                  <TabsTrigger value="kanban">Канбан</TabsTrigger>
                </TabsList>
                <TabsContent value="by-channel" className="mt-4">
                  <PublicationsTable groupBy="channel" />
                </TabsContent>
                <TabsContent value="by-question" className="mt-4">
                  <PublicationsTable groupBy="question" />
                </TabsContent>
                <TabsContent value="kanban" className="mt-4">
                  <PublishingKanban />
                </TabsContent>
              </Tabs>
            </div>
          )}

          
          {activeTab === 'channels' && <PublishingChannelsGrid />}
          {activeTab === 'proxies' && <ProxyServersGrid />}
          {activeTab === 'prompts' && <PromptsPage />}

          {activeTab === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}
