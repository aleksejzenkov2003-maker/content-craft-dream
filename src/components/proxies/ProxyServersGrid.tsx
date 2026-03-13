import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Server, Copy, Trash2, Eye, EyeOff } from 'lucide-react';
import { ProxyServer, useProxyServers } from '@/hooks/useProxyServers';
import { usePublishingChannels, PublishingChannel } from '@/hooks/usePublishingChannels';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const networkColors: Record<string, string> = {
  youtube: 'bg-red-600 text-white hover:bg-red-600',
  instagram: 'bg-pink-600 text-white hover:bg-pink-600',
  facebook: 'bg-blue-600 text-white hover:bg-blue-600',
  tiktok: 'bg-zinc-800 text-white hover:bg-zinc-800',
  website: 'bg-emerald-600 text-white hover:bg-emerald-600',
};

const networkPrefixes: Record<string, string> = {
  youtube: 'Yt',
  instagram: 'Ig',
  facebook: 'Fb',
  tiktok: 'Tk',
  website: 'Web',
};

function CopyField({ label, value }: { label: string; value: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast.success('Скопировано');
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-1">
        <Input value={value} readOnly className="text-sm font-mono" />
        <Button variant="outline" size="icon" className="shrink-0" onClick={handleCopy}>
          <Copy className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function ProxyServersGrid() {
  const { proxies, loading, addProxy, updateProxy, deleteProxy } = useProxyServers();
  const { channels, refetch: refetchChannels } = usePublishingChannels();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<ProxyServer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProxyServer | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [linkedChannelIds, setLinkedChannelIds] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    login: '',
    password: '',
    server: '',
    port: 8080,
    protocol: 'HTTP',
    is_active: true,
  });

  const resetForm = () => {
    setFormData({ name: '', login: '', password: '', server: '', port: 8080, protocol: 'HTTP', is_active: true });
    setEditingProxy(null);
    setShowPassword(false);
    setLinkedChannelIds([]);
  };

  const handleOpenDialog = (proxy?: ProxyServer) => {
    if (proxy) {
      setEditingProxy(proxy);
      setFormData({
        name: proxy.name,
        login: proxy.login || '',
        password: proxy.password || '',
        server: proxy.server,
        port: proxy.port,
        protocol: proxy.protocol,
        is_active: proxy.is_active,
      });
      setLinkedChannelIds(channels.filter(ch => ch.proxy_id === proxy.id).map(ch => ch.id));
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.server) return;
    try {
      const payload = {
        ...formData,
        login: formData.login || null,
        password: formData.password || null,
      };

      let proxyId = editingProxy?.id;

      if (editingProxy) {
        await updateProxy(editingProxy.id, payload);
      } else {
        // For new proxy, we need to get the id after insert
        const { data, error } = await supabase
          .from('proxy_servers')
          .insert({
            name: payload.name,
            login: payload.login,
            password: payload.password,
            server: payload.server,
            port: payload.port || 8080,
            protocol: payload.protocol || 'HTTP',
            is_active: payload.is_active ?? true,
          })
          .select('id')
          .single();
        if (error) throw error;
        proxyId = data.id;
        toast.success('Прокси добавлен');
      }

      // Update channel bindings
      if (proxyId) {
        const proxyString = `${formData.server}:${formData.port}`;
        const previouslyLinked = channels.filter(ch => ch.proxy_id === proxyId).map(ch => ch.id);
        const toLink = linkedChannelIds.filter(id => !previouslyLinked.includes(id));
        const toUnlink = previouslyLinked.filter(id => !linkedChannelIds.includes(id));

        // Link new channels
        for (const chId of toLink) {
          await supabase
            .from('publishing_channels')
            .update({ proxy_id: proxyId, proxy_server: proxyString, location: formData.name })
            .eq('id', chId);
        }

        // Unlink removed channels
        for (const chId of toUnlink) {
          await supabase
            .from('publishing_channels')
            .update({ proxy_id: null, proxy_server: null, location: null })
            .eq('id', chId);
        }

        if (toLink.length > 0 || toUnlink.length > 0) {
          await refetchChannels();
        }
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving proxy:', error);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteProxy(deleteTarget.id);
    setDeleteTarget(null);
  };

  const getLinkedChannels = (proxyId: string): PublishingChannel[] => {
    return channels.filter(ch => ch.proxy_id === proxyId);
  };

  // Group channels by network type for the binding UI
  const channelsByNetwork = channels.reduce<Record<string, PublishingChannel[]>>((acc, ch) => {
    const key = ch.network_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ch);
    return acc;
  }, {});

  const toggleChannel = (channelId: string) => {
    setLinkedChannelIds(prev =>
      prev.includes(channelId) ? prev.filter(id => id !== channelId) : [...prev, channelId]
    );
  };

  const toggleAllNetwork = (networkChannels: PublishingChannel[]) => {
    const ids = networkChannels.map(ch => ch.id);
    const allSelected = ids.every(id => linkedChannelIds.includes(id));
    if (allSelected) {
      setLinkedChannelIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setLinkedChannelIds(prev => [...new Set([...prev, ...ids])]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Прокси-сервера</h2>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Новый Прокси
        </Button>
      </div>

      {proxies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Нет прокси-серверов</p>
            <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить первый прокси
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {proxies.map((proxy) => {
            const linked = getLinkedChannels(proxy.id);
            return (
              <Card
                key={proxy.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleOpenDialog(proxy)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-base truncate">{proxy.name}</h4>
                    <Badge variant={proxy.is_active ? 'default' : 'secondary'} className="text-xs">
                      {proxy.is_active ? 'Активен' : 'Выкл'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {proxy.server}:{proxy.port}
                  </p>
                  {linked.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {linked.map(ch => (
                        <Badge
                          key={ch.id}
                          className={`text-[10px] px-1.5 py-0 ${networkColors[ch.network_type] || 'bg-muted text-muted-foreground'}`}
                        >
                          {networkPrefixes[ch.network_type] || ch.network_type}: {ch.name.length > 10 ? ch.name.slice(0, 10) + '…' : ch.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Нет привязанных каналов</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit / Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setIsDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProxy ? 'Редактировать прокси' : 'Новый прокси-сервер'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название (локация)</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Вашингтон (США)"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>Сервер</Label>
                <Input
                  value={formData.server}
                  onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                  placeholder="proxy.soax.com"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Порт</Label>
                <Input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 8080 })}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Логин</Label>
                <Input
                  value={formData.login}
                  onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                  placeholder="user123"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Пароль</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••"
                    className="font-mono text-sm pr-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-9"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Протоколы</Label>
              <div className="flex gap-4">
                {['HTTP', 'HTTPS', 'SOCKS5'].map(proto => {
                  const protocols = formData.protocol.split(',').map(p => p.trim()).filter(Boolean);
                  const checked = protocols.includes(proto);
                  return (
                    <label key={proto} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(val) => {
                          const updated = val
                            ? [...protocols, proto]
                            : protocols.filter(p => p !== proto);
                          setFormData({ ...formData, protocol: updated.join(', ') || 'HTTP' });
                        }}
                      />
                      {proto}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{formData.is_active ? 'Активен' : 'Неактивен'}</span>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            {/* Channel Binding Section */}
            {channels.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Привязка к каналам</p>
                  <span className="text-xs text-muted-foreground">{linkedChannelIds.length} выбрано</span>
                </div>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {Object.entries(channelsByNetwork).map(([network, networkChannels]) => {
                    const networkIds = networkChannels.map(ch => ch.id);
                    const allSelected = networkIds.every(id => linkedChannelIds.includes(id));
                    const someSelected = networkIds.some(id => linkedChannelIds.includes(id));
                    return (
                      <div key={network} className="space-y-1">
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground">
                          <Checkbox
                            checked={allSelected}
                            // @ts-ignore
                            indeterminate={someSelected && !allSelected}
                            onCheckedChange={() => toggleAllNetwork(networkChannels)}
                          />
                          {network.charAt(0).toUpperCase() + network.slice(1)}
                        </label>
                        <div className="ml-6 space-y-1">
                          {networkChannels.map(ch => (
                            <label key={ch.id} className="flex items-center gap-2 cursor-pointer text-sm">
                              <Checkbox
                                checked={linkedChannelIds.includes(ch.id)}
                                onCheckedChange={() => toggleChannel(ch.id)}
                              />
                              {ch.name}
                              {ch.proxy_id && ch.proxy_id !== editingProxy?.id && (
                                <span className="text-[10px] text-muted-foreground ml-1">
                                  (другой прокси)
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Copy fields for existing proxy */}
            {editingProxy && (
              <div className="border-t pt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Быстрое копирование</p>
                <CopyField label="Сервер:Порт" value={`${formData.server}:${formData.port}`} />
                {formData.login && <CopyField label="Логин" value={formData.login} />}
                {formData.password && <CopyField label="Пароль" value={formData.password} />}
                <CopyField label="Полная строка" value={`${formData.protocol.toLowerCase()}://${formData.login ? `${formData.login}:${formData.password}@` : ''}${formData.server}:${formData.port}`} />
              </div>
            )}
          </div>
          <DialogFooter className="mt-4 flex gap-2">
            {editingProxy && (
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(editingProxy); setIsDialogOpen(false); }}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Удалить
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>Отмена</Button>
            <Button onClick={handleSubmit} disabled={!formData.name || !formData.server}>
              {editingProxy ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить прокси "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Привязанные каналы потеряют связь с этим прокси. Действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
