import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Pencil, Play, Loader2, FileText, X } from 'lucide-react';
import { DbPrompt, usePrompts } from '@/hooks/usePrompts';
import { usePublishingChannels, PublishingChannel } from '@/hooks/usePublishingChannels';
import { useAdvisors } from '@/hooks/useAdvisors';

const TEXT_MODELS = [
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
];

const IMAGE_MODELS = [
  { value: 'google/gemini-2.5-flash-image', label: 'Nano Banana' },
  { value: 'google/gemini-3-pro-image-preview', label: 'Nano Banana Pro' },
  { value: 'nano-banana-pro', label: 'Kie.ai Nano Banana Pro' },
];

const IMAGE_TYPES = ['atmosphere', 'scene'];

const TYPES = [
  { value: 'atmosphere', label: 'Фон обложки' },
  { value: 'scene', label: 'Сцена монологов' },
  { value: 'post_text', label: 'Текст публикации' },
];

const typeLabels: Record<string, string> = {
  atmosphere: 'Фон обложки', scene: 'Сцена монологов', post_text: 'Текст публикации',
};

const modelLabels: Record<string, string> = {
  'claude-sonnet-4-5': 'Claude Sonnet 4.5',
  'claude-opus-4-5-20251101': 'Claude Opus 4.5',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  'google/gemini-2.5-flash-image': 'Nano Banana',
  'google/gemini-3-pro-image-preview': 'Nano Banana Pro',
  'nano-banana-pro': 'Kie.ai Nano Banana Pro',
};

const VARIABLES_BY_TYPE: Record<string, { name: string; desc: string }[]> = {
  atmosphere: [
    { name: '{{question}}', desc: 'Вопрос' }, { name: '{{hook}}', desc: 'Хук' },
    { name: '{{answer}}', desc: 'Ответ' }, { name: '{{advisor}}', desc: 'Духовник' },
    { name: '{{playlist}}', desc: 'Плейлист' },
  ],
  scene: [{ name: '{{playlist}}', desc: 'Плейлист' }, { name: '{{advisor}}', desc: 'Духовник' }],
  post_text: [
    { name: '{{question}}', desc: 'Вопрос' }, { name: '{{hook}}', desc: 'Хук' },
    { name: '{{answer}}', desc: 'Ответ' }, { name: '{{advisor}}', desc: 'Духовник' },
  ],
};

