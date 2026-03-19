import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { COMPRESSION_PRESETS, DEFAULT_COMPRESSION_PRESET } from '@/lib/videoNormalizer';

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
  const [compressionPreset, setCompressionPreset] = useState(DEFAULT_COMPRESSION_PRESET.id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('app_settings' as any).select('value').eq('key', 'heygen_mode').single(),
      supabase.from('app_settings' as any).select('value').eq('key', 'motion_enabled').single(),
      supabase.from('app_settings' as any).select('value').eq('key', 'compression_preset').single(),
    ]).then(([modeRes, motionRes, presetRes]) => {
      if (modeRes.data) setMode((modeRes.data as any).value);
      if (motionRes.data) setMotionEnabled((motionRes.data as any).value === 'true');
      if (presetRes.data) setCompressionPreset((presetRes.data as any).value);
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

  const handlePresetChange = async (presetId: string) => {
    setCompressionPreset(presetId);
    setSaving(true);
    const { error } = await (supabase.from('app_settings' as any) as any).upsert(
      { key: 'compression_preset', value: presetId, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    setSaving(false);
    const preset = COMPRESSION_PRESETS.find(p => p.id === presetId);
    if (error) {
      toast.error('Ошибка сохранения');
    } else {
      toast.success(`Пресет сжатия: ${preset?.label ?? presetId}`);
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
    <div className="space-y-6">
      {/* HeyGen mode */}
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
              <div className="space-y-1 flex-1">
                <Label htmlFor={`mode-${m.value}`} className="font-medium cursor-pointer">
                  {m.label}
                </Label>
                <p className="text-sm text-muted-foreground">{m.description}</p>
                {m.value === 'v3' && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Motion (движения)</p>
                        <p className="text-xs text-muted-foreground">
                          Предобработка аватара с естественными жестами ($1 за обработку)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="motion-toggle" className="text-xs cursor-pointer text-muted-foreground">
                          {motionEnabled ? 'Вкл' : 'Выкл'}
                        </Label>
                        <Switch
                          id="motion-toggle"
                          checked={motionEnabled}
                          onCheckedChange={handleMotionToggle}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Compression presets */}
      <div className="rounded-lg border p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Настройки сжатия видео</h3>
          <p className="text-sm text-muted-foreground">
            Пресет применяется при уменьшении битрейта (постобработка). Влияет на размер и качество финального файла.
          </p>
        </div>

        <RadioGroup value={compressionPreset} onValueChange={handlePresetChange} className="space-y-3">
          {COMPRESSION_PRESETS.map((p) => (
            <div
              key={p.id}
              className={`flex items-start gap-3 rounded-md border p-4 hover:bg-muted/50 transition-colors ${
                compressionPreset === p.id ? 'border-primary bg-muted/30' : ''
              }`}
            >
              <RadioGroupItem value={p.id} id={`preset-${p.id}`} className="mt-0.5" />
              <div className="space-y-1 flex-1">
                <Label htmlFor={`preset-${p.id}`} className="font-medium cursor-pointer">
                  {p.label}
                  {p.id === DEFAULT_COMPRESSION_PRESET.id && (
                    <span className="ml-2 text-xs text-primary font-normal">(по умолчанию)</span>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground font-mono">{p.description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      {saving && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Сохранение…
        </p>
      )}
    </div>
  );
}
