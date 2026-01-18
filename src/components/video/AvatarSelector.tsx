import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, User, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  preview_image_url: string | null;
  preview_video_url: string | null;
}

interface AvatarSelectorProps {
  selectedAvatarId: string | null;
  onSelect: (avatarId: string) => void;
}

export function AvatarSelector({ selectedAvatarId, onSelect }: AvatarSelectorProps) {
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchAvatars(false);
  }, []);

  const fetchAvatars = async (forceRefresh: boolean) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-heygen-avatars', {
        body: { forceRefresh }
      });
      
      if (fnError) throw fnError;
      
      if (data?.success && data.avatars) {
        setAvatars(data.avatars);
        setFromCache(data.fromCache || false);
        setCachedAt(data.cachedAt || null);
      } else {
        throw new Error(data?.error || 'Failed to fetch avatars');
      }
    } catch (err) {
      console.error('Error fetching avatars:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchAvatars(true);
  };

  const formatCacheTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  if (error && avatars.length === 0) {
    return (
      <div className="text-center p-4 text-destructive">
        <p className="text-sm">{error}</p>
        <button 
          onClick={() => fetchAvatars(false)}
          className="text-primary underline text-sm mt-2"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (avatars.length === 0) {
    return (
      <div className="text-center p-4 text-muted-foreground">
        <p className="text-sm">Нет доступных аватаров</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Cache info and refresh button */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {fromCache && cachedAt 
            ? `Из кеша (${formatCacheTime(cachedAt)})`
            : 'Загружено из API'
          }
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-7 px-2"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1", refreshing && "animate-spin")} />
          Обновить
        </Button>
      </div>

      {/* Avatar grid */}
      <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1">
        {avatars.map((avatar, index) => {
          const isSelected = selectedAvatarId === avatar.avatar_id;
          
          return (
            <div
              key={`${avatar.avatar_id}-${index}`}
              className={cn(
                'relative rounded-lg overflow-hidden cursor-pointer',
                'border-2 transition-all duration-200',
                'h-[100px] w-full',
                isSelected 
                  ? 'border-primary ring-2 ring-primary/30' 
                  : 'border-border hover:border-primary/50'
              )}
              onClick={() => onSelect(avatar.avatar_id)}
            >
              {/* Preview Image */}
              {avatar.preview_image_url ? (
                <img
                  src={avatar.preview_image_url}
                  alt={avatar.avatar_name}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 bg-muted flex items-center justify-center">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
              )}

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                  <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                </div>
              )}

              {/* Name overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-xs text-white truncate">{avatar.avatar_name}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
