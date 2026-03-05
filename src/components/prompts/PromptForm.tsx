import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Save, X, Play, Loader2 } from 'lucide-react';
import { DbPrompt } from '@/hooks/usePrompts';

interface AdvisorWithPhotos {
  id: string;
  name: string;
  display_name?: string | null;
  photos?: { id: string; photo_url: string; is_primary?: boolean | null }[];
}

interface PromptFormProps {
  prompt?: DbPrompt | null;
  onSave: (data: Omit<DbPrompt, 'id' | 'created_at' | 'is_active'>) => Promise<any>;
  onCancel: () => void;
  onTest?: (prompt: DbPrompt, testContent: string, advisorPhotoUrl?: string) => Promise<string>;
  advisors?: AdvisorWithPhotos[];
}

const TEXT_MODELS = [
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (рекомендуется)' },
  { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5 (премиум)' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (быстрый)' },
];

const IMAGE_MODELS = [
  { value: 'google/gemini-2.5-flash-image', label: 'Nano Banana (быстрый)' },
  { value: 'google/gemini-3-pro-image-preview', label: 'Nano Banana Pro (качество)' },
  { value: 'nano-banana-pro', label: 'Kie.ai Nano Banana Pro' },
];

const IMAGE_TYPES = ['atmosphere', 'scene'];

const TYPES = [
  { value: 'atmosphere', label: 'Атмосфера обложки' },
  { value: 'scene', label: 'Сцена' },
  { value: 'post_text', label: 'Текст публикации' },
  { value: 'custom', label: 'Кастомный' },
];

const VARIABLES_BY_TYPE: Record<string, { name: string; desc: string }[]> = {
  atmosphere: [
    { name: '{{question}}', desc: 'Вопрос' },
    { name: '{{hook}}', desc: 'Хук' },
    { name: '{{answer}}', desc: 'Ответ духовника' },
    { name: '{{advisor}}', desc: 'Духовник' },
    { name: '{{playlist}}', desc: 'Плейлист/тема' },
  ],
  scene: [
    { name: '{{playlist}}', desc: 'Плейлист/тема' },
    { name: '{{advisor}}', desc: 'Духовник' },
  ],
  post_text: [
    { name: '{{question}}', desc: 'Вопрос' },
    { name: '{{hook}}', desc: 'Хук' },
    { name: '{{answer}}', desc: 'Ответ духовника' },
    { name: '{{advisor}}', desc: 'Духовник' },
  ],
  custom: [
    { name: '{{content}}', desc: 'Текст контента' },
    { name: '{{title}}', desc: 'Заголовок' },
  ],
};

