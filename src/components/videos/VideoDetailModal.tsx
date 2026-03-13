import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Video } from '@/hooks/useVideos';
import { Advisor, AdvisorPhoto } from '@/hooks/useAdvisors';
import { VideoPlayer } from './VideoPlayer';
import {
  Play,
  Loader2,
  Image,
  Upload,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface VideoDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: Video | null;
  advisors: Advisor[];
  onUpdateVideo: (id: string, updates: Partial<Video>) => Promise<void>;
  onGenerateVideo: (video: Video, photoAssetId: string) => Promise<void>;
  onUploadPhotoToHeygen: (photo: AdvisorPhoto) => Promise<string | null>;
  isGenerating: boolean;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Ожидает', variant: 'secondary' },
  answer_ready: { label: 'Ответ готов', variant: 'outline' },
  cover_ready: { label: 'Обложка готова', variant: 'outline' },
  generating: { label: 'Генерация...', variant: 'default' },
  ready: { label: 'Готово', variant: 'default' },
  published: { label: 'Опубликовано', variant: 'default' },
  error: { label: 'Ошибка', variant: 'destructive' },
};

export function VideoDetailModal({
  open,
  onOpenChange,
  video,
  advisors,
  onUpdateVideo,
  onGenerateVideo,
  onUploadPhotoToHeygen,
  isGenerating,
}: VideoDetailModalProps) {
  const [activeTab, setActiveTab] = useState('info');
  const [editedScript, setEditedScript] = useState('');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [copied, setCopied] = useState(false);

  // Get advisor and their photos
  const advisor = advisors.find((a) => a.id === video?.advisor_id);
  const photos = advisor?.photos || [];
  const photosWithAssetId = photos.filter((p) => p.heygen_asset_id);

  // Fetch scene images from playlist_scenes
  const [scenePhotos, setScenePhotos] = useState<Array<{ id: string; photo_url: string; label: string }>>([]);
  
  useEffect(() => {
    if (!video?.playlist_id || !video?.advisor_id || !open) {
      setScenePhotos([]);
      return;
    }
    const fetchScenes = async () => {
      const { data } = await supabase
        .from('playlist_scenes')
        .select('id, scene_url')
        .eq('playlist_id', video.playlist_id!)
        .eq('advisor_id', video.advisor_id!)
        .eq('status', 'approved')
        .not('scene_url', 'is', null);
      if (data) {
        setScenePhotos(data.map((s, i) => ({
          id: `scene-${s.id}`,
          photo_url: s.scene_url!,
          label: `Сцена ${i + 1}`,
        })));
      }
    };
    fetchScenes();
  }, [video?.playlist_id, video?.advisor_id, open]);

  // Combine advisor photos + scene photos for selection
  const allPhotos = [
    ...photos.map(p => ({ ...p, label: p.is_primary ? 'Main' : undefined as string | undefined, isScene: false })),
    ...scenePhotos.map(s => ({ id: s.id, photo_url: s.photo_url, heygen_asset_id: null as string | null, is_primary: false, advisor_id: video?.advisor_id || '', created_at: '', label: s.label, isScene: true })),
  ];
  const selectedPhoto = allPhotos.find((p) => p.id === selectedPhotoId) || photosWithAssetId[0] || photos[0];

  // Initialize script when video changes
  const script = editedScript || video?.advisor_answer || '';

  const handleScriptChange = (value: string) => {
    setEditedScript(value);
  };

  const handleSaveScript = async () => {
    if (!video) return;
    await onUpdateVideo(video.id, { advisor_answer: editedScript });
    toast.success('Текст сохранён');
  };

  const handleUploadPhoto = async () => {
    if (!selectedPhoto) return;
    setIsUploadingPhoto(true);
    try {
      const assetId = await onUploadPhotoToHeygen(selectedPhoto);
      if (assetId) {
        toast.success('Фото загружено в HeyGen');
      }
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleGenerate = async () => {
    if (!video) return;
    if (!video.voiceover_url) {
      toast.error('Сначала создайте озвучку');
      return;
    }
    // Photo asset ID will be resolved by the edge function
    const photoAssetId = selectedPhoto?.heygen_asset_id || '';
    await onGenerateVideo(video, photoAssetId);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Скопировано');
  };

  const getStatusBadge = (status: string | null) => {
    const statusInfo = statusLabels[status || 'pending'] || statusLabels.pending;
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-muted-foreground">#{video.video_number}</span>
            {video.video_title || video.question || 'Без заголовка'}
            {getStatusBadge(video.generation_status)}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Информация</TabsTrigger>
            <TabsTrigger value="generate">Генерация</TabsTrigger>
            <TabsTrigger value="video">Видео</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="space-y-4">
            {/* Scene photo */}
            {(() => {
              const sceneFromPlaylist = scenePhotos[0];
              const scenePhoto = sceneFromPlaylist
                ? { url: sceneFromPlaylist.scene_url!, label: 'Сцена' }
                : (() => {
                    const photo = advisor?.photos?.find(p => p.id === advisor?.scene_photo_id) || advisor?.photos?.find(p => p.is_primary) || advisor?.photos?.[0];
                    return photo ? { url: photo.photo_url, label: 'Фото' } : null;
                  })();
              return scenePhoto ? (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Фото сцены</Label>
                  <img
                    src={scenePhoto.url}
                    alt="Scene"
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                </div>
              ) : null;
            })()}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Духовник</Label>
                <div className="font-medium">{advisor?.name || '—'}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Плейлист</Label>
                <div className="font-medium">{video.playlist?.name || '—'}</div>
              </div>
            </div>

            {video.hook && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Хук</Label>
                <div className="p-3 bg-muted rounded-lg">{video.hook}</div>
              </div>
            )}

            {video.question && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Вопрос</Label>
                <div className="p-3 bg-muted rounded-lg">{video.question}</div>
              </div>
            )}

            {video.advisor_answer && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-muted-foreground">Ответ духовника</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(video.advisor_answer || '')}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="p-3 bg-muted rounded-lg whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {video.advisor_answer}
                </div>
              </div>
            )}

            {video.cover_url && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Обложка</Label>
                <img
                  src={video.cover_url}
                  alt="Cover"
                  className="max-w-xs rounded-lg"
                />
              </div>
            )}

            {/* Social links */}
            {(video.tiktok_url || video.youtube_url || video.instagram_url) && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Соцсети</Label>
                <div className="flex gap-2">
                  {video.tiktok_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={video.tiktok_url} target="_blank" rel="noopener noreferrer">
                        TikTok <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                  )}
                  {video.youtube_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={video.youtube_url} target="_blank" rel="noopener noreferrer">
                        YouTube <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                  )}
                  {video.instagram_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={video.instagram_url} target="_blank" rel="noopener noreferrer">
                        Instagram <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Generate Tab */}
          <TabsContent value="generate" className="space-y-4">
            {/* Photo selection */}
            <div className="space-y-2">
              <Label>Фото аватара</Label>
              {allPhotos.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground p-4 border rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span>У духовника нет фотографий. Добавьте фото на странице духовников.</span>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {allPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                        selectedPhotoId === photo.id || (!selectedPhotoId && selectedPhoto?.id === photo.id)
                          ? 'border-primary'
                          : 'border-transparent hover:border-muted-foreground'
                      }`}
                      onClick={() => setSelectedPhotoId(photo.id)}
                    >
                      <img
                        src={photo.photo_url}
                        alt=""
                        className="w-20 h-20 object-cover"
                      />
                      {photo.heygen_asset_id && (
                        <Badge className="absolute bottom-1 right-1 text-xs" variant="default">
                          HeyGen
                        </Badge>
                      )}
                      {photo.label && (
                        <Badge className="absolute top-1 left-1 text-xs" variant="secondary">
                          {photo.label}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedPhoto && !selectedPhoto.heygen_asset_id && (
                <Button
                  variant="outline"
                  onClick={handleUploadPhoto}
                  disabled={isUploadingPhoto}
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Загрузить в HeyGen
                </Button>
              )}
            </div>

            {/* Script */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Текст для озвучки</Label>
                {editedScript && editedScript !== video.advisor_answer && (
                  <Button variant="ghost" size="sm" onClick={handleSaveScript}>
                    Сохранить
                  </Button>
                )}
              </div>
              <Textarea
                value={script}
                onChange={(e) => handleScriptChange(e.target.value)}
                placeholder="Введите текст для озвучки..."
                rows={8}
              />
              <div className="text-sm text-muted-foreground">
                {script.length} символов
              </div>
            </div>

            {/* Generate button */}
            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !video.voiceover_url}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Генерация...
                  </>
                ) : !video.voiceover_url ? (
                  <>
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Сначала создайте озвучку
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Сгенерировать видео
                  </>
                )}
              </Button>
            </div>

            {video.generation_status === 'generating' && (
              <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span>Видео генерируется в HeyGen...</span>
              </div>
            )}

            {video.generation_status === 'error' && (
              <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span>Ошибка генерации. Попробуйте снова.</span>
              </div>
            )}
          </TabsContent>

          {/* Video Tab */}
          <TabsContent value="video" className="space-y-4">
            {video.heygen_video_url ? (
              <div className="space-y-4">
                <VideoPlayer url={video.heygen_video_url} />
                <div className="flex gap-2">
                  <Button variant="outline" asChild>
                    <a href={video.heygen_video_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Открыть
                    </a>
                  </Button>
                  <Button variant="outline" onClick={() => copyToClipboard(video.heygen_video_url || '')}>
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    Копировать URL
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 bg-muted rounded-lg">
                <Image className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Видео ещё не сгенерировано</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setActiveTab('generate')}
                >
                  Перейти к генерации
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
