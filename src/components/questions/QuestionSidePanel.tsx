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
  unique_key: string;
  question_id: number;
  question: string;
  question_rus: string | null;
  question_eng: string | null;
  hook: string | null;
  hook_rus: string | null;
  safety_score: string;
  relevance_score: number;
  question_status: string;
  planned_date: string | null;
  videos_count: number;
}

interface QuestionSidePanelProps {
  question: QuestionData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (uniqueKey: string, updates: { 
    question?: string; 
    question_rus?: string;
    question_eng?: string; 
    hook?: string;
    hook_rus?: string;
    safety_score?: string; 
    relevance_score?: number;
    question_status?: string;
    publication_date?: string;
  }) => void;
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
    question_rus: '',
    question_eng: '',
    hook: '',
    hook_rus: '',
    safety_score: 'unchecked',
    relevance_score: 0,
    question_status: 'pending',
    publication_date: null as Date | null,
  });

  useEffect(() => {
    if (question) {
      setFormData({
        question: question.question || '',
        question_rus: question.question_rus || '',
        question_eng: question.question_eng || '',
        hook: question.hook || '',
        hook_rus: question.hook_rus || '',
        safety_score: question.safety_score || 'unchecked',
        relevance_score: question.relevance_score || 0,
        question_status: question.question_status || 'pending',
        publication_date: question.planned_date ? new Date(question.planned_date) : null,
      });
    }
  }, [question]);

  const handleSave = () => {
    if (!question) return;
    
    onSave(question.unique_key, {
      question: formData.question,
      question_rus: formData.question_rus || undefined,
      question_eng: formData.question_eng || undefined,
      hook: formData.hook || undefined,
      hook_rus: formData.hook_rus || undefined,
      safety_score: formData.safety_score,
      relevance_score: formData.relevance_score,
      question_status: formData.question_status,
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

          {/* Question Text Russian */}
          <div className="space-y-2">
            <Label>Вопрос (рус)</Label>
            <Textarea
              value={formData.question_rus}
              onChange={(e) => setFormData(prev => ({ ...prev, question_rus: e.target.value }))}
              placeholder="Введите текст вопроса на русском..."
              rows={3}
            />
          </div>

          {/* Question Text English */}
          <div className="space-y-2">
            <Label>Вопрос (eng)</Label>
            <Textarea
              value={formData.question_eng || formData.question}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                question_eng: e.target.value,
                question: e.target.value 
              }))}
              placeholder="Enter question text in English..."
              rows={3}
            />
          </div>

          {/* Hook Russian */}
          <div className="space-y-2">
            <Label>Хук (рус)</Label>
            <Textarea
              value={formData.hook_rus}
              onChange={(e) => setFormData(prev => ({ ...prev, hook_rus: e.target.value }))}
              placeholder="Введите хук на русском..."
              rows={2}
            />
          </div>

          {/* Hook English */}
          <div className="space-y-2">
            <Label>Хук (eng)</Label>
            <Textarea
              value={formData.hook}
              onChange={(e) => setFormData(prev => ({ ...prev, hook: e.target.value }))}
              placeholder="Enter hook in English..."
              rows={2}
            />
          </div>

          {/* Relevance Score */}
          <div className="space-y-2">
            <Label>Актуальность (0-100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={formData.relevance_score}
              onChange={(e) => setFormData(prev => ({ ...prev, relevance_score: parseInt(e.target.value) || 0 }))}
            />
          </div>

          {/* Question Status */}
          <div className="space-y-2">
            <Label>Статус вопроса</Label>
            <Select
              value={formData.question_status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, question_status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Ожидает проверки</SelectItem>
                <SelectItem value="checked">Проверен</SelectItem>
                <SelectItem value="approved">Одобрен</SelectItem>
                <SelectItem value="rejected">Отклонён</SelectItem>
              </SelectContent>
            </Select>
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
