import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ApiBalances {
  elevenlabs?: { used: number; limit: number; resetUnix: number | null; tier: string | null; error?: string };
  heygen?: { remainingSeconds: number; remainingCredits: number; error?: string };
}

export function SettingsPage() {
  const [testingApi, setTestingApi] = useState<string | null>(null);
  const [apiStatuses, setApiStatuses] = useState<Record<string, 'ok' | 'error' | 'unknown'>>({
    anthropic: 'unknown',
    elevenlabs: 'unknown',
    heygen: 'unknown',
    kie: 'unknown',
  });
  const [balances, setBalances] = useState<ApiBalances | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);

  const fetchBalances = async () => {
    setLoadingBalances(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-api-balances');
      if (error) throw error;
      if (data?.balances) {
        setBalances(data.balances);
        if (data.balances.elevenlabs && !data.balances.elevenlabs.error) {
          setApiStatuses(prev => ({ ...prev, elevenlabs: 'ok' }));
        }
        if (data.balances.heygen && !data.balances.heygen.error) {
          setApiStatuses(prev => ({ ...prev, heygen: 'ok' }));
        }
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
    } finally {
      setLoadingBalances(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  const testApi = async (apiName: string) => {
    setTestingApi(apiName);
    try {
      switch (apiName) {
        case 'elevenlabs':
        case 'heygen':
          await fetchBalances();
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

  const formatResetDate = (unix: number | null) => {
    if (!unix) return null;
    const date = new Date(unix * 1000);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const elUsed = balances?.elevenlabs?.used ?? 0;
  const elLimit = balances?.elevenlabs?.limit ?? 1;
  const elPercent = Math.round((elUsed / elLimit) * 100);

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

      {/* API Balances */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Баланс API</CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchBalances} disabled={loadingBalances}>
            <RefreshCw className={`w-4 h-4 ${loadingBalances ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingBalances && !balances ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* ElevenLabs */}
              <div className="space-y-2 p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">ElevenLabs — символы</p>
                  {balances?.elevenlabs?.tier && (
                    <Badge variant="secondary" className="text-[10px]">{balances.elevenlabs.tier}</Badge>
                  )}
                </div>
                {balances?.elevenlabs?.error ? (
                  <p className="text-xs text-destructive">{balances.elevenlabs.error}</p>
                ) : (
                  <>
                    <Progress value={elPercent} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{elUsed.toLocaleString('ru-RU')} / {(balances?.elevenlabs?.limit ?? 0).toLocaleString('ru-RU')}</span>
                      {balances?.elevenlabs?.resetUnix && (
                        <span>Сброс: {formatResetDate(balances.elevenlabs.resetUnix)}</span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* HeyGen */}
              <div className="space-y-1 p-3 rounded-lg border">
                <p className="font-medium text-sm">HeyGen — кредиты</p>
                {balances?.heygen?.error ? (
                  <p className="text-xs text-destructive">{balances.heygen.error}</p>
                ) : (
                  <p className="text-2xl font-bold text-primary">
                    {balances?.heygen?.remainingCredits ?? '—'}
                    <span className="text-xs font-normal text-muted-foreground ml-1">мин</span>
                  </p>
                )}
              </div>

              {/* Anthropic */}
              <div className="p-3 rounded-lg border">
                <p className="font-medium text-sm">Anthropic</p>
                <p className="text-xs text-muted-foreground">Баланс недоступен через API</p>
              </div>

              {/* Kie.ai */}
              <div className="p-3 rounded-lg border">
                <p className="font-medium text-sm">Kie.ai</p>
                <p className="text-xs text-muted-foreground">Баланс недоступен через API</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
