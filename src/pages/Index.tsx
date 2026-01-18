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
import { useAdvisors } from '@/hooks/useAdvisors';
import { usePlaylists } from '@/hooks/usePlaylists';
import { useVideos, Video, VideoFilters } from '@/hooks/useVideos';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';
import { Users, ListVideo, Video as VideoIcon, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const headerTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Дашборд', subtitle: 'Общая статистика' },
  advisors: { title: 'Духовники', subtitle: 'Управление аватарами и настройками' },
  videos: { title: 'Ролики', subtitle: 'Все видео с духовниками' },
  playlists: { title: 'Плейлисты', subtitle: 'Группировка видео по категориям' },
};

export default function Index() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [videoFilters, setVideoFilters] = useState<VideoFilters>({});
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [viewingVideo, setViewingVideo] = useState<Video | null>(null);
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [showVideoDetail, setShowVideoDetail] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const { advisors, loading: advisorsLoading, addAdvisor, updateAdvisor, deleteAdvisor, addPhoto, deletePhoto, setPrimaryPhoto, updatePhotoAssetId } = useAdvisors();
  const { playlists, loading: playlistsLoading, addPlaylist, updatePlaylist, deletePlaylist } = usePlaylists();
  const { videos, loading: videosLoading, addVideo, updateVideo, deleteVideo, refetch: refetchVideos, bulkImport } = useVideos(videoFilters);
  
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
    toast.info('Генерация обложки будет реализована');
  };

  const handleViewVideo = (video: Video) => {
    setViewingVideo(video);
    setShowVideoDetail(true);
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
        </div>
      </main>
    </div>
  );
}
