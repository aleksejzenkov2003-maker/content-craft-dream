import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Plus, Trash2, ChevronRight, ChevronDown, Film } from 'lucide-react';
import { useBackgroundVideos } from '@/hooks/useBackgroundVideos';
import { useAdvisors } from '@/hooks/useAdvisors';
import { usePlaylists } from '@/hooks/usePlaylists';
import { FileUploader } from '@/components/upload/FileUploader';

export function BackgroundVideosGrid() {
  const { backgrounds, loading, addBackground, deleteBackground } = useBackgroundVideos();
  const { advisors, loading: advisorsLoading } = useAdvisors();
  const { playlists, loading: playlistsLoading } = usePlaylists();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [expandedAdvisors, setExpandedAdvisors] = useState<Set<string>>(new Set());
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<string>>(new Set());
  const [selectedAdvisorIds, setSelectedAdvisorIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const isLoading = loading || advisorsLoading || playlistsLoading;

  const bgMap = useMemo(() => {
    const map = new Map<string, typeof backgrounds[0]>();
    backgrounds.forEach(bg => {
      if (bg.playlist_id && bg.advisor_id) {
        map.set(`${bg.playlist_id}-${bg.advisor_id}`, bg);
      }
    });
    return map;
  }, [backgrounds]);

  const toggleAdvisor = (id: string) => {
    setExpandedAdvisors(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!newVideoUrl) return;
    setSaving(true);
    try {
      const pairs: { playlist_id: string; advisor_id: string }[] = [];
      selectedPlaylistIds.forEach(pid => {
        selectedAdvisorIds.forEach(aid => {
          pairs.push({ playlist_id: pid, advisor_id: aid });
        });
      });

      if (pairs.length === 0) {
        // Save without bindings
        await addBackground({ video_url: newVideoUrl, title: newTitle || undefined });
      } else {
        for (const pair of pairs) {
          await addBackground({ ...pair, video_url: newVideoUrl, title: newTitle || undefined });
        }
      }

      setShowAddDialog(false);
      setNewVideoUrl('');
      setNewTitle('');
      setSelectedPlaylistIds(new Set());
      setSelectedAdvisorIds(new Set());
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setExpandedAdvisors(new Set(advisors.map(a => a.id)))}>
            Развернуть всё
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExpandedAdvisors(new Set())}>
            Свернуть всё
          </Button>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" /> Новая подложка
        </Button>
      </div>

      {/* Matrix: advisors as rows, playlists as columns */}
      {advisors.map(advisor => {
        const isExpanded = expandedAdvisors.has(advisor.id);
        const bgCount = backgrounds.filter(b => b.advisor_id === advisor.id).length;
        return (
          <Collapsible key={advisor.id} open={isExpanded} onOpenChange={() => toggleAdvisor(advisor.id)}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="font-medium">{advisor.display_name || advisor.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{bgCount} подложек</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-3">
                {playlists.map(playlist => {
                  const bg = bgMap.get(`${playlist.id}-${advisor.id}`);
                  return (
                    <div key={playlist.id} className="rounded-lg border bg-card overflow-hidden group">
                      <div className="px-2 py-1 text-xs font-medium truncate text-center border-b bg-muted/30">
                        {playlist.name}
                      </div>
                      <div className="relative aspect-video bg-muted">
                        {bg ? (
                          <>
                            <video
                              src={bg.video_url}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                            />
                            <button
                              onClick={() => deleteBackground(bg.id)}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            {bg.title && (
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent pt-4 pb-1 px-2">
                                <span className="text-white text-[10px]">{bg.title}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-6 h-6 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {/* Add dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Новая фоновая подложка</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            {/* Left: upload */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Название подложки" />
              </div>
              <div className="space-y-2">
                <Label>Видео файл</Label>
                <FileUploader
                  accept="video/*"
                  maxSize={200}
                  folder="backgrounds"
                  onUpload={(url) => setNewVideoUrl(url)}
                  placeholder="Загрузите видео подложку"
                />
              </div>
            </div>

            {/* Right: playlist + advisor selection */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Плейлисты</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {playlists.map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded">
                      <Checkbox
                        checked={selectedPlaylistIds.has(p.id)}
                        onCheckedChange={(checked) => {
                          setSelectedPlaylistIds(prev => {
                            const next = new Set(prev);
                            checked ? next.add(p.id) : next.delete(p.id);
                            return next;
                          });
                        }}
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Духовники</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {advisors.map(a => (
                    <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded">
                      <Checkbox
                        checked={selectedAdvisorIds.has(a.id)}
                        onCheckedChange={(checked) => {
                          setSelectedAdvisorIds(prev => {
                            const next = new Set(prev);
                            checked ? next.add(a.id) : next.delete(a.id);
                            return next;
                          });
                        }}
                      />
                      {a.display_name || a.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Отмена</Button>
            <Button onClick={handleSave} disabled={!newVideoUrl || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
