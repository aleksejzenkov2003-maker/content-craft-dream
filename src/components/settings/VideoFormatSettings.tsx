import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const MODES = [
  {
    value: 'v3',
    label: 'Avatar III — Talking Photo',
    description: 'Стандартное качество, дешевле. Endpoint: v2/video/generate',
  },
  {
    value: 'v4',
    label: 'Avatar IV — Talking Photo (Premium)',
    description: 'Улучшенная мимика и движения головы, ~$6 за видео. Endpoint: v2/video/av4/generate',
  },
] as const;

export function VideoFormatSettings() {
  const [mode, setMode] = useState<string>('v3');
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('app_settings' as any).select('value').eq('key', 'heygen_mode').single(),
      supabase.from('app_settings' as any).select('value').eq('key', 'motion_enabled').single(),
    ]).then(([modeRes, motionRes]) => {
      if (modeRes.data) setMode((modeRes.data as any).value);
      if (motionRes.data) setMotionEnabled((motionRes.data as any).value === 'true');
      setLoading(false);
    });
  }, []);

  const handleModeChange = async (newMode: string) => {
    setMode(newMode);
    setSaving(true);
    const { error } = await (supabase.from('app_settings' as any) as any).upsert(
      { key: 'heygen_mode', value: newMode, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    setSaving(false);
    if (error) {
      toast.error('Ошибка сохранения');
    } else {
      toast.success(`Режим HeyGen: ${newMode === 'v4' ? 'Avatar IV' : 'Avatar III'}`);
    }
  };

  const handleMotionToggle = async (enabled: boolean) => {
    setMotionEnabled(enabled);
    setSaving(true);
    const { error } = await (supabase.from('app_settings' as any) as any).upsert(
      { key: 'motion_enabled', value: String(enabled), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    setSaving(false);
    if (error) {
      toast.error('Ошибка сохранения');
    } else {
      toast.success(enabled ? 'Motion включён' : 'Motion отключён');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Загрузка…
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Режим генерации HeyGen</h3>
        <p className="text-sm text-muted-foreground">
          Выберите версию API для генерации видео. Оба используют talking_photo.
        </p>
      </div>

      <RadioGroup value={mode} onValueChange={handleModeChange} className="space-y-3">
        {MODES.map((m) => (
          <div key={m.value} className="flex items-start gap-3 rounded-md border p-4 hover:bg-muted/50 transition-colors">
            <RadioGroupItem value={m.value} id={`mode-${m.value}`} className="mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor={`mode-${m.value}`} className="font-medium cursor-pointer">
                {m.label}
              </Label>
              <p className="text-sm text-muted-foreground">{m.description}</p>
            </div>
          </div>
        ))}
      </RadioGroup>

      <Separator />

      <div>
        <h3 className="text-lg font-semibold">Motion (движения)</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Включает предобработку аватара с естественными жестами ($1 за обработку). При отключении motion_avatar_id из сцен игнорируется.
        </p>
        <div className="flex items-center gap-3">
          <Switch
            id="motion-toggle"
            checked={motionEnabled}
            onCheckedChange={handleMotionToggle}
          />
          <Label htmlFor="motion-toggle" className="cursor-pointer">
            {motionEnabled ? 'Motion включён' : 'Motion отключён'}
          </Label>
        </div>
      </div>

      {saving && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Сохранение…
        </p>
      )}
    </div>
  );
}
