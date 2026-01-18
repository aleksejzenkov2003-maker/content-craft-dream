import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileUploader } from '@/components/upload/FileUploader';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ManualContentFormProps {
  onContentAdded?: () => void;
}

export function ManualContentForm({ onContentAdded }: ManualContentFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Заполните заголовок и контент');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('parsed_content').insert({
        title: title.trim(),
        content: content.trim(),
        thumbnail_url: thumbnailUrl || null,
        media_urls: mediaUrls,
        is_manual: true,
        status: 'parsed',
      });

      if (error) throw error;

      toast.success('Контент добавлен');
      setOpen(false);
      resetForm();
      onContentAdded?.();
    } catch (error) {
      console.error('Error adding content:', error);
      toast.error('Ошибка добавления контента');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setThumbnailUrl('');
    setMediaUrls([]);
  };

  const handleMediaUpload = (url: string) => {
    setMediaUrls([...mediaUrls, url]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Добавить вручную
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Добавить контент вручную</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Заголовок</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите заголовок..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Контент</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Введите текст контента..."
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label>Обложка</Label>
            <FileUploader
              accept="image/*"
              folder="thumbnails"
              onUpload={(url) => setThumbnailUrl(url)}
              placeholder="Загрузите изображение для обложки"
            />
          </div>

          <div className="space-y-2">
            <Label>Медиафайлы (опционально)</Label>
            <FileUploader
              accept="image/*,video/*"
              folder="media"
              onUpload={handleMediaUpload}
              placeholder="Загрузите дополнительные медиафайлы"
            />
            {mediaUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {mediaUrls.map((url, i) => (
                  <a 
                    key={i} 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Файл {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Сохранение...' : 'Добавить'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
