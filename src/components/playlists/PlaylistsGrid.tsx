import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Playlist } from '@/hooks/usePlaylists';
import { Plus, Trash2, Edit, Loader2, ListVideo } from 'lucide-react';

interface PlaylistsGridProps {
  playlists: Playlist[];
  loading: boolean;
  onAddPlaylist: (data: { name: string; description?: string }) => Promise<any>;
  onUpdatePlaylist: (id: string, updates: Partial<Playlist>) => Promise<void>;
  onDeletePlaylist: (id: string) => Promise<void>;
  onSelectPlaylist?: (playlist: Playlist) => void;
}

export function PlaylistsGrid({
  playlists,
  loading,
  onAddPlaylist,
  onUpdatePlaylist,
  onDeletePlaylist,
  onSelectPlaylist,
}: PlaylistsGridProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddPlaylist({ name: newName, description: newDescription || undefined });
      setNewName('');
      setNewDescription('');
      setShowAddDialog(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingPlaylist) return;
    setIsSubmitting(true);
    try {
      await onUpdatePlaylist(editingPlaylist.id, {
        name: editingPlaylist.name,
        description: editingPlaylist.description,
      });
      setEditingPlaylist(null);
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Плейлисты ({playlists.length})</h2>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Новый плейлист
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый плейлист</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Prayer & God"
                />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Описание плейлиста..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Отмена
              </Button>
              <Button onClick={handleAdd} disabled={isSubmitting || !newName.trim()}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {playlists.map((playlist) => (
          <Card
            key={playlist.id}
            className="hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => onSelectPlaylist?.(playlist)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{playlist.name}</CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPlaylist(playlist);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePlaylist(playlist.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {playlist.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {playlist.description}
                </p>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ListVideo className="w-4 h-4" />
                <span>{playlist.video_count} видео</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingPlaylist} onOpenChange={(open) => !open && setEditingPlaylist(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать плейлист</DialogTitle>
          </DialogHeader>
          {editingPlaylist && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  value={editingPlaylist.name}
                  onChange={(e) => setEditingPlaylist({ ...editingPlaylist, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={editingPlaylist.description || ''}
                  onChange={(e) => setEditingPlaylist({ ...editingPlaylist, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlaylist(null)}>
              Отмена
            </Button>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
