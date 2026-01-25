import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Save, Video } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface QuestionData {
  question_id: number;
  question: string;
  question_eng: string | null;
  safety_score: string;
  planned_date: string | null;
  videos_count: number;
}

interface QuestionSidePanelProps {
  question: QuestionData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (questionId: number, updates: { question?: string; question_eng?: string; safety_score?: string; publication_date?: string }) => void;
}

const safetyOptions = [
  { value: 'safe', label: 'Безопасно', color: 'bg-green-500' },
  { value: 'warning', label: 'Внимание', color: 'bg-yellow-500' },
  { value: 'danger', label: 'Опасно', color: 'bg-red-500' },
  { value: 'unchecked', label: 'Не проверено', color: 'bg-gray-500' },
];

export function QuestionSidePanel({ question, open, onOpenChange, onSave }: QuestionSidePanelProps) {
  const [formData, setFormData] = useState({
    question: '',
    question_eng: '',
    safety_score: 'unchecked',
    publication_date: null as Date | null,
  });

  useEffect(() => {
    if (question) {
      setFormData({
        question: question.question || '',
        question_eng: question.question_eng || '',
        safety_score: question.safety_score || 'unchecked',
        publication_date: question.planned_date ? new Date(question.planned_date) : null,
      });
    }
  }, [question]);

  const handleSave = () => {
    if (!question) return;
    
    onSave(question.question_id, {
      question: formData.question,
      question_eng: formData.question_eng || undefined,
      safety_score: formData.safety_score,
      publication_date: formData.publication_date?.toISOString(),
    });
    onOpenChange(false);
  };

  const currentSafety = safetyOptions.find(o => o.value === formData.safety_score) || safetyOptions[3];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span className="text-2xl font-mono">#{question?.question_id}</span>
            <Badge variant="outline" className="gap-1">
              <span className={`w-2 h-2 rounded-full ${currentSafety.color}`} />
              {currentSafety.label}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Stats */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                <strong>{question?.videos_count || 0}</strong> роликов
              </span>
            </div>
          </div>

          {/* Question Text */}
          <div className="space-y-2">
            <Label>Текст вопроса</Label>
            <Textarea
              value={formData.question}
              onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
              placeholder="Введите текст вопроса..."
              rows={4}
            />
          </div>

          {/* Question Text English */}
          <div className="space-y-2">
            <Label>Текст вопроса (English)</Label>
            <Textarea
              value={formData.question_eng}
              onChange={(e) => setFormData(prev => ({ ...prev, question_eng: e.target.value }))}
              placeholder="Enter question text in English..."
              rows={3}
            />
          </div>

          {/* Safety Score */}
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

          {/* Publication Date */}
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
                    ? format(formData.publication_date, 'dd MMMM yyyy', { locale: ru })
                    : 'Выберите дату'
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.publication_date || undefined}
                  onSelect={(date) => setFormData(prev => ({ ...prev, publication_date: date || null }))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Save Button */}
          <Button onClick={handleSave} className="w-full" size="lg">
            <Save className="w-4 h-4 mr-2" />
            Сохранить изменения
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
