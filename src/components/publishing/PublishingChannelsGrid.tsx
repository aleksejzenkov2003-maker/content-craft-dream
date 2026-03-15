import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Globe, FileSpreadsheet, Image, Trash2 } from 'lucide-react';
import { FileUploader } from '@/components/upload/FileUploader';
import { PublishingChannel, usePublishingChannels } from '@/hooks/usePublishingChannels';
import { CsvImporter } from '@/components/import/CsvImporter';
import { CHANNEL_COLUMN_MAPPING, CHANNEL_PREVIEW_COLUMNS, CHANNEL_FIELD_DEFINITIONS } from '@/components/import/importConfigs';
import { usePrompts } from '@/hooks/usePrompts';
import { useProxyServers } from '@/hooks/useProxyServers';

const networkLabels: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  website: 'Website',
};

export function PublishingChannelsGrid() {
  const { channels, loading, addChannel, updateChannel, deleteChannel, bulkImport } = usePublishingChannels();
  const { prompts } = usePrompts();
  const { proxies } = useProxyServers();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [editingChannel, setEditingChannel] = useState<PublishingChannel | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    network_type: 'instagram',
    is_active: true,
    back_cover_url: '',
    back_cover_video_url: '',
    upload_post_user: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      network_type: 'instagram',
      is_active: true,
      back_cover_url: '',
      back_cover_video_url: '',
    });
    setEditingChannel(null);
  };

  const handleOpenDialog = (channel?: PublishingChannel) => {
    if (channel) {
      setEditingChannel(channel);
      setFormData({
        name: channel.name,
        network_type: channel.network_type,
        is_active: channel.is_active,
        back_cover_url: channel.back_cover_url || '',
        back_cover_video_url: channel.back_cover_video_url || '',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) return;
    try {
      const payload = {
        name: formData.name,
        network_type: formData.network_type,
        is_active: formData.is_active,
        back_cover_url: formData.back_cover_url || null,
        back_cover_video_url: formData.back_cover_video_url || null,
      };
      if (editingChannel) {
        await updateChannel(editingChannel.id, payload);
      } else {
        await addChannel(payload);
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving channel:', error);
    }
  };

  const handleToggleActive = async (channel: PublishingChannel) => {
    await updateChannel(channel.id, { is_active: !channel.is_active });
  };

  const handleImport = async (data: Record<string, any>[]) => {
    await bulkImport(data as Partial<PublishingChannel>[]);
  };

  const getPromptLabel = (channel: PublishingChannel) => {
    if (channel.prompt_id) {
      const found = prompts.find(p => p.id === channel.prompt_id);
      return found?.name || null;
    }
    return null;
  };

  const getProxyLabel = (channel: PublishingChannel) => {
    if (channel.proxy_id) {
      const found = proxies.find(p => p.id === channel.proxy_id);
      return found?.name || channel.location || null;
    }
    return channel.location || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Каналы публикации</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImporter(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Импорт CSV
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Новый Канал
          </Button>
        </div>
      </div>

      {channels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Нет каналов публикации</p>
            <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить первый канал
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((channel) => (
            <Card
              key={channel.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleOpenDialog(channel)}
            >
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="flex-1 space-y-2 min-w-0">
                    <h4 className="font-semibold text-base truncate">{channel.name}</h4>
                    <div className="flex flex-col gap-1.5">
                      {(() => {
                        const label = getPromptLabel(channel);
                        return label ? (
                          <Badge variant="destructive" className="text-xs w-fit">
                            Промт: {label}
                          </Badge>
                        ) : null;
                      })()}
                      {(() => {
                        const label = getProxyLabel(channel);
                        return label ? (
                          <Badge variant="secondary" className="text-xs w-fit bg-emerald-700 text-white hover:bg-emerald-700">
                            Прокси: {label}
                          </Badge>
                        ) : null;
                      })()}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs">{channel.is_active ? 'Активен' : 'Неактивен'}</span>
                      <Switch
                        checked={channel.is_active}
                        onCheckedChange={() => handleToggleActive(channel)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="w-24 aspect-[9/16] rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border">
                    {channel.back_cover_video_url ? (
                      <video
                        src={channel.back_cover_video_url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                        onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                      />
                    ) : channel.back_cover_url ? (
                      <img
                        src={channel.back_cover_url}
                        alt="Задняя обложка"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit / Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setIsDialogOpen(false); resetForm(); } else { setIsDialogOpen(true); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingChannel ? 'Редактировать канал' : 'Новый канал публикации'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left: fields */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label>Название соцсети</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Мой Instagram"
                />
              </div>
              <div className="space-y-2">
                <Label>Тип соцсети</Label>
                <Select
                  value={formData.network_type}
                  onValueChange={(value) => setFormData({ ...formData, network_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Read-only prompt info */}
              {editingChannel && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Промт</Label>
                  <div className="text-sm">
                    {getPromptLabel(editingChannel) ? (
                      <Badge variant="destructive" className="text-xs">{getPromptLabel(editingChannel)}</Badge>
                    ) : (
                      <span className="text-muted-foreground italic">Не привязан (настраивается в Промтах)</span>
                    )}
                  </div>
                </div>
              )}

              {/* Read-only proxy info */}
              {editingChannel && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Прокси</Label>
                  <div className="text-sm">
                    {getProxyLabel(editingChannel) ? (
                      <Badge variant="secondary" className="text-xs bg-emerald-700 text-white hover:bg-emerald-700">{getProxyLabel(editingChannel)}</Badge>
                    ) : (
                      <span className="text-muted-foreground italic">Не привязан (настраивается в Прокси)</span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm">{formData.is_active ? 'Активен' : 'Неактивен'}</span>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>

            {/* Right: back cover preview */}
            <div className="space-y-3 w-52">
              <div className="text-sm font-medium text-center">Задняя обложка (видео)</div>
              <div className="relative w-48 aspect-[9/16] bg-muted rounded-xl overflow-hidden border-2 border-border">
                {formData.back_cover_video_url ? (
                  <>
                    <video
                      src={formData.back_cover_video_url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                      controls
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => setFormData({ ...formData, back_cover_video_url: '' })}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </>
                ) : (
                  <FileUploader
                    accept="video/mp4,video/quicktime,video/webm,video/*"
                    maxSize={200}
                    folder="back-covers"
                    onUpload={(url) => setFormData({ ...formData, back_cover_video_url: url })}
                    placeholder="Перетащите видео или нажмите"
                    className="w-full h-full"
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Или вставьте URL</Label>
                <Input
                  value={formData.back_cover_video_url}
                  onChange={(e) => setFormData({ ...formData, back_cover_video_url: e.target.value })}
                  placeholder="https://...mp4"
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              {editingChannel ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CsvImporter
        open={showImporter}
        onClose={() => setShowImporter(false)}
        title="Импорт каналов публикации из CSV"
        columnMapping={CHANNEL_COLUMN_MAPPING}
        previewColumns={CHANNEL_PREVIEW_COLUMNS}
        onImport={handleImport}
        requiredFields={['name', 'network_type']}
        fieldDefinitions={CHANNEL_FIELD_DEFINITIONS}
      />
    </div>
  );
}
