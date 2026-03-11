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
  const { channels } = usePublishingChannels();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<ProxyServer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProxyServer | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      if (editingProxy) {
        await updateProxy(editingProxy.id, payload);
      } else {
        await addProxy(payload);
      }
      setIsDialogOpen(false);
      resetForm();
    } catch {}
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteProxy(deleteTarget.id);
    setDeleteTarget(null);
  };

  // Get channels linked to a proxy
  const getLinkedChannels = (proxyId: string): PublishingChannel[] => {
    return channels.filter(ch => (ch as any).proxy_id === proxyId);
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
        <DialogContent className="max-w-md">
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
              <Label>Протокол</Label>
              <Select value={formData.protocol} onValueChange={(v) => setFormData({ ...formData, protocol: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HTTP">HTTP</SelectItem>
                  <SelectItem value="HTTPS">HTTPS</SelectItem>
                  <SelectItem value="SOCKS5">SOCKS5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{formData.is_active ? 'Активен' : 'Неактивен'}</span>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

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
