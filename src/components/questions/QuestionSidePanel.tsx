import { useState, useEffect } from 'react';
import { UnifiedPanel, PanelField } from '@/components/ui/unified-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, Loader2, Video } from 'lucide-react';
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
  onPrev?: () => void;
  onNext?: () => void;
}

const safetyOptions = [
  { value: 'safe', label: 'Безопасно', color: 'bg-green-500' },
  { value: 'warning', label: 'Внимание', color: 'bg-yellow-500' },
  { value: 'danger', label: 'Опасно', color: 'bg-red-500' },
  { value: 'unchecked', label: 'Не проверено', color: 'bg-gray-500' },
];

export function QuestionSidePanel({ question, open, onOpenChange, onSave, onPrev, onNext }: QuestionSidePanelProps) {
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
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
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
    setSaving(false);
    onOpenChange(false);
  };

  const currentSafety = safetyOptions.find(o => o.value === formData.safety_score) || safetyOptions[3];

  const panelTitle = (
    <span className="flex items-center gap-2">
      <span className="font-mono">#{question?.question_id}</span>
      <Badge variant="outline" className="text-xs gap-1">
        <span className={`w-2 h-2 rounded-full ${currentSafety.color}`} />
        {currentSafety.label}
      </Badge>
    </span>
  );

  return (
    <UnifiedPanel
      open={open}
      onOpenChange={onOpenChange}
      title={panelTitle}
      width="sm"
      onPrev={onPrev}
      onNext={onNext}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Сохранить
          </Button>
        </>
      }
    >
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
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Вопрос (рус)</label>
        <Textarea
          value={formData.question_rus}
          onChange={(e) => setFormData(prev => ({ ...prev, question_rus: e.target.value }))}
          placeholder="Введите текст вопроса на русском..."
          rows={3}
          className="text-sm"
        />
      </div>

      {/* Question Text English */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Вопрос (eng)</label>
        <Textarea
          value={formData.question_eng || formData.question}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            question_eng: e.target.value,
            question: e.target.value
          }))}
          placeholder="Enter question text in English..."
          rows={3}
          className="text-sm"
        />
      </div>

      <Separator />

      {/* Hook Russian */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Хук (рус)</label>
        <Textarea
          value={formData.hook_rus}
          onChange={(e) => setFormData(prev => ({ ...prev, hook_rus: e.target.value }))}
          placeholder="Введите хук на русском..."
          rows={2}
          className="text-sm"
        />
      </div>

      {/* Hook English */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Хук (eng)</label>
        <Textarea
          value={formData.hook}
          onChange={(e) => setFormData(prev => ({ ...prev, hook: e.target.value }))}
          placeholder="Enter hook in English..."
          rows={2}
          className="text-sm"
        />
      </div>

      <Separator />

      {/* Relevance Score */}
      <PanelField label="Актуальность">
        <Input
          type="number"
          min={0}
          max={100}
          value={formData.relevance_score}
          onChange={(e) => setFormData(prev => ({ ...prev, relevance_score: parseInt(e.target.value) || 0 }))}
          className="h-8 text-sm"
        />
      </PanelField>

      {/* Question Status */}
      <PanelField label="Статус">
        <Select
          value={formData.question_status}
          onValueChange={(value) => setFormData(prev => ({ ...prev, question_status: value }))}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Ожидает проверки</SelectItem>
            <SelectItem value="checked">Проверен</SelectItem>
            <SelectItem value="approved">Одобрен</SelectItem>
            <SelectItem value="rejected">Отклонён</SelectItem>
          </SelectContent>
        </Select>
      </PanelField>

      {/* Safety Score */}
      <PanelField label="Безопасность">
        <Select
          value={formData.safety_score}
          onValueChange={(value) => setFormData(prev => ({ ...prev, safety_score: value }))}
        >
          <SelectTrigger className="h-8 text-sm">
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
      </PanelField>

      {/* Publication Date */}
      <PanelField label="Дата публикации">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "justify-start text-left text-sm",
                !formData.publication_date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="w-3 h-3 mr-2" />
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
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </PanelField>
    </UnifiedPanel>
  );
}
