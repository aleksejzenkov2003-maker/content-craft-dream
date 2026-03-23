import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Plus, Trash2, ChevronRight, ChevronDown, Film, Image as ImageIcon, Pencil } from 'lucide-react';
import { useBackgroundVideos, BackgroundVideo } from '@/hooks/useBackgroundVideos';
import { useAdvisors } from '@/hooks/useAdvisors';
import { usePlaylists } from '@/hooks/usePlaylists';
import { FileUploader } from '@/components/upload/FileUploader';
import { MediaPreview } from '@/components/ui/media-preview';

export function BackgroundVideosGrid() {
  const { backgrounds, assignments, loading, addBackground, updateBackground, deleteBackground, saveAssignments } = useBackgroundVideos();
  const { advisors, loading: advisorsLoading } = useAdvisors();
  const { playlists, loading: playlistsLoading } = usePlaylists();

  const [editingBg, setEditingBg] = useState<BackgroundVideo | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [title, setTitle] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set());
  const [expandedPlaylists, setExpandedPlaylists] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const isLoading = loading || advisorsLoading || playlistsLoading;

  // Build assignment count per background
  const assignmentCounts = useMemo(() => {
    const map = new Map<string, number>();
    assignments.forEach(a => {
      map.set(a.background_id, (map.get(a.background_id) || 0) + 1);
    });
    return map;
  }, [assignments]);

  const openNew = () => {
    setIsNew(true);
    setEditingBg(null);
    setTitle('');
    setMediaUrl('');
    setMediaType('video');
    setSelectedPairs(new Set());
    setExpandedPlaylists(new Set());
  };

  const openEdit = (bg: BackgroundVideo) => {
    setIsNew(false);
    setEditingBg(bg);
    setTitle(bg.title || '');
    setMediaUrl(bg.media_url);
    setMediaType(bg.media_type === 'image' ? 'image' : 'video');
    // Load existing assignments
    const pairs = new Set<string>();
    assignments.filter(a => a.background_id === bg.id).forEach(a => {
      if (a.playlist_id && a.advisor_id) pairs.add(`${a.playlist_id}-${a.advisor_id}`);
    });
    setSelectedPairs(pairs);
    setExpandedPlaylists(new Set());
  };

  const togglePair = (playlistId: string, advisorId: string) => {
    const key = `${playlistId}-${advisorId}`;
    setSelectedPairs(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const togglePlaylistAll = (playlistId: string) => {
    const allKeys = advisors.map(a => `${playlistId}-${a.id}`);
    const allSelected = allKeys.every(k => selectedPairs.has(k));
    setSelectedPairs(prev => {
      const next = new Set(prev);
      allKeys.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  };

  const handleSave = async () => {
    if (!mediaUrl) return;
    setSaving(true);
    try {
      let bgId: string;
      if (isNew) {
        // Create background first, then fetch to get id
        await addBackground({ media_url: mediaUrl, media_type: mediaType, title: title || undefined });
        // Get the newly created background (latest one)
        const { data } = await (await import('@/integrations/supabase/client')).supabase
          .from('background_videos' as any)
          .select('id')
          .eq('media_url', mediaUrl)
          .order('created_at', { ascending: false })
          .limit(1) as any;
        bgId = data?.[0]?.id;
      } else {
        bgId = editingBg!.id;
        await updateBackground(bgId, { title: title || undefined, media_url: mediaUrl, media_type: mediaType });
      }

      // Save assignments
      if (bgId) {
        const pairs = Array.from(selectedPairs).map(key => {
          const [pid, aid] = key.split('-');
          return { playlist_id: pid, advisor_id: aid };
        });
        await saveAssignments(bgId, pairs);
      }

      setEditingBg(null);
      setIsNew(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить подложку и все назначения?')) return;
    await deleteBackground(id);
  };

  const handleUpload = (url: string, file: File) => {
    setMediaUrl(url);
    setMediaType(file.type.startsWith('image/') ? 'image' : 'video');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const showDialog = isNew || editingBg !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{backgrounds.length} подложек</h3>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Новая подложка
        </Button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {backgrounds.map(bg => (
          <div key={bg.id} className="rounded-lg border bg-card overflow-hidden group relative">
            <div className="px-2 py-1.5 text-xs font-medium truncate text-center border-b bg-muted/30">
              {bg.title || 'Без названия'}
            </div>
            <div className="relative aspect-[9/16] bg-muted cursor-pointer" onClick={() => openEdit(bg)}>
              {bg.media_type === 'image' ? (
                <img src={bg.media_url} className="w-full h-full object-cover" alt={bg.title || ''} />
              ) : (
                <video src={bg.media_url} className="w-full h-full object-cover" muted preload="metadata" />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Pencil className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="px-2 py-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {bg.media_type === 'image' ? <ImageIcon className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                {assignmentCounts.get(bg.id) || 0} назн.
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(bg.id); }}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Create dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setEditingBg(null); setIsNew(false); } }}>
         <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Новая подложка' : 'Редактировать подложку'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 min-h-0 flex-1 overflow-hidden">
            {/* Left: media */}
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Название подложки" />
              </div>
              <div className="space-y-2">
                <Label>Файл (видео или фото)</Label>
                {mediaUrl ? (
                  <div className="space-y-2">
                    <div className="w-full rounded-lg overflow-hidden bg-muted border border-border/50">
                      {mediaType === 'image' ? (
                        <img src={mediaUrl} alt={title || ''} className="w-full h-auto object-contain max-h-[60vh]" />
                      ) : (
                        <video src={mediaUrl} className="w-full h-auto max-h-[60vh]" controls muted preload="metadata" />
                      )}
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setMediaUrl('')}>
                      Заменить файл
                    </Button>
                  </div>
                ) : (
                  <FileUploader
                    accept="video/*,image/*"
                    maxSize={200}
                    folder="backgrounds"
                    onUpload={handleUpload}
                    placeholder="Загрузите видео или фото"
                  />
                )}
              </div>
            </div>

            {/* Right: assignments */}
            <div className="space-y-2 flex flex-col min-h-0">
              <Label>Назначения (плейлист → духовник)</Label>
              <div className="flex-1 overflow-y-auto border rounded-lg p-2 space-y-1">
                {playlists.map(p => {
                  const allKeys = advisors.map(a => `${p.id}-${a.id}`);
                  const allSelected = allKeys.length > 0 && allKeys.every(k => selectedPairs.has(k));
                  const someSelected = allKeys.some(k => selectedPairs.has(k));
                  const isExpanded = expandedPlaylists.has(p.id);

                  return (
                    <Collapsible key={p.id} open={isExpanded} onOpenChange={() => {
                      setExpandedPlaylists(prev => {
                        const next = new Set(prev);
                        next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                        return next;
                      });
                    }}>
                      <div className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/50">
                        <Checkbox
                          checked={allSelected}
                          // @ts-ignore
                          indeterminate={someSelected && !allSelected}
                          onCheckedChange={() => togglePlaylistAll(p.id)}
                        />
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-1 flex-1 text-sm text-left">
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            {p.name}
                          </button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <div className="pl-7 space-y-0.5">
                          {advisors.map(a => (
                            <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded">
                              <Checkbox
                                checked={selectedPairs.has(`${p.id}-${a.id}`)}
                                onCheckedChange={() => togglePair(p.id, a.id)}
                              />
                              {a.display_name || a.name}
                            </label>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Выбрано: {selectedPairs.size} комбинаций</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingBg(null); setIsNew(false); }}>Отмена</Button>
            <Button onClick={handleSave} disabled={!mediaUrl || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
