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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Globe, FileSpreadsheet, Image } from 'lucide-react';
import { PublishingChannel, usePublishingChannels } from '@/hooks/usePublishingChannels';
import { Textarea } from '@/components/ui/textarea';
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

  const postTextPrompts = prompts.filter(p => p.type === 'post_text');

  const [formData, setFormData] = useState({
    name: '',
    network_type: 'instagram',
    proxy_server: '',
    location: '',
    post_text_prompt: '',
    is_active: true,
    back_cover_url: '',
    back_cover_video_url: '',
    proxy_id: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      network_type: 'instagram',
      proxy_server: '',
      location: '',
      post_text_prompt: '',
      is_active: true,
      back_cover_url: '',
      proxy_id: '',
    });
    setEditingChannel(null);
  };

  const handleOpenDialog = (channel?: PublishingChannel) => {
    if (channel) {
      setEditingChannel(channel);
      setFormData({
        name: channel.name,
        network_type: channel.network_type,
        proxy_server: channel.proxy_server || '',
        location: channel.location || '',
        post_text_prompt: channel.post_text_prompt || '',
        is_active: channel.is_active,
        back_cover_url: channel.back_cover_url || '',
        proxy_id: channel.proxy_id || '',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) return;
    try {
      const selectedProxy = proxies.find(p => p.id === formData.proxy_id);
      const payload = {
        ...formData,
        back_cover_url: formData.back_cover_url || null,
        proxy_server: selectedProxy ? `${selectedProxy.server}:${selectedProxy.port}` : null,
        location: selectedProxy?.name || null,
        post_text_prompt: formData.post_text_prompt || null,
        proxy_id: formData.proxy_id || null,
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

  // Find prompt name by prompt_id or text matching
  const getPromptLabel = (channel: PublishingChannel) => {
    if (channel.prompt_id) {
      const found = prompts.find(p => p.id === channel.prompt_id);
      return found?.name || null;
    }
    if (!channel.post_text_prompt) return null;
    const found = postTextPrompts.find(p => p.system_prompt === channel.post_text_prompt || p.user_template === channel.post_text_prompt);
    return found?.name || (channel.post_text_prompt.length > 30 ? channel.post_text_prompt.slice(0, 30) + '…' : channel.post_text_prompt);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Group channels by network_type
  const grouped = channels.reduce<Record<string, PublishingChannel[]>>((acc, ch) => {
    const key = ch.network_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ch);
    return acc;
  }, {});

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
                  {/* Left: info */}
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
                      {channel.proxy_server && (
                        <Badge variant="secondary" className="text-xs w-fit bg-emerald-700 text-white hover:bg-emerald-700">
                          Прокси: {channel.location || channel.proxy_server}
                        </Badge>
                      )}
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
                  {/* Right: back cover thumbnail */}
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
              <div className="space-y-2">
                <Label>Прокси-сервер</Label>
                <Select
                  value={formData.proxy_id || '__none__'}
                  onValueChange={(value) => setFormData({ ...formData, proxy_id: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Без прокси" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Без прокси</SelectItem>
                    {proxies.filter(p => p.is_active).map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.server}:{p.port})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Промт для генерации текста</Label>
                {postTextPrompts.length > 0 ? (
                  <Select
                    value={formData.post_text_prompt || '__custom__'}
                    onValueChange={(value) => {
                      if (value === '__custom__') {
                        setFormData({ ...formData, post_text_prompt: '' });
                      } else {
                        const p = postTextPrompts.find(pr => pr.id === value);
                        if (p) setFormData({ ...formData, post_text_prompt: p.user_template });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите промт..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__custom__">Свой текст</SelectItem>
                      {postTextPrompts.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Textarea
                  value={formData.post_text_prompt}
                  onChange={(e) => setFormData({ ...formData, post_text_prompt: e.target.value })}
                  placeholder="Напиши привлекательный текст для поста о..."
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">{formData.is_active ? 'Активен' : 'Неактивен'}</span>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>

            {/* Right: back cover preview */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-center">Задняя обложка</div>
              <div className="relative w-48 aspect-[9/16] bg-muted rounded-xl overflow-hidden border-2 border-border">
                {formData.back_cover_url ? (
                  <img
                    src={formData.back_cover_url}
                    alt="Задняя обложка"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL обложки</Label>
                <Input
                  value={formData.back_cover_url}
                  onChange={(e) => setFormData({ ...formData, back_cover_url: e.target.value })}
                  placeholder="https://..."
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
