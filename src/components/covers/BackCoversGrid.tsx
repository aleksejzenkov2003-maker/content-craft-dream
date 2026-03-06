import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, Plus, Search, Video, Trash2, Monitor, Upload } from 'lucide-react';
import { usePublishingChannels, PublishingChannel } from '@/hooks/usePublishingChannels';
import { toast } from 'sonner';
import { FileUploader } from '@/components/upload/FileUploader';
import { CsvImporter } from '@/components/import/CsvImporter';
import { BACK_COVER_VIDEO_COLUMN_MAPPING, BACK_COVER_VIDEO_PREVIEW_COLUMNS, BACK_COVER_VIDEO_FIELD_DEFINITIONS } from '@/components/import/importConfigs';
import { normalizeVideoAudio } from '@/lib/videoNormalizer';
import { supabase } from '@/integrations/supabase/client';

export function BackCoversGrid() {
  const { channels, loading, updateChannel } = usePublishingChannels();
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingChannel, setEditingChannel] = useState<PublishingChannel | null>(null);
  const [backCoverVideoUrl, setBackCoverVideoUrl] = useState('');

  const channelsWithBackCovers = channels.filter(
    (c) =>
      c.back_cover_video_url &&
      (search === '' ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.network_type?.toLowerCase().includes(search.toLowerCase()))
  );

  const channelsWithoutBackCovers = channels.filter(
    (c) =>
      !c.back_cover_video_url &&
      (search === '' ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.network_type?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSaveBackCover = async () => {
    if (!editingChannel || !backCoverVideoUrl) return;

    try {
      await updateChannel(editingChannel.id, {
        back_cover_video_url: backCoverVideoUrl,
      } as any);
      toast.success('Задняя обложка (видео) сохранена');
      setShowAddDialog(false);
      setEditingChannel(null);
      setBackCoverVideoUrl('');
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleRemoveBackCover = async (channel: PublishingChannel) => {
    try {
      await updateChannel(channel.id, {
        back_cover_video_url: null,
      } as any);
      toast.success('Задняя обложка удалена');
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const handleImportBackCoverVideos = async (rows: Record<string, any>[]) => {
    let updated = 0;
    for (const row of rows) {
      const videoUrl = row.back_cover_video_url;
      if (!videoUrl) continue;

      const channelNames = row.channel_names
        ? String(row.channel_names).split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean)
        : row.name ? [row.name.trim()] : [];

      for (const chName of channelNames) {
        const ch = channels.find(c => c.name.toLowerCase() === chName.toLowerCase());
        if (ch) {
          try {
            await updateChannel(ch.id, { back_cover_video_url: videoUrl } as any);
            updated++;
          } catch (e) {
            console.error('Error updating channel', chName, e);
          }
        }
      }
    }
    toast.success(`Обновлено ${updated} каналов`);
    setShowImportDialog(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по каналам..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Импорт видео
          </Button>
          <div className="text-sm text-muted-foreground">
            {channelsWithBackCovers.length} из {channels.length} с обложками
          </div>
        </div>
      </div>

      {/* Channels with back covers */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Задние обложки (видео) по каналам</h3>
        {channelsWithBackCovers.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Video className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Нет добавленных задних обложек</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {channelsWithBackCovers.map((channel) => (
              <Card key={channel.id} className="glass-card group overflow-hidden">
                <div className="aspect-[9/16] relative bg-muted">
                  <video
                    src={channel.back_cover_video_url!}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                    onMouseLeave={(e) => {
                      const v = e.target as HTMLVideoElement;
                      v.pause();
                      v.currentTime = 0;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveBackCover(channel)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium truncate">{channel.name}</span>
                  </div>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {channel.network_type}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Channels without back covers */}
      {channelsWithoutBackCovers.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-muted-foreground">
            Без задних обложек ({channelsWithoutBackCovers.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {channelsWithoutBackCovers.map((channel) => (
              <Card
                key={channel.id}
                className="glass-card cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => {
                  setEditingChannel(channel);
                  setBackCoverVideoUrl('');
                  setShowAddDialog(true);
                }}
              >
                <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Plus className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <span className="font-medium">{channel.name}</span>
                  <Badge variant="secondary">{channel.network_type}</Badge>
                  <Badge variant="outline" className="text-xs">Добавить видео-обложку</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Задняя обложка (видео) для канала «{editingChannel?.name}»
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Загрузить видео (mp4, mov, webm)</Label>
            {backCoverVideoUrl ? (
              <div className="space-y-3">
                <video
                  src={backCoverVideoUrl}
                  className="w-full aspect-[9/16] object-cover rounded-lg"
                  controls
                  muted
                />
                <Button variant="outline" size="sm" onClick={() => setBackCoverVideoUrl('')}>
                  Выбрать другое видео
                </Button>
              </div>
            ) : (
              <FileUploader
                accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/*"
                maxSize={200}
                folder="back-covers"
                onUpload={(url) => setBackCoverVideoUrl(url)}
                placeholder="Перетащите видео сюда или нажмите для выбора (mp4, mov, webm)"
              />
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Отмена
              </Button>
              <Button onClick={handleSaveBackCover} disabled={!backCoverVideoUrl}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Back Cover Videos Dialog */}
      <CsvImporter
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        title="Импорт задних обложек (видео)"
        columnMapping={BACK_COVER_VIDEO_COLUMN_MAPPING}
        previewColumns={BACK_COVER_VIDEO_PREVIEW_COLUMNS}
        onImport={handleImportBackCoverVideos}
        fieldDefinitions={BACK_COVER_VIDEO_FIELD_DEFINITIONS}
      />
    </div>
  );
}
