import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Playlist {
  id: string;
  name: string;
}

interface AddQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextQuestionId: number;
  playlists: Playlist[];
  onAdd: (data: {
    question_id: number;
    question_rus: string;
    question_eng: string;
    hook_rus: string;
    hook_eng: string;
    safety_score: string;
    playlist_id: string | null;
    publication_date: Date | null;
  }) => void;
}

const safetyOptions = [
  { value: 'safe', label: 'Безопасно', color: 'bg-green-500' },
  { value: 'warning', label: 'Внимание', color: 'bg-yellow-500' },
  { value: 'danger', label: 'Опасно', color: 'bg-red-500' },
  { value: 'unchecked', label: 'Не проверено', color: 'bg-gray-500' },
];

export function AddQuestionDialog({ 
  open, 
  onOpenChange, 
  nextQuestionId, 
  playlists,
  onAdd 
}: AddQuestionDialogProps) {
  const [formData, setFormData] = useState({
    question_id: nextQuestionId,
    question_rus: '',
    question_eng: '',
    hook_rus: '',
    hook_eng: '',
    safety_score: 'unchecked',
    playlist_id: null as string | null,
    publication_date: null as Date | null,
  });

  useEffect(() => {
    if (open) {
      setFormData({
        question_id: nextQuestionId,
        question_rus: '',
        question_eng: '',
        hook_rus: '',
        hook_eng: '',
        safety_score: 'unchecked',
        playlist_id: null,
        publication_date: null,
      });
    }
  }, [open, nextQuestionId]);

  const handleSubmit = () => {
    if (formData.question_rus.trim() || formData.question_eng.trim()) {
      onAdd(formData);
      onOpenChange(false);
    }
  };

  const isValid = formData.question_rus.trim() || formData.question_eng.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Добавить новый вопрос</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Row 1: ID and Safety */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ID вопроса</Label>
              <Input
                type="number"
                value={formData.question_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, question_id: parseInt(e.target.value) || 0 }))}
                placeholder={nextQuestionId.toString()}
              />
            </div>
            <div className="space-y-2">
              <Label>Безопасность</Label>
              <Select
                value={formData.safety_score}
                onValueChange={(value) => setFormData(prev => ({ ...prev, safety_score: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {safetyOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Questions RU/EN */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Вопрос
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">RU</Badge>
              </Label>
              <Textarea
                value={formData.question_rus}
                onChange={(e) => setFormData(prev => ({ ...prev, question_rus: e.target.value }))}
                placeholder="Введите вопрос на русском..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Вопрос
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">EN</Badge>
              </Label>
              <Textarea
                value={formData.question_eng}
                onChange={(e) => setFormData(prev => ({ ...prev, question_eng: e.target.value }))}
                placeholder="Enter question in English..."
                rows={2}
              />
            </div>
          </div>

          {/* Row 3: Hooks RU/EN */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Хук
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">RU</Badge>
              </Label>
              <Input
                value={formData.hook_rus}
                onChange={(e) => setFormData(prev => ({ ...prev, hook_rus: e.target.value }))}
                placeholder="Хук на русском..."
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Хук
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">EN</Badge>
              </Label>
              <Input
                value={formData.hook_eng}
                onChange={(e) => setFormData(prev => ({ ...prev, hook_eng: e.target.value }))}
                placeholder="Hook in English..."
              />
            </div>
          </div>

          {/* Row 4: Playlist and Publication Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Плейлист</Label>
              <Select
                value={formData.playlist_id || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, playlist_id: value || null }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите плейлист..." />
                </SelectTrigger>
                <SelectContent>
                  {playlists.map(pl => (
                    <SelectItem key={pl.id} value={pl.id}>
                      {pl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Дата публикации</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.publication_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.publication_date 
                      ? format(formData.publication_date, 'dd.MM.yyyy', { locale: ru })
                      : 'Выберите дату...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.publication_date || undefined}
                    onSelect={(date) => setFormData(prev => ({ ...prev, publication_date: date || null }))}
                    locale={ru}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            <Plus className="w-4 h-4 mr-2" />
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
