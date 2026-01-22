import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, Image, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CoverThumbnail {
  id: string;
  video_id: string | null;
  prompt: string | null;
  front_cover_url: string | null;
  back_cover_url: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  video?: {
    id: string;
    video_title: string | null;
    question: string | null;
  };
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Ожидает', variant: 'outline' },
  generating: { label: 'Генерация...', variant: 'secondary' },
  ready: { label: 'Готово', variant: 'default' },
  failed: { label: 'Ошибка', variant: 'destructive' },
};

export function CoverThumbnailsGrid() {
  const [thumbnails, setThumbnails] = useState<CoverThumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchThumbnails = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cover_thumbnails')
        .select(`
          *,
          video:videos (id, video_title, question)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setThumbnails(data || []);
    } catch (error) {
      console.error('Error fetching thumbnails:', error);
      toast.error('Ошибка загрузки миниатюр');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThumbnails();
  }, [fetchThumbnails]);

  const filteredThumbnails = thumbnails.filter((t) => {
    const matchesSearch =
      !search ||
      t.video?.video_title?.toLowerCase().includes(search.toLowerCase()) ||
      t.video?.question?.toLowerCase().includes(search.toLowerCase()) ||
      t.prompt?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по видео или промту..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="pending">Ожидает</SelectItem>
            <SelectItem value="generating">Генерация</SelectItem>
            <SelectItem value="ready">Готово</SelectItem>
            <SelectItem value="failed">Ошибка</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={fetchThumbnails}>
          <RefreshCw className="w-4 h-4" />
        </Button>

        <div className="text-sm text-muted-foreground ml-auto">
          Всего: {filteredThumbnails.length} обложек
        </div>
      </div>

      {filteredThumbnails.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Image className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Нет сгенерированных обложек</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredThumbnails.map((thumbnail) => (
            <Card key={thumbnail.id} className="glass-card overflow-hidden group">
              <div className="grid grid-cols-2 gap-1">
                {/* Front Cover */}
                <div className="aspect-[9/16] bg-muted relative">
                  {thumbnail.front_cover_url ? (
                    <img
                      src={thumbnail.front_cover_url}
                      alt="Front cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Image className="w-8 h-8" />
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1 rounded">
                    Front
                  </span>
                </div>

                {/* Back Cover */}
                <div className="aspect-[9/16] bg-muted relative">
                  {thumbnail.back_cover_url ? (
                    <img
                      src={thumbnail.back_cover_url}
                      alt="Back cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Image className="w-8 h-8" />
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1 rounded">
                    Back
                  </span>
                </div>
              </div>

              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {thumbnail.video?.question || 'Без вопроса'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {thumbnail.video?.video_title || '—'}
                    </p>
                  </div>
                  <Badge
                    variant={statusLabels[thumbnail.status || 'pending']?.variant || 'outline'}
                  >
                    {statusLabels[thumbnail.status || 'pending']?.label || thumbnail.status}
                  </Badge>
                </div>

                {thumbnail.prompt && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {thumbnail.prompt}
                  </p>
                )}

                {thumbnail.front_cover_url && (
                  <a
                    href={thumbnail.front_cover_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Открыть изображение
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
