import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreVertical, Edit, Trash2, Instagram, Youtube, Globe, Facebook, FileSpreadsheet } from 'lucide-react';
import { PublishingChannel, usePublishingChannels } from '@/hooks/usePublishingChannels';
import { Textarea } from '@/components/ui/textarea';
import { CsvImporter } from '@/components/import/CsvImporter';
import { CHANNEL_COLUMN_MAPPING, CHANNEL_PREVIEW_COLUMNS, CHANNEL_FIELD_DEFINITIONS } from '@/components/import/importConfigs';

const networkIcons: Record<string, React.ElementType> = {
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  tiktok: Globe,
  website: Globe,
};

const networkLabels: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  website: 'Website',
};

export function PublishingChannelsGrid() {
  const { channels, loading, addChannel, updateChannel, deleteChannel, bulkImport } = usePublishingChannels();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [editingChannel, setEditingChannel] = useState<PublishingChannel | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    network_type: 'instagram',
    proxy_server: '',
    location: '',
    post_text_prompt: '',
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      network_type: 'instagram',
      proxy_server: '',
      location: '',
      post_text_prompt: '',
      is_active: true,
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
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) return;

    try {
      if (editingChannel) {
        await updateChannel(editingChannel.id, formData);
      } else {
        await addChannel(formData);
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving channel:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Удалить канал публикации?')) {
      await deleteChannel(id);
    }
  };

  const handleToggleActive = async (channel: PublishingChannel) => {
    await updateChannel(channel.id, { is_active: !channel.is_active });
  };

  const handleImport = async (data: Record<string, any>[]) => {
    await bulkImport(data as Partial<PublishingChannel>[]);
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Добавить канал
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingChannel ? 'Редактировать канал' : 'Новый канал публикации'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Название</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Мой Instagram"
                  />
                </div>
                <div>
                  <Label>Тип сети</Label>
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
                <div>
                  <Label>Прокси-сервер</Label>
                  <Input
                    value={formData.proxy_server}
                    onChange={(e) => setFormData({ ...formData, proxy_server: e.target.value })}
                    placeholder="proxy.example.com:8080"
                  />
                </div>
                <div>
                  <Label>Локация</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="USA, New York"
                  />
                </div>
                <div>
                  <Label>Промт для генерации текста поста</Label>
                  <Textarea
                    value={formData.post_text_prompt}
                    onChange={(e) => setFormData({ ...formData, post_text_prompt: e.target.value })}
                    placeholder="Напиши привлекательный текст для Instagram поста о..."
                    rows={4}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Активен</Label>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
                <Button onClick={handleSubmit} className="w-full">
                  {editingChannel ? 'Сохранить' : 'Добавить'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {channels.length === 0 ? (
        <Card className="glass-card">
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
          {channels.map((channel) => {
            const Icon = networkIcons[channel.network_type] || Globe;
            return (
              <Card key={channel.id} className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{channel.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {networkLabels[channel.network_type]}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenDialog(channel)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Редактировать
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(channel.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {channel.location && (
                      <p className="text-sm text-muted-foreground">
                        📍 {channel.location}
                      </p>
                    )}
                    {channel.proxy_server && (
                      <p className="text-sm text-muted-foreground">
                        🔒 Прокси: {channel.proxy_server}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <Badge variant={channel.is_active ? 'default' : 'secondary'}>
                        {channel.is_active ? 'Активен' : 'Неактивен'}
                      </Badge>
                      <Switch
                        checked={channel.is_active}
                        onCheckedChange={() => handleToggleActive(channel)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
