import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, Loader2 } from 'lucide-react';
import { format, setHours, setMinutes } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Publication } from '@/hooks/usePublications';

interface PublicationEditDialogProps {
  publication: Publication | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Publication>) => Promise<void>;
}

const statusOptions = [
  { value: 'pending', label: 'Ожидает' },
  { value: 'scheduled', label: 'Запланирован' },
  { value: 'publishing', label: 'Публикуется' },
  { value: 'published', label: 'Опубликован' },
  { value: 'failed', label: 'Ошибка' },
];

const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function PublicationEditDialog({
  publication,
  open,
  onClose,
  onSave,
}: PublicationEditDialogProps) {
  const [generatedText, setGeneratedText] = useState('');
  const [status, setStatus] = useState('pending');
  const [postDate, setPostDate] = useState<Date | undefined>();
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (publication) {
      setGeneratedText(publication.generated_text || '');
      setStatus(publication.publication_status || 'pending');
      if (publication.post_date) {
        const date = new Date(publication.post_date);
        setPostDate(date);
        setHour(date.getHours());
        setMinute(date.getMinutes());
      } else {
        setPostDate(undefined);
        setHour(12);
        setMinute(0);
      }
    }
  }, [publication]);

  const handleSave = async () => {
    if (!publication) return;

    setSaving(true);
    try {
      let finalDate: string | null = null;
      if (postDate) {
        let dateWithTime = setHours(postDate, hour);
        dateWithTime = setMinutes(dateWithTime, minute);
        finalDate = dateWithTime.toISOString();
      }

      await onSave(publication.id, {
        generated_text: generatedText || null,
        publication_status: status,
        post_date: finalDate,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const getPublicationTitle = () => {
    if (!publication) return '';
    const question = publication.video?.question || 'Без вопроса';
    const advisor = publication.video?.advisor?.display_name || publication.video?.advisor?.name || '';
    return advisor ? `${question} — ${advisor}` : question;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактирование публикации</DialogTitle>
          {publication && (
            <p className="text-sm text-muted-foreground truncate">
              {getPublicationTitle()}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Канал */}
          {publication?.channel && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Канал:</span>
              <span className="font-medium">{publication.channel.name}</span>
              <span className="text-muted-foreground">({publication.channel.network_type})</span>
            </div>
          )}

          {/* Статус */}
          <div className="space-y-2">
            <Label>Статус</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Дата и время */}
          <div className="space-y-2">
            <Label>Дата и время публикации</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'flex-1 justify-start text-left font-normal',
                      !postDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {postDate ? format(postDate, 'dd MMM yyyy', { locale: ru }) : 'Выбрать дату'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={postDate}
                    onSelect={setPostDate}
                    locale={ru}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Select value={hour.toString()} onValueChange={(v) => setHour(parseInt(v))}>
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {hours.map((h) => (
                      <SelectItem key={h} value={h.toString()}>
                        {h.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>:</span>
                <Select value={minute.toString()} onValueChange={(v) => setMinute(parseInt(v))}>
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {minutes.map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {m.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Текст публикации */}
          <div className="space-y-2">
            <Label>Текст публикации</Label>
            <Textarea
              value={generatedText}
              onChange={(e) => setGeneratedText(e.target.value)}
              placeholder="Введите или сгенерируйте текст публикации..."
              rows={8}
              className="resize-y"
            />
            <p className="text-xs text-muted-foreground">
              {generatedText.length} символов
            </p>
          </div>

          {/* Ошибка (если есть) */}
          {publication?.error_message && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive font-medium">Ошибка публикации:</p>
              <p className="text-sm text-destructive/80 mt-1">{publication.error_message}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
