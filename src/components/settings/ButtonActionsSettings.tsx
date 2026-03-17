import { useAutomationSettings } from '@/hooks/useAutomationSettings';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Send, Play, Layers } from 'lucide-react';
import { ReactNode, useMemo } from 'react';

interface ColumnConfig {
  buttonKey: string;
  label: string;
  section: string;
  precheck: string;
  preview: ReactNode;
}

const COLUMNS: ColumnConfig[] = [
  {
    buttonKey: 'take_in_work',
    label: 'Взять в работу',
    section: 'Вопросы',
    precheck: 'Дата, плейлист, сцена',
    preview: (
      <Button size="xs" variant="secondary" className="pointer-events-none">
        <Play className="w-3 h-3 mr-1" />В работу
      </Button>
    ),
  },
  {
    buttonKey: 'side_step1',
    label: 'Шаг 1. ФОН',
    section: 'Панель ролика',
    precheck: '—',
    preview: (
      <Button size="xs" variant="outline" className="pointer-events-none border-amber-500/50 text-amber-700">
        <RefreshCw className="w-3 h-3 mr-1" />Шаг 1
      </Button>
    ),
  },
  {
    buttonKey: 'side_cover',
    label: 'Шаг 2. Обложка',
    section: 'Панель ролика',
    precheck: '—',
    preview: (
      <Button size="xs" variant="outline" className="pointer-events-none border-orange-500/50 text-orange-700">
        <RefreshCw className="w-3 h-3 mr-1" />Шаг 2
      </Button>
    ),
  },
  {
    buttonKey: 'generate_video',
    label: 'Видео (таблица)',
    section: 'Таблица роликов',
    precheck: 'Озвучка',
    preview: (
      <Button size="xs" variant="generate-video" className="pointer-events-none">Видео</Button>
    ),
  },
  {
    buttonKey: 'bulk_generate_covers',
    label: 'Обложки (массово)',
    section: 'Таблица роликов',
    precheck: '—',
    preview: (
      <Button size="xs" variant="generate-cover" className="pointer-events-none">
        <Layers className="w-3 h-3 mr-1" />Обл.
      </Button>
    ),
  },
  {
    buttonKey: 'side_video',
    label: 'Шаг 3. Видео',
    section: 'Панель ролика',
    precheck: 'Озвучка',
    preview: (
      <Button size="xs" variant="outline" className="pointer-events-none border-green-500/50 text-green-700">
        <RefreshCw className="w-3 h-3 mr-1" />Шаг 3
      </Button>
    ),
  },
  {
    buttonKey: 'prepare_publish',
    label: 'Подготовка',
    section: 'Ролики',
    precheck: 'Проверено + каналы',
    preview: (
      <Button size="xs" variant="default" className="pointer-events-none">
        <Send className="w-3 h-3 mr-1" />Подг.
      </Button>
    ),
  },
  {
    buttonKey: 'bulk_publish',
    label: 'Массовая подготовка',
    section: 'Ролики',
    precheck: 'Проверено + каналы',
    preview: (
      <Button size="xs" variant="default" className="pointer-events-none">
        <Layers className="w-3 h-3 mr-1" />Масс.
      </Button>
    ),
  },
  {
    buttonKey: 'publish',
    label: 'Опубликовать',
    section: 'Публикации',
    precheck: 'Текст + видео',
    preview: (
      <Button size="xs" variant="publish" className="pointer-events-none">
        <Send className="w-3 h-3 mr-1" />Публ.
      </Button>
    ),
  },
];

export function ButtonActionsSettings() {
  const { settings, isLoading, toggle } = useAutomationSettings();

  // Derive unique process rows from settings data
  const processRows = useMemo(() => {
    const allKeys = new Map<string, string>();
    settings.forEach(s => {
      if (!allKeys.has(s.process_key)) {
        allKeys.set(s.process_key, s.process_label);
      }
    });
    return Array.from(allKeys.entries()).map(([key, label]) => ({ key, label }));
  }, [settings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Build a lookup: `${buttonKey}::${processKey}` -> setting
  const settingsMap = new Map(
    settings.map(s => [`${s.button_key}::${s.process_key}`, s])
  );

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {/* Row 1: button previews */}
          <tr className="border-b bg-muted/30">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground min-w-[160px] sticky left-0 bg-muted/30 z-10">
              Процесс
            </th>
            {COLUMNS.map(col => (
              <th key={col.buttonKey} className="px-2 py-2 text-center min-w-[90px]">
                <div className="flex flex-col items-center gap-1">
                  {col.preview}
                </div>
              </th>
            ))}
          </tr>
          {/* Row 2: section + precheck */}
          <tr className="border-b bg-muted/10">
            <th className="px-3 py-1.5 sticky left-0 bg-muted/10 z-10"></th>
            {COLUMNS.map(col => (
              <th key={col.buttonKey + '_info'} className="px-2 py-1.5 text-center">
                <Badge variant="secondary" className="text-[10px] mb-0.5">{col.section}</Badge>
                <p className="text-[10px] text-muted-foreground font-normal">{col.precheck}</p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processRows.map(proc => (
            <tr key={proc.key} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
              <td className="px-3 py-2.5 text-foreground sticky left-0 bg-background z-10">{proc.label}</td>
              {COLUMNS.map(col => {
                const setting = settingsMap.get(`${col.buttonKey}::${proc.key}`);
                return (
                  <td key={col.buttonKey + proc.key} className="px-2 py-2.5 text-center">
                    {setting ? (
                      <div className="flex justify-center">
                        <Checkbox
                          checked={setting.is_enabled}
                          onCheckedChange={(checked) =>
                            toggle(setting.button_key, setting.process_key, !!checked)
                          }
                        />
                      </div>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {processRows.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="px-3 py-6 text-center text-muted-foreground">
                Нет настроек автоматизации
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