export function PromptForm({ prompt, onSave, onCancel, onTest, advisors = [] }: PromptFormProps) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testContent, setTestContent] = useState('');
  const [testResult, setTestResult] = useState('');
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string>('');
  
  const [form, setForm] = useState({
    name: '',
    type: 'atmosphere',
    model: 'google/gemini-2.5-flash-image',
    temperature: 0.7,
    max_tokens: 4000,
    system_prompt: '',
    user_template: '',
  });

  useEffect(() => {
    if (prompt) {
      setForm({
        name: prompt.name,
        type: prompt.type,
        model: prompt.model,
        temperature: prompt.temperature,
        max_tokens: prompt.max_tokens,
        system_prompt: prompt.system_prompt,
        user_template: prompt.user_template,
      });
    }
  }, [prompt]);

  const isImageType = IMAGE_TYPES.includes(form.type);
  const currentModels = isImageType ? IMAGE_MODELS : TEXT_MODELS;

  // Auto-switch model when type changes
  useEffect(() => {
    const isImage = IMAGE_TYPES.includes(form.type);
    const imageModelValues = IMAGE_MODELS.map(m => m.value);
    const textModelValues = TEXT_MODELS.map(m => m.value);
    
    if (isImage && !imageModelValues.includes(form.model)) {
      setForm(prev => ({ ...prev, model: IMAGE_MODELS[0].value }));
    } else if (!isImage && !textModelValues.includes(form.model)) {
      setForm(prev => ({ ...prev, model: TEXT_MODELS[0].value }));
    }
  }, [form.type]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const selectedAdvisor = advisors.find(a => a.id === selectedAdvisorId);
  const advisorPhotoUrl = selectedAdvisor?.photos?.find(p => p.is_primary)?.photo_url 
    || selectedAdvisor?.photos?.[0]?.photo_url;

  const handleTest = async () => {
    if (!onTest || !testContent.trim()) return;
    
    setTesting(true);
    try {
      const result = await onTest({
        ...form,
        id: prompt?.id || 'test',
        created_at: new Date().toISOString(),
        is_active: false,
      }, testContent, isImageType ? advisorPhotoUrl : undefined);
      setTestResult(result);
    } catch (error) {
      setTestResult('Ошибка: ' + (error instanceof Error ? error.message : 'Unknown'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Форма редактирования */}
      <Card>
        <CardHeader>
          <CardTitle>{prompt ? 'Редактирование промпта' : 'Новый промпт'}</CardTitle>
          <CardDescription>
            Настройте параметры AI для генерации контента
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Мой промпт"
              />
            </div>
            <div className="space-y-2">
              <Label>Тип</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Модель AI {isImageType && <Badge variant="secondary" className="ml-2 text-xs">Изображение</Badge>}</Label>
            <Select value={form.model} onValueChange={(v) => setForm({ ...form, model: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentModels.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Temperature: {form.temperature}</Label>
              <Slider
                value={[form.temperature]}
                onValueChange={([v]) => setForm({ ...form, temperature: v })}
                min={0}
                max={2}
                step={0.1}
              />
              <p className="text-xs text-muted-foreground">
                Низкая = точнее, высокая = креативнее
              </p>
            </div>
            <div className="space-y-2">
              <Label>Max tokens: {form.max_tokens}</Label>
              <Slider
                value={[form.max_tokens]}
                onValueChange={([v]) => setForm({ ...form, max_tokens: v })}
                min={500}
                max={8000}
                step={100}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>System prompt</Label>
            <Textarea
              value={form.system_prompt}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
              placeholder="Ты профессиональный копирайтер..."
              className="min-h-[120px] font-mono text-sm"
            />
          </div>

          {/* Доступные переменные */}
          <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-2">
            <p className="font-medium text-muted-foreground">Доступные переменные:</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {(VARIABLES_BY_TYPE[form.type] || VARIABLES_BY_TYPE.custom).map((v) => (
                <div key={v.name} className="flex items-center gap-1.5">
                  <Badge variant="outline" className="font-mono text-xs">{v.name}</Badge>
                  <span className="text-muted-foreground">— {v.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>User template</Label>
              <div className="flex gap-1">
                {(VARIABLES_BY_TYPE[form.type] || VARIABLES_BY_TYPE.custom).map((v) => (
                  <Badge 
                    key={v.name} 
                    variant="outline" 
                    className="text-xs cursor-pointer hover:bg-muted"
                    onClick={() => setForm({ 
                      ...form, 
                      user_template: form.user_template + v.name 
                    })}
                    title={v.desc}
                  >
                    {v.name}
                  </Badge>
                ))}
              </div>
            </div>
            <Textarea
              value={form.user_template}
              onChange={(e) => setForm({ ...form, user_template: e.target.value })}
              placeholder="Перепиши следующий контент:&#10;&#10;Заголовок: {{title}}&#10;Контент: {{content}}"
              className="min-h-[150px] font-mono text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Сохранить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Панель тестирования */}
      <Card>
        <CardHeader>
          <CardTitle>Тестирование</CardTitle>
          <CardDescription>
            Проверьте промпт на тестовых данных
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Тестовый контент</Label>
            <Textarea
              value={testContent}
              onChange={(e) => setTestContent(e.target.value)}
              placeholder="Вставьте текст для тестирования..."
              className="min-h-[120px]"
            />
          </div>

          {isImageType && advisors.length > 0 && (
            <div className="space-y-2">
              <Label>Духовник (для композитинга фото)</Label>
              <Select value={selectedAdvisorId} onValueChange={setSelectedAdvisorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Без духовника (только фон)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без духовника</SelectItem>
                  {advisors.filter(a => a.photos && a.photos.length > 0).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.display_name || a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {advisorPhotoUrl && (
                <img src={advisorPhotoUrl} alt="Фото духовника" className="w-16 h-16 rounded object-cover" />
              )}
            </div>
          )}

          <Button 
            onClick={handleTest} 
            disabled={testing || !testContent.trim()}
            className="w-full"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Запустить тест
          </Button>

          {testResult && (
            <div className="space-y-2">
              <Label>Результат</Label>
              <div className="p-3 bg-muted rounded-lg max-h-[400px] overflow-auto">
                {isImageType && testResult.startsWith('data:image') ? (
                  <img src={testResult} alt="Сгенерированное изображение" className="max-w-full rounded" />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{testResult}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
