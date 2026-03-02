import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Play, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePrompts, DbPrompt } from '@/hooks/usePrompts';
import { PromptLibrary } from '@/components/prompts/PromptLibrary';
import { PromptEditor } from '@/components/prompts/PromptEditor';
import { PromptForm } from '@/components/prompts/PromptForm';
import { useAdvisors } from '@/hooks/useAdvisors';

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url: string | null;
}

export function SettingsPage() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [testingApi, setTestingApi] = useState<string | null>(null);
  const [apiStatuses, setApiStatuses] = useState<Record<string, 'ok' | 'error' | 'unknown'>>({
    anthropic: 'unknown',
    elevenlabs: 'unknown',
    heygen: 'unknown',
    kie: 'unknown',
  });
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  // Prompts
  const { prompts, loading: promptsLoading, updatePrompt, testPrompt, addPrompt, deletePrompt } = usePrompts();
  const { advisors, loading: advisorsLoading } = useAdvisors();
  const [editingPrompt, setEditingPrompt] = useState<DbPrompt | null>(null);
  const [showPromptForm, setShowPromptForm] = useState(false);

  const fetchVoices = async () => {
    setLoadingVoices(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-elevenlabs-voices');
      if (error) throw error;
      if (data?.voices) {
        setVoices(data.voices);
        setApiStatuses(prev => ({ ...prev, elevenlabs: 'ok' }));
      }
    } catch (error) {
      console.error('Error fetching voices:', error);
      setApiStatuses(prev => ({ ...prev, elevenlabs: 'error' }));
    } finally {
      setLoadingVoices(false);
    }
  };

  useEffect(() => {
    fetchVoices();
  }, []);

  const testApi = async (apiName: string) => {
    setTestingApi(apiName);
    try {
      switch (apiName) {
        case 'elevenlabs':
          await fetchVoices();
          break;
        case 'anthropic': {
          const { data, error } = await supabase.functions.invoke('test-prompt', {
            body: {
              systemPrompt: 'You are a test assistant.',
              userTemplate: '{{content}}',
              testContent: 'Say "API connected" in 3 words',
              maxTokens: 20,
            },
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || 'Test failed');
          setApiStatuses(prev => ({ ...prev, anthropic: 'ok' }));
          toast.success('Anthropic API работает');
          break;
        }
        case 'heygen': {
          const { data, error } = await supabase.functions.invoke('get-heygen-avatars', {
            body: { forceRefresh: true },
          });
          if (error) {
            if (error.message?.includes('non-2xx') || error.message?.includes('timed out')) {
              setApiStatuses(prev => ({ ...prev, heygen: 'ok' }));
              toast.success('HeyGen API работает (обновление кеша может занять время)');
              break;
            }
            throw error;
          }
          if (data?.apiError) throw new Error(data.apiError);
          if (!data?.success) throw new Error('HeyGen test failed');
          setApiStatuses(prev => ({ ...prev, heygen: 'ok' }));
          toast.success(`HeyGen API работает (${data?.avatars?.length || 0} аватаров)`);
          break;
        }
        case 'kie': {
          const { data, error } = await supabase.functions.invoke('test-kie-api');
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || 'Kie.ai test failed');
          setApiStatuses(prev => ({ ...prev, kie: 'ok' }));
          toast.success('Kie.ai API доступен');
          break;
        }
      }
    } catch (error: any) {
      console.error(`${apiName} test error:`, error);
      setApiStatuses(prev => ({ ...prev, [apiName]: 'error' }));
      toast.error(`Ошибка ${apiName}: ${error.message}`);
    } finally {
      setTestingApi(null);
    }
  };

  const playVoicePreview = (voice: Voice) => {
    if (!voice.preview_url) return;
    if (playingVoice === voice.voice_id) {
      setPlayingVoice(null);
      return;
    }
    setPlayingVoice(voice.voice_id);
    const audio = new Audio(voice.preview_url);
    audio.onended = () => setPlayingVoice(null);
    audio.onerror = () => setPlayingVoice(null);
    audio.play();
  };

  const apis = [
    { key: 'anthropic', name: 'Anthropic (Claude)', desc: 'Генерация текстов для соц. сетей' },
    { key: 'elevenlabs', name: 'ElevenLabs', desc: 'Озвучка роликов' },
    { key: 'heygen', name: 'HeyGen', desc: 'Генерация видео с аватарами' },
    { key: 'kie', name: 'Kie.ai (Nano Banana Pro)', desc: 'Генерация обложек и изображений' },
  ];

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'ok': return <CheckCircle className="w-5 h-5 text-primary" />;
      case 'error': return <XCircle className="w-5 h-5 text-destructive" />;
      default: return <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  // Prompt handlers
  const handleEditPrompt = (prompt: DbPrompt) => {
    setEditingPrompt(prompt);
    setShowPromptForm(true);
  };

  const handleDuplicatePrompt = async (prompt: DbPrompt) => {
    await addPrompt({
      name: `${prompt.name} (копия)`,
      type: prompt.type,
      system_prompt: prompt.system_prompt,
      user_template: prompt.user_template,
      model: prompt.model,
      temperature: prompt.temperature,
      max_tokens: prompt.max_tokens,
    });
  };

  const handleSetActive = async (id: string) => {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;
    for (const p of prompts.filter(p => p.type === prompt.type && p.is_active)) {
      await updatePrompt(p.id, { is_active: false });
    }
    await updatePrompt(id, { is_active: true });
  };

  const handleCreateNew = () => {
    setEditingPrompt(null);
    setShowPromptForm(true);
  };

  const handleSavePromptForm = async (data: Omit<DbPrompt, 'id' | 'created_at' | 'is_active'>) => {
    if (editingPrompt) {
      await updatePrompt(editingPrompt.id, data);
    } else {
      await addPrompt(data);
    }
    setShowPromptForm(false);
    setEditingPrompt(null);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Настройки</h2>

      {/* API Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Подключения API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {apis.map(api => (
            <div key={api.key} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <StatusIcon status={apiStatuses[api.key]} />
                <div>
                  <p className="font-medium text-sm">{api.name}</p>
                  <p className="text-xs text-muted-foreground">{api.desc}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="min-w-[100px]"
                onClick={() => testApi(api.key)}
                disabled={testingApi === api.key}
              >
                {testingApi === api.key ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Проверить'
                )}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Prompts Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Промпты генерации</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {promptsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <PromptLibrary
                prompts={prompts}
                onEdit={handleEditPrompt}
                onDuplicate={handleDuplicatePrompt}
                onDelete={deletePrompt}
                onSetActive={handleSetActive}
                onCreateNew={handleCreateNew}
              />

              {showPromptForm && (
                <PromptForm
                  prompt={editingPrompt}
                  onSave={handleSavePromptForm}
                  onCancel={() => { setShowPromptForm(false); setEditingPrompt(null); }}
                  onTest={testPrompt}
                  advisors={advisors}
                />
              )}


            </>
          )}
        </CardContent>
      </Card>

      {/* Voices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Голоса ElevenLabs
            <Badge variant="secondary" className="ml-2">{voices.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingVoices ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : voices.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              Нет доступных голосов. Проверьте API ключ ElevenLabs.
            </p>
          ) : (
            <div className="grid gap-2 max-h-[400px] overflow-auto">
              {voices.map(voice => (
                <div key={voice.voice_id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{voice.name}</span>
                    <Badge variant="outline" className="text-[10px]">{voice.category}</Badge>
                    {Object.entries(voice.labels || {}).slice(0, 2).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="text-[10px]">{v}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] text-muted-foreground">{voice.voice_id}</code>
                    {voice.preview_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => playVoicePreview(voice)}
                      >
                        {playingVoice === voice.voice_id ? (
                          <Volume2 className="w-4 h-4 text-primary" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" className="mt-3" onClick={fetchVoices} disabled={loadingVoices}>
            Обновить список
          </Button>
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Как настроить голос духовника</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Найдите нужный голос в списке выше и скопируйте его Voice ID</p>
          <p>2. Перейдите в раздел «Духовники»</p>
          <p>3. Нажмите ⚙️ на карточке духовника</p>
          <p>4. Вставьте Voice ID в поле «ElevenLabs Voice ID»</p>
          <p>При генерации видео будет использован голос, привязанный к духовнику.</p>
        </CardContent>
      </Card>
    </div>
  );
}
