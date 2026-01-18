import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Video } from '@/hooks/useVideos';
import { Advisor } from '@/hooks/useAdvisors';
import { Playlist } from '@/hooks/usePlaylists';
import { Loader2 } from 'lucide-react';

interface VideoEditorDialogProps {
  video: Video | null;
  advisors: Advisor[];
  playlists: Playlist[];
  open: boolean;
  onClose: () => void;
  onSave: (id: string | null, data: Partial<Video>) => Promise<void>;
}

export function VideoEditorDialog({
  video,
  advisors,
  playlists,
  open,
  onClose,
  onSave,
}: VideoEditorDialogProps) {
  const [formData, setFormData] = useState<Partial<Video>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (video) {
      setFormData(video);
    } else {
      setFormData({
        answer_status: 'pending',
        generation_status: 'pending',
      });
    }
  }, [video]);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onSave(video?.id || null, formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof Video, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {video ? 'Редактировать ролик' : 'Новый ролик'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Номер ролика</Label>
              <Input
                type="number"
                value={formData.video_number || ''}
                onChange={(e) => updateField('video_number', parseInt(e.target.value) || null)}
              />
            </div>
            <div className="space-y-2">
              <Label>ID вопроса</Label>
              <Input
                type="number"
                value={formData.question_id || ''}
                onChange={(e) => updateField('question_id', parseInt(e.target.value) || null)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Духовник</Label>
              <Select
                value={formData.advisor_id || ''}
                onValueChange={(value) => updateField('advisor_id', value || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите духовника" />
                </SelectTrigger>
                <SelectContent>
                  {advisors.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Плейлист</Label>
              <Select
                value={formData.playlist_id || ''}
                onValueChange={(value) => updateField('playlist_id', value || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите плейлист" />
                </SelectTrigger>
                <SelectContent>
                  {playlists.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Хук</Label>
            <Input
              value={formData.hook || ''}
              onChange={(e) => updateField('hook', e.target.value)}
              placeholder="Choice between soul and desire"
            />
          </div>

          <div className="space-y-2">
            <Label>Вопрос</Label>
            <Textarea
              value={formData.question || ''}
              onChange={(e) => updateField('question', e.target.value)}
              placeholder="Is it a sin to have sexual thoughts about someone you love?"
            />
          </div>

          <div className="space-y-2">
            <Label>Заголовок видео</Label>
            <Input
              value={formData.video_title || ''}
              onChange={(e) => updateField('video_title', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Промт для ответа</Label>
            <Textarea
              value={formData.answer_prompt || ''}
              onChange={(e) => updateField('answer_prompt', e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Ответ духовника</Label>
            <Textarea
              value={formData.advisor_answer || ''}
              onChange={(e) => updateField('advisor_answer', e.target.value)}
              rows={6}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>URL основного фото</Label>
              <Input
                value={formData.main_photo_url || ''}
                onChange={(e) => updateField('main_photo_url', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>URL обложки</Label>
              <Input
                value={formData.cover_url || ''}
                onChange={(e) => updateField('cover_url', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Промт для обложки</Label>
            <Textarea
              value={formData.cover_prompt || ''}
              onChange={(e) => updateField('cover_prompt', e.target.value)}
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3">Ссылки на соцсети</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>TikTok</Label>
                <Input
                  value={formData.tiktok_url || ''}
                  onChange={(e) => updateField('tiktok_url', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Instagram Reels</Label>
                <Input
                  value={formData.instagram_url || ''}
                  onChange={(e) => updateField('instagram_url', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>YouTube Shorts</Label>
                <Input
                  value={formData.youtube_url || ''}
                  onChange={(e) => updateField('youtube_url', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Facebook</Label>
                <Input
                  value={formData.facebook_url || ''}
                  onChange={(e) => updateField('facebook_url', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {video ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
