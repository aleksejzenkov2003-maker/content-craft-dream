import { useState, useEffect } from 'react';
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
import { Plus, Trash2, Pencil, Play, Loader2, FileText, X, Check, Wand2 } from 'lucide-react';
import { useRef } from 'react';
import { DbPrompt, usePrompts } from '@/hooks/usePrompts';
import { usePublishingChannels, PublishingChannel } from '@/hooks/usePublishingChannels';
import { useAdvisors } from '@/hooks/useAdvisors';
import { usePlaylists } from '@/hooks/usePlaylists';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

const MOTION_MODELS = [
  { value: 'veo2', label: 'Google Veo2' },
  { value: 'kling', label: 'Kling' },
];

const IMAGE_TYPES = ['atmosphere', 'scene'];
const MOTION_TYPES = ['scene_motion'];

const TYPES = [
  { value: 'atmosphere', label: 'Фон обложки' },
  { value: 'scene', label: 'Сцена монологов' },
  { value: 'post_text', label: 'Текст публикации' },
  { value: 'scene_motion', label: 'Motion для сцены' },
];

const typeLabels: Record<string, string> = {
  atmosphere: 'Фон обложки', scene: 'Сцена монологов', post_text: 'Текст публикации',
  scene_motion: 'Motion для сцены',
};

const modelLabels: Record<string, string> = {
  'claude-sonnet-4-5': 'Claude Sonnet 4.5',
  'claude-opus-4-5-20251101': 'Claude Opus 4.5',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  'google/gemini-2.5-flash-image': 'Nano Banana',
  'google/gemini-3-pro-image-preview': 'Nano Banana Pro',
  'nano-banana-pro': 'Kie.ai Nano Banana Pro',
  'veo2': 'Google Veo2',
  'kling': 'Kling',
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
  scene_motion: [
    { name: '{{monologue_scene_photo}}', desc: 'Фото сцены' },
    { name: '{{advisor}}', desc: 'Название духовника' },
  ],
};

