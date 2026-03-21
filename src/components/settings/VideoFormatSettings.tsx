import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { COMPRESSION_PRESETS, DEFAULT_COMPRESSION_PRESET } from '@/lib/videoNormalizer';
import { useAutomationSettings, SINGLE_STEPS, BULK_STEPS, type ActionMode } from '@/hooks/useAutomationSettings';

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
  const [videoFormatMode, setVideoFormatMode] = useState<string>('full_photo');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showScenario, setShowScenario] = useState(false);

  const { mode: actionMode, setMode: setActionMode } = useAutomationSettings();

  useEffect(() => {
    Promise.all([
      supabase.from('app_settings').select('value').eq('key', 'heygen_mode').single(),
      supabase.from('app_settings').select('value').eq('key', 'motion_enabled').single(),
      supabase.from('app_settings').select('value').eq('key', 'compression_preset').single(),
      supabase.from('app_settings').select('value').eq('key', 'video_format_mode').single(),
    ]).then(([modeRes, motionRes, presetRes, formatRes]) => {
      if (modeRes.data) setMode(modeRes.data.value);
      if (motionRes.data) setMotionEnabled(motionRes.data.value === 'true');
      if (presetRes.data) setCompressionPreset(presetRes.data.value);
      if (formatRes.data) setVideoFormatMode(formatRes.data.value);
      setLoading(false);
    });
  }, []);

  const handleModeChange = async (newMode: string) => {
    setMode(newMode);
    setSaving(true);
    const { error } = await supabase.from('app_settings').upsert(
      { key: 'heygen_mode', value: newMode, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    setSaving(false);
    if (error) toast.error('Ошибка сохранения');
    else toast.success(`Режим HeyGen: ${newMode === 'v4' ? 'Avatar IV' : 'Avatar III'}`);
  };

  const handleMotionToggle = async (enabled: boolean) => {
    setMotionEnabled(enabled);
    setSaving(true);
    const { error } = await supabase.from('app_settings').upsert(
      { key: 'motion_enabled', value: String(enabled), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    setSaving(false);
    if (error) toast.error('Ошибка сохранения');
    else toast.success(enabled ? 'Motion включён' : 'Motion отключён');
  };

  const handlePresetChange = async (presetId: string) => {
    setCompressionPreset(presetId);
    setSaving(true);
    const { error } = await supabase.from('app_settings').upsert(
      { key: 'compression_preset', value: presetId, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    setSaving(false);
    const preset = COMPRESSION_PRESETS.find(p => p.id === presetId);
    if (error) toast.error('Ошибка сохранения');
    else toast.success(`Пресет сжатия: ${preset?.label ?? presetId}`);
  };

  const handleActionModeChange = (val: ActionMode) => {
    setActionMode(val);
    toast.success(val === 'bulk' ? 'Режим: Массовый' : 'Режим: Единичный');
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Загрузка…
      </div>
    );
  }

  const currentSteps = actionMode === 'bulk' ? BULK_STEPS : SINGLE_STEPS;

  return (
    <div className="space-y-6">
      {/* Action mode */}
      <div className="rounded-lg border p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Сценарий автоматизации</h3>
          <p className="text-sm text-muted-foreground">
            Определяет какие процессы запускаются автоматически при нажатии кнопок.
          </p>
        </div>

        <RadioGroup value={actionMode} onValueChange={(v) => handleActionModeChange(v as ActionMode)} className="space-y-3">
          <div className={`flex items-start gap-3 rounded-md border p-4 hover:bg-muted/50 transition-colors ${actionMode === 'single' ? 'border-primary bg-muted/30' : ''}`}>
            <RadioGroupItem value="single" id="am-single" className="mt-0.5" />
            <div className="space-y-1 flex-1">
              <Label htmlFor="am-single" className="font-medium cursor-pointer">Единичный режим</Label>
              <p className="text-sm text-muted-foreground">Каждый ролик запускается отдельно — пошаговый контроль</p>
            </div>
          </div>
          <div className={`flex items-start gap-3 rounded-md border p-4 hover:bg-muted/50 transition-colors ${actionMode === 'bulk' ? 'border-primary bg-muted/30' : ''}`}>
            <RadioGroupItem value="bulk" id="am-bulk" className="mt-0.5" />
            <div className="space-y-1 flex-1">
              <Label htmlFor="am-bulk" className="font-medium cursor-pointer">Массовый режим</Label>
              <p className="text-sm text-muted-foreground">Параллельные действия над роликами — меньше кнопок, больше автоматизации</p>
            </div>
          </div>
        </RadioGroup>

        <Button variant="outline" size="sm" onClick={() => setShowScenario(!showScenario)}>
          {showScenario ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
          {showScenario ? 'Скрыть сценарий' : 'Показать сценарий'}
        </Button>

        {showScenario && (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Кнопка</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Автоматические действия</th>
                </tr>
              </thead>
              <tbody>
                {currentSteps.map(step => (
                  <tr key={step.buttonKey} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{step.buttonLabel}</td>
                    <td className="px-3 py-2">
                      <ul className="space-y-0.5">
                        {step.processes.map(p => (
                          <li key={p.key} className="text-muted-foreground">— {p.label}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                <Label htmlFor={`mode-${m.value}`} className="font-medium cursor-pointer">{m.label}</Label>
                <p className="text-sm text-muted-foreground">{m.description}</p>
                {m.value === 'v3' && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Motion (движения)</p>
                        <p className="text-xs text-muted-foreground">Предобработка аватара с естественными жестами ($1 за обработку)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="motion-toggle" className="text-xs cursor-pointer text-muted-foreground">{motionEnabled ? 'Вкл' : 'Выкл'}</Label>
                        <Switch id="motion-toggle" checked={motionEnabled} onCheckedChange={handleMotionToggle} />
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

      {/* Video format mode */}
      <div className="rounded-lg border p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Формат ролика</h3>
          <p className="text-sm text-muted-foreground">
            Выберите как генерируется финальное видео: на базе полной фотографии или аватар на фоновой подложке.
          </p>
        </div>

        <RadioGroup value={videoFormatMode} onValueChange={async (val) => {
          setVideoFormatMode(val);
          setSaving(true);
          const { error } = await supabase.from('app_settings').upsert(
            { key: 'video_format_mode', value: val, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          );
          setSaving(false);
          if (error) toast.error('Ошибка сохранения');
          else toast.success(val === 'background_overlay' ? 'Режим: Фоновая подложка' : 'Режим: Полная фотография');
        }} className="space-y-3">
          <div className={`flex items-start gap-3 rounded-md border p-4 hover:bg-muted/50 transition-colors ${videoFormatMode === 'full_photo' ? 'border-primary bg-muted/30' : ''}`}>
            <RadioGroupItem value="full_photo" id="fmt-full" className="mt-0.5" />
            <div className="space-y-1 flex-1">
              <Label htmlFor="fmt-full" className="font-medium cursor-pointer">Видео на базе всей фото</Label>
              <p className="text-sm text-muted-foreground">Стандартный режим — HeyGen генерирует видео на основе полной фотографии сцены</p>
            </div>
          </div>
          <div className={`flex items-start gap-3 rounded-md border p-4 hover:bg-muted/50 transition-colors ${videoFormatMode === 'background_overlay' ? 'border-primary bg-muted/30' : ''}`}>
            <RadioGroupItem value="background_overlay" id="fmt-overlay" className="mt-0.5" />
            <div className="space-y-1 flex-1">
              <Label htmlFor="fmt-overlay" className="font-medium cursor-pointer">Аватар на фоновой подложке</Label>
              <p className="text-sm text-muted-foreground">HeyGen генерирует аватар без фона, затем FFmpeg накладывает его на видео-подложку</p>
            </div>
          </div>
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
