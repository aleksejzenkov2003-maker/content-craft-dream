import { useState, useEffect } from 'react';
import { UnifiedPanel, PanelField } from '@/components/ui/unified-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
import { ImageInput } from '@/components/ui/image-input';

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
      setFormData({ answer_status: 'pending', generation_status: 'pending' });
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
    <UnifiedPanel
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title={video ? 'Редактировать ролик' : 'Новый ролик'}
      width="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Отмена
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {video ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <PanelField label="Номер ролика" labelWidth="120px">
          <Input type="number" value={formData.video_number || ''} onChange={(e) => updateField('video_number', parseInt(e.target.value) || null)} className="h-8 text-sm" />
        </PanelField>
        <PanelField label="ID вопроса" labelWidth="120px">
          <Input type="number" value={formData.question_id || ''} onChange={(e) => updateField('question_id', parseInt(e.target.value) || null)} className="h-8 text-sm" />
        </PanelField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <PanelField label="Духовник" labelWidth="120px">
          <Select value={formData.advisor_id || ''} onValueChange={(value) => updateField('advisor_id', value || null)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Выберите духовника" /></SelectTrigger>
            <SelectContent>
              {advisors.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </PanelField>
        <PanelField label="Плейлист" labelWidth="120px">
          <Select value={formData.playlist_id || ''} onValueChange={(value) => updateField('playlist_id', value || null)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Выберите плейлист" /></SelectTrigger>
            <SelectContent>
              {playlists.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </PanelField>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Хук</label>
        <Input value={formData.hook || ''} onChange={(e) => updateField('hook', e.target.value)} placeholder="Choice between soul and desire" className="h-8 text-sm" />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Вопрос</label>
        <Textarea value={formData.question || ''} onChange={(e) => updateField('question', e.target.value)} placeholder="Is it a sin to have sexual thoughts about someone you love?" className="text-sm" />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Заголовок видео</label>
        <Input value={formData.video_title || ''} onChange={(e) => updateField('video_title', e.target.value)} className="h-8 text-sm" />
      </div>

      <Separator />

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Промт для ответа</label>
        <Textarea value={formData.answer_prompt || ''} onChange={(e) => updateField('answer_prompt', e.target.value)} rows={3} className="text-sm" />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Ответ духовника</label>
        <Textarea value={formData.advisor_answer || ''} onChange={(e) => updateField('advisor_answer', e.target.value)} rows={6} className="text-sm" />
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Основное фото</label>
          <ImageInput value={formData.main_photo_url || ''} onChange={(url) => updateField('main_photo_url', url)} folder="videos/photos" aspectRatio="1:1" generatePromptPrefix="Profile photo or main image for a spiritual video." />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Обложка (cover_url)</label>
          <ImageInput value={formData.cover_url || ''} onChange={(url) => updateField('cover_url', url)} folder="videos/covers" aspectRatio="16:9" generatePromptPrefix={`YouTube thumbnail for spiritual video. Question: "${formData.question || 'spiritual guidance'}".`} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Передняя обложка (front_cover_url)</label>
        <ImageInput value={formData.front_cover_url || ''} onChange={(url) => updateField('front_cover_url', url)} folder="videos/front-covers" aspectRatio="16:9" generatePromptPrefix={`Professional YouTube thumbnail for spiritual guidance video. Topic: "${formData.hook || formData.question || 'spiritual wisdom'}".`} />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Промт для обложки</label>
        <Textarea value={formData.cover_prompt || ''} onChange={(e) => updateField('cover_prompt', e.target.value)} className="text-sm" />
      </div>

      <Separator />

      <h4 className="font-medium text-sm">Ссылки на соцсети</h4>
      <div className="grid grid-cols-2 gap-4">
        <PanelField label="TikTok" labelWidth="120px">
          <Input value={formData.tiktok_url || ''} onChange={(e) => updateField('tiktok_url', e.target.value)} className="h-8 text-sm" />
        </PanelField>
        <PanelField label="Instagram Reels" labelWidth="120px">
          <Input value={formData.instagram_url || ''} onChange={(e) => updateField('instagram_url', e.target.value)} className="h-8 text-sm" />
        </PanelField>
        <PanelField label="YouTube Shorts" labelWidth="120px">
          <Input value={formData.youtube_url || ''} onChange={(e) => updateField('youtube_url', e.target.value)} className="h-8 text-sm" />
        </PanelField>
        <PanelField label="Facebook" labelWidth="120px">
          <Input value={formData.facebook_url || ''} onChange={(e) => updateField('facebook_url', e.target.value)} className="h-8 text-sm" />
        </PanelField>
      </div>
    </UnifiedPanel>
  );
}