export function PromptsPage() {
  const { prompts, loading, updatePrompt, testPrompt, addPrompt, deletePrompt } = usePrompts();
  const { channels, updateChannel } = usePublishingChannels();
  const { advisors } = useAdvisors();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<DbPrompt | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '', type: 'atmosphere', model: 'google/gemini-2.5-flash-image',
    temperature: 0.7, max_tokens: 4000, system_prompt: '', user_template: '',
  });
  const [linkedChannelIds, setLinkedChannelIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Test state
  const [testing, setTesting] = useState(false);
  const [testContent, setTestContent] = useState('');
  const [testResult, setTestResult] = useState('');
  const [selectedAdvisorId, setSelectedAdvisorId] = useState('');

  const isImageType = IMAGE_TYPES.includes(form.type);
  const currentModels = isImageType ? IMAGE_MODELS : TEXT_MODELS;

  const openNew = () => {
    setEditingPrompt(null);
    setForm({ name: '', type: 'rewrite', model: 'claude-sonnet-4-5', temperature: 0.7, max_tokens: 4000, system_prompt: '', user_template: '' });
    setLinkedChannelId('');
    setTestResult('');
    setTestContent('');
    setIsDialogOpen(true);
  };

  const openEdit = (prompt: DbPrompt) => {
    setEditingPrompt(prompt);
    setForm({
      name: prompt.name, type: prompt.type, model: prompt.model,
      temperature: prompt.temperature, max_tokens: prompt.max_tokens,
      system_prompt: prompt.system_prompt, user_template: prompt.user_template,
    });
    // Find linked channel
    const linked = channels.find(c => c.prompt_id === prompt.id);
    setLinkedChannelId(linked?.id || '');
    setTestResult('');
    setTestContent('');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      let promptId: string | undefined;
      if (editingPrompt) {
        await updatePrompt(editingPrompt.id, form);
        promptId = editingPrompt.id;
      } else {
        const created = await addPrompt(form);
        promptId = created?.id;
      }

      // Update channel linking
      if (promptId) {
        // Unlink old channels that had this prompt
        const oldLinked = channels.filter(c => c.prompt_id === promptId);
        for (const ch of oldLinked) {
          if (ch.id !== linkedChannelId) {
            await updateChannel(ch.id, { prompt_id: null } as any);
          }
        }
        // Link new channel
        if (linkedChannelId) {
          await updateChannel(linkedChannelId, { prompt_id: promptId } as any);
        }
      }

      setIsDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testContent.trim()) return;
    setTesting(true);
    try {
      const selectedAdvisor = advisors.find(a => a.id === selectedAdvisorId);
      const advisorPhotoUrl = selectedAdvisor?.photos?.find((p: any) => p.is_primary)?.photo_url
        || selectedAdvisor?.photos?.[0]?.photo_url;

      const result = await testPrompt({
        ...form, id: editingPrompt?.id || 'test',
        created_at: new Date().toISOString(), is_active: false,
      }, testContent, isImageType ? advisorPhotoUrl : undefined);
      setTestResult(result);
    } catch (error) {
      setTestResult('Ошибка: ' + (error instanceof Error ? error.message : 'Unknown'));
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deletePrompt(deleteId);
      setDeleteId(null);
    }
  };

  // Auto-switch model when type changes
  const handleTypeChange = (type: string) => {
    const isImage = IMAGE_TYPES.includes(type);
    const imageVals = IMAGE_MODELS.map(m => m.value);
    const textVals = TEXT_MODELS.map(m => m.value);
    let model = form.model;
    if (isImage && !imageVals.includes(model)) model = IMAGE_MODELS[0].value;
    if (!isImage && !textVals.includes(model)) model = TEXT_MODELS[0].value;
    setForm({ ...form, type, model });
  };

  // Group channels by network_type for the Link dropdown
  const channelsByType = channels.reduce<Record<string, PublishingChannel[]>>((acc, ch) => {
    if (!acc[ch.network_type]) acc[ch.network_type] = [];
    acc[ch.network_type].push(ch);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Промты</h2>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Новый Промт
        </Button>
      </div>

      {prompts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Нет промтов</p>
            <Button variant="outline" className="mt-4" onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" />
              Создать первый промт
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {prompts.map((prompt) => {
            const linkedChannel = channels.find(c => c.prompt_id === prompt.id);
            return (
              <Card
                key={prompt.id}
                className="relative border-dashed hover:border-primary/50 transition-colors cursor-pointer group"
                onClick={() => openEdit(prompt)}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Top: name + delete */}
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm leading-tight">{prompt.name}</h4>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(prompt.id); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="destructive" className="text-[10px]">
                      {modelLabels[prompt.model] || prompt.model}
                    </Badge>
                    <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white">
                      {typeLabels[prompt.type] || prompt.type}
                    </Badge>
                    {prompt.is_active && (
                      <Badge variant="outline" className="text-[10px] border-primary text-primary">
                        Активный
                      </Badge>
                    )}
                  </div>

                  {/* Linked channel */}
                  {linkedChannel && (
                    <Badge variant="secondary" className="text-[10px]">
                      🔗 {linkedChannel.name}
                    </Badge>
                  )}

                  {/* System prompt preview */}
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {prompt.system_prompt}
                  </p>

                  {/* Bottom: edit icon */}
                  <div className="flex justify-end">
                    <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) setIsDialogOpen(false); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPrompt ? 'Редактировать промт' : 'Новый промт'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left column: form */}
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Название</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Мой промт" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Привязка к каналу</Label>
                  <Select value={linkedChannelId || '__none__'} onValueChange={(v) => setLinkedChannelId(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Без привязки" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Без привязки</SelectItem>
                      {Object.entries(channelsByType).map(([type, chs]) => (
                        chs.map(ch => (
                          <SelectItem key={ch.id} value={ch.id}>
                            {type.charAt(0).toUpperCase() + type.slice(1)} — {ch.name}
                          </SelectItem>
                        ))
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Тип</Label>
                  <Select value={form.type} onValueChange={handleTypeChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Модель AI {isImageType && <Badge variant="secondary" className="ml-1 text-[10px]">IMG</Badge>}</Label>
                  <Select value={form.model} onValueChange={(v) => setForm({ ...form, model: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {currentModels.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Temperature: {form.temperature}</Label>
                  <Slider value={[form.temperature]} onValueChange={([v]) => setForm({ ...form, temperature: v })} min={0} max={2} step={0.1} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max tokens: {form.max_tokens}</Label>
                  <Slider value={[form.max_tokens]} onValueChange={([v]) => setForm({ ...form, max_tokens: v })} min={500} max={8000} step={100} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">System prompt</Label>
                <Textarea
                  value={form.system_prompt}
                  onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                  placeholder="Ты профессиональный копирайтер..."
                  className="min-h-[100px] font-mono text-xs"
                />
              </div>

              {/* Variables */}
              <div className="p-2 bg-muted/30 rounded-lg text-xs space-y-1">
                <p className="font-medium text-muted-foreground">Переменные:</p>
                <div className="flex flex-wrap gap-1.5">
                  {(VARIABLES_BY_TYPE[form.type] || VARIABLES_BY_TYPE.custom).map(v => (
                    <Badge
                      key={v.name} variant="outline"
                      className="font-mono text-[10px] cursor-pointer hover:bg-muted"
                      onClick={() => setForm({ ...form, user_template: form.user_template + v.name })}
                      title={v.desc}
                    >
                      {v.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">User template</Label>
                <Textarea
                  value={form.user_template}
                  onChange={(e) => setForm({ ...form, user_template: e.target.value })}
                  placeholder="Перепиши следующий контент:&#10;{{content}}"
                  className="min-h-[120px] font-mono text-xs"
                />
              </div>
            </div>

            {/* Right column: testing */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Тестовый контент</Label>
                <Textarea
                  value={testContent}
                  onChange={(e) => setTestContent(e.target.value)}
                  placeholder="Вставьте текст для тестирования..."
                  className="min-h-[100px]"
                />
              </div>

              {isImageType && advisors.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Духовник (для композитинга)</Label>
                  <Select value={selectedAdvisorId || 'none'} onValueChange={(v) => setSelectedAdvisorId(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Без духовника" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без духовника</SelectItem>
                      {advisors.filter((a: any) => a.photos?.length > 0).map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.display_name || a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button onClick={handleTest} disabled={testing || !testContent.trim()} className="w-full">
                {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Запустить тест
              </Button>

              {testResult && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Результат</Label>
                  <div className="p-3 bg-muted rounded-lg max-h-[350px] overflow-auto">
                    {isImageType && testResult.startsWith('data:image') ? (
                      <img src={testResult} alt="Результат" className="max-w-full rounded" />
                    ) : (
                      <p className="text-xs whitespace-pre-wrap">{testResult}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить промт?</AlertDialogTitle>
            <AlertDialogDescription>Это действие нельзя отменить.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