export function PromptsPage() {
  const { prompts, loading, updatePrompt, testPrompt, addPrompt, deletePrompt } = usePrompts();
  const { channels, updateChannel } = usePublishingChannels();
  const { advisors } = useAdvisors();
  const { playlists } = usePlaylists();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<DbPrompt | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '', type: 'atmosphere', model: 'google/gemini-2.5-flash-image',
    temperature: 0.7, max_tokens: 4000, system_prompt: '', user_template: '',
  });
  const [linkedChannelIds, setLinkedChannelIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Scene motion: playlist/scene linking
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [playlistScenes, setPlaylistScenes] = useState<Record<string, any[]>>({});
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  // Test state
  const [testing, setTesting] = useState(false);
  const [testContent, setTestContent] = useState('');
  const [testResult, setTestResult] = useState('');
  const [selectedAdvisorId, setSelectedAdvisorId] = useState('');

  const userTemplateRef = useRef<HTMLTextAreaElement>(null);
  const isImageType = IMAGE_TYPES.includes(form.type);
  const isMotionType = MOTION_TYPES.includes(form.type);
  const currentModels = isMotionType ? MOTION_MODELS : isImageType ? IMAGE_MODELS : TEXT_MODELS;

  const openNew = () => {
    setEditingPrompt(null);
    setForm({ name: '', type: 'atmosphere', model: 'google/gemini-2.5-flash-image', temperature: 0.7, max_tokens: 4000, system_prompt: '', user_template: '' });
    setLinkedChannelIds([]);
    setSelectedPlaylistIds([]);
    setPlaylistScenes({});
    setSelectedSceneIds([]);
    setSaveSuccess(false);
    setTestResult('');
    setTestContent('');
    setIsDialogOpen(true);
  };

  const openEdit = async (prompt: DbPrompt) => {
    const { data: freshPrompt } = await supabase
      .from('prompts')
      .select('*')
      .eq('id', prompt.id)
      .single();

    const resolvedPrompt = freshPrompt || prompt;

    setEditingPrompt(resolvedPrompt);
    setForm({
      name: resolvedPrompt.name,
      type: resolvedPrompt.type,
      model: resolvedPrompt.model,
      temperature: resolvedPrompt.temperature,
      max_tokens: resolvedPrompt.max_tokens,
      system_prompt: resolvedPrompt.system_prompt,
      user_template: resolvedPrompt.user_template || '',
    });
    const linked = channels.filter(c => c.prompt_id === resolvedPrompt.id).map(c => c.id);
    setLinkedChannelIds(linked);
    setSelectedPlaylistIds([]);
    setPlaylistScenes({});
    setSelectedSceneIds([]);
    setSaveSuccess(false);
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
        // Unlink old channels that had this prompt but are no longer selected
        const oldLinked = channels.filter(c => c.prompt_id === promptId);
        for (const ch of oldLinked) {
          if (!linkedChannelIds.includes(ch.id)) {
            await updateChannel(ch.id, { prompt_id: null } as any);
          }
        }
        // Link new channels
        for (const chId of linkedChannelIds) {
          const ch = channels.find(c => c.id === chId);
          if (ch?.prompt_id !== promptId) {
            await updateChannel(chId, { prompt_id: promptId } as any);
          }
        }
      }

      // Show success feedback
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      // If new prompt, switch to edit mode
      if (!editingPrompt && promptId) {
        setEditingPrompt({ ...form, id: promptId, created_at: new Date().toISOString(), is_active: true });
      }
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
    const isMotion = MOTION_TYPES.includes(type);
    const imageVals = IMAGE_MODELS.map(m => m.value);
    const textVals = TEXT_MODELS.map(m => m.value);
    const motionVals = MOTION_MODELS.map(m => m.value);
    let model = form.model;
    if (isMotion && !motionVals.includes(model)) model = MOTION_MODELS[0].value;
    else if (isImage && !imageVals.includes(model)) model = IMAGE_MODELS[0].value;
    else if (!isImage && !isMotion && !textVals.includes(model)) model = TEXT_MODELS[0].value;
    setForm({ ...form, type, model });
  };

  // Fetch scenes for selected playlists
  const loadScenesForPlaylists = async (playlistIds: string[]) => {
    if (playlistIds.length === 0) {
      setPlaylistScenes({});
      return;
    }
    const { data } = await supabase
      .from('playlist_scenes')
      .select('id, playlist_id, advisor_id, scene_url, motion_prompt, motion_type')
      .in('playlist_id', playlistIds);
    
    const grouped: Record<string, any[]> = {};
    for (const s of data || []) {
      if (!grouped[s.playlist_id]) grouped[s.playlist_id] = [];
      // Resolve advisor name
      const adv = advisors.find((a: any) => a.id === s.advisor_id);
      grouped[s.playlist_id].push({ ...s, advisorName: adv?.display_name || adv?.name || '?' });
    }
    setPlaylistScenes(grouped);
  };

  const handleTogglePlaylist = (playlistId: string) => {
    const next = selectedPlaylistIds.includes(playlistId)
      ? selectedPlaylistIds.filter(id => id !== playlistId)
      : [...selectedPlaylistIds, playlistId];
    setSelectedPlaylistIds(next);
    loadScenesForPlaylists(next);
  };

  const handleApplyMotionToScenes = async () => {
    if (!form.user_template.trim()) return;
    setIsApplying(true);
    try {
      // Determine target scene IDs
      let targetSceneIds: string[] = [];
      
      if (selectedSceneIds.length > 0) {
        // Apply to specifically selected scenes
        targetSceneIds = selectedSceneIds;
      } else {
        // Apply to ALL scenes in selected playlists
        for (const plId of selectedPlaylistIds) {
          const scenes = playlistScenes[plId] || [];
          targetSceneIds.push(...scenes.map((s: any) => s.id));
        }
      }

      if (targetSceneIds.length === 0) {
        toast.error('Выберите плейлисты или сцены');
        return;
      }

      // For each scene, fill template with variables and update
      let count = 0;
      for (const plId of selectedPlaylistIds) {
        const scenes = (playlistScenes[plId] || []).filter((s: any) => targetSceneIds.includes(s.id));
        const pl = playlists.find(p => p.id === plId);
        for (const scene of scenes) {
          const filled = form.user_template
            .replace(/\{\{monologue_scene_photo\}\}/g, scene.scene_url || '')
            .replace(/\{\{advisor\}\}/g, scene.advisorName || '');
          
          await supabase
            .from('playlist_scenes')
            .update({ 
              motion_prompt: filled, 
              motion_type: form.model, // veo2 or kling
            })
            .eq('id', scene.id);
          count++;
        }
      }
      
      toast.success(`Motion промт применён к ${count} сценам`);
      // Refresh scenes
      loadScenesForPlaylists(selectedPlaylistIds);
    } catch (err: any) {
      toast.error('Ошибка применения: ' + (err.message || 'Unknown'));
    } finally {
      setIsApplying(false);
    }
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
            const linkedChs = channels.filter(c => c.prompt_id === prompt.id);
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

                  {/* Linked channels */}
                  {linkedChs.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {linkedChs.map(ch => (
                        <Badge key={ch.id} variant="secondary" className="text-[10px]">
                          🔗 {ch.name}
                        </Badge>
                      ))}
                    </div>
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
              <div className={`grid gap-3 ${form.type === 'post_text' ? 'sm:grid-cols-2' : ''}`}>
                <div className="space-y-1.5">
                  <Label className="text-xs">Название</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Мой промт" />
                </div>
                {form.type === 'post_text' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Привязка к каналам</Label>
                    <div className="border rounded-md p-2 max-h-[200px] overflow-y-auto space-y-0.5">
                      {Object.entries(channelsByType).map(([type, chs]) => (
                        chs.map(ch => {
                          const checked = linkedChannelIds.includes(ch.id);
                          return (
                            <label key={ch.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setLinkedChannelIds(prev =>
                                    checked ? prev.filter(id => id !== ch.id) : [...prev, ch.id]
                                  );
                                }}
                                className="rounded border-input"
                              />
                              <span>{type.charAt(0).toUpperCase() + type.slice(1)} — {ch.name}</span>
                            </label>
                          );
                        })
                      ))}
                      {channels.length === 0 && (
                        <p className="text-xs text-muted-foreground p-2">Нет каналов</p>
                      )}
                    </div>
                  </div>
                )}
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
                  <Label className="text-xs">
                    {isMotionType ? 'Motion Engine' : 'Модель AI'}
                    {isImageType && <Badge variant="secondary" className="ml-1 text-[10px]">IMG</Badge>}
                    {isMotionType && <Badge variant="secondary" className="ml-1 text-[10px]">MOTION</Badge>}
                  </Label>
                  <Select value={form.model} onValueChange={(v) => setForm({ ...form, model: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {currentModels.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">Temperature: {form.temperature}</Label>
                  <Slider value={[form.temperature]} onValueChange={([v]) => setForm({ ...form, temperature: v })} min={0} max={2} step={0.1} />
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
                  {(VARIABLES_BY_TYPE[form.type] || []).map(v => (
                    <Badge
                      key={v.name} variant="outline"
                      className="font-mono text-[10px] cursor-pointer hover:bg-muted"
                      onClick={() => {
                        const textarea = userTemplateRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart ?? form.user_template.length;
                          const end = textarea.selectionEnd ?? start;
                          const newText = form.user_template.substring(0, start) + v.name + form.user_template.substring(end);
                          setForm({ ...form, user_template: newText });
                          // Restore cursor position after React re-render
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + v.name.length, start + v.name.length);
                          }, 0);
                        } else {
                          setForm({ ...form, user_template: form.user_template + v.name });
                        }
                      }}
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
                  ref={userTemplateRef}
                  value={form.user_template}
                  onChange={(e) => setForm({ ...form, user_template: e.target.value })}
                  placeholder="Перепиши следующий контент:&#10;{{content}}"
                  className="min-h-[120px] font-mono text-xs"
                />
              </div>
            </div>

            {/* Right column: testing or scene assignment */}
            <div className="space-y-4">
              {isMotionType ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Назначить на плейлисты / сцены</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Выберите плейлисты для массового применения промта. Можно выбрать конкретные сцены внутри.
                    </p>
                  </div>
                  
                  <div className="border rounded-md p-2 max-h-[300px] overflow-y-auto space-y-1">
                    {playlists.length === 0 && (
                      <p className="text-xs text-muted-foreground p-2">Нет плейлистов</p>
                    )}
                    {playlists.map(pl => {
                      const checked = selectedPlaylistIds.includes(pl.id);
                      const scenes = playlistScenes[pl.id] || [];
                      return (
                        <div key={pl.id}>
                          <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm font-medium">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleTogglePlaylist(pl.id)}
                              className="rounded border-input"
                            />
                            <span>{pl.name}</span>
                            {checked && scenes.length > 0 && (
                              <Badge variant="secondary" className="text-[10px] ml-auto">{scenes.length} сцен</Badge>
                            )}
                          </label>
                          {checked && scenes.length > 0 && (
                            <div className="ml-6 space-y-0.5 mt-1 mb-2">
                              {scenes.map((sc: any) => {
                                const scChecked = selectedSceneIds.includes(sc.id);
                                return (
                                  <label key={sc.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/30 cursor-pointer text-xs">
                                    <input
                                      type="checkbox"
                                      checked={scChecked}
                                      onChange={() => {
                                        setSelectedSceneIds(prev =>
                                          scChecked ? prev.filter(id => id !== sc.id) : [...prev, sc.id]
                                        );
                                      }}
                                      className="rounded border-input"
                                    />
                                    <span className="truncate">{sc.advisorName}</span>
                                    {sc.motion_prompt && (
                                      <Badge variant="outline" className="text-[10px] ml-auto shrink-0">✓ motion</Badge>
                                    )}
                                  </label>
                                );
                              })}
                              <p className="text-[10px] text-muted-foreground px-2 mt-1">
                                {selectedSceneIds.filter(id => scenes.some((s: any) => s.id === id)).length > 0
                                  ? `Выбрано ${selectedSceneIds.filter(id => scenes.some((s: any) => s.id === id)).length} из ${scenes.length}`
                                  : 'Все сцены (если ни одна не выбрана)'}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    onClick={handleApplyMotionToScenes}
                    disabled={isApplying || selectedPlaylistIds.length === 0 || !form.user_template.trim()}
                    className="w-full"
                  >
                    {isApplying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                    Применить промт к сценам
                  </Button>

                  <p className="text-[10px] text-muted-foreground">
                    Промт будет заполнен переменными для каждой сцены и записан в motion_prompt + motion_type ({form.model}).
                  </p>
                </>
              ) : (
                <>
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
                        {isImageType && (testResult.startsWith('data:image') || testResult.startsWith('http')) ? (
                          <img src={testResult} alt="Результат" className="max-w-full rounded" />
                        ) : (
                          <p className="text-xs whitespace-pre-wrap">{testResult}</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Закрыть
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} variant={saveSuccess ? 'outline' : 'default'} className={saveSuccess ? 'border-emerald-500 text-emerald-600' : ''}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : saveSuccess ? <Check className="h-4 w-4 mr-2" /> : null}
              {saveSuccess ? 'Сохранено' : 'Сохранить'}
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
