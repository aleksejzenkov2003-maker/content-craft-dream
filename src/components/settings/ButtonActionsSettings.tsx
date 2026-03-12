import { useAutomationSettings } from '@/hooks/useAutomationSettings';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Send, Play, Layers } from 'lucide-react';
import { ReactNode, useMemo } from 'react';

interface ColumnConfig {
  buttonKeys: string[];
  label: string;
  section: string;
  precheck: string;
  preview: ReactNode;
}

const COLUMNS: ColumnConfig[] = [
  {
    buttonKeys: ['take_in_work'],
    label: 'Взять в работу',
    section: 'Вопросы',
    precheck: 'Дата, плейлист, сцена',
    preview: (
      <Button size="xs" variant="secondary" className="pointer-events-none">
        <Play className="w-3 h-3 mr-1" />Взять в работу
      </Button>
    ),
  },
  {
    buttonKeys: ['side_cover'],
    label: 'Обложка (панель)',
    section: 'Панель ролика',
    precheck: '—',
    preview: (
      <Button size="xs" variant="outline" className="pointer-events-none border-orange-500/50 text-orange-700">
        <RefreshCw className="w-3 h-3 mr-1" />Шаг 2
      </Button>
    ),
  },
  {
    buttonKeys: ['generate_video', 'bulk_generate_covers'],
    label: 'Генерация видео',
    section: 'Таблица роликов',
    precheck: 'Наличие озвучки',
    preview: (
      <div className="flex gap-1">
        <Button size="xs" variant="generate-video" className="pointer-events-none">Видео</Button>
        <Button size="xs" variant="generate-cover" className="pointer-events-none">
          <Layers className="w-3 h-3 mr-1" />Обл.
        </Button>
      </div>
    ),
  },
  {
    buttonKeys: ['side_video'],
    label: 'Видео (панель)',
    section: 'Панель ролика',
    precheck: 'Наличие озвучки',
    preview: (
      <Button size="xs" variant="outline" className="pointer-events-none border-green-500/50 text-green-700">
        <RefreshCw className="w-3 h-3 mr-1" />Шаг 3
      </Button>
    ),
  },
  {
    buttonKeys: ['prepare_publish', 'bulk_publish'],
    label: 'Подготовка к публикации',
    section: 'Ролики',
    precheck: 'Готовность + каналы',
    preview: (
      <Button size="xs" variant="default" className="pointer-events-none">
        <Send className="w-3 h-3 mr-1" />Подготовка
      </Button>
    ),
  },
  {
    buttonKeys: ['publish'],
    label: 'Опубликовать',
    section: 'Публикации',
    precheck: 'Текст + видео',
    preview: (
      <Button size="xs" variant="publish" className="pointer-events-none">
        <Send className="w-3 h-3 mr-1" />Опубликовать
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

  const findSetting = (buttonKeys: string[], processKey: string) => {
    for (const bk of buttonKeys) {
      const s = settingsMap.get(`${bk}::${processKey}`);
      if (s) return s;
    }
    return null;
  };

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {/* Row 1: button previews */}
          <tr className="border-b bg-muted/30">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground min-w-[180px]">
              Процесс
            </th>
            {COLUMNS.map(col => (
              <th key={col.buttonKeys.join(',')} className="px-3 py-2 text-center min-w-[120px]">
                <div className="flex flex-col items-center gap-1">
                  {col.preview}
                </div>
              </th>
            ))}
          </tr>
          {/* Row 2: section + precheck */}
          <tr className="border-b bg-muted/10">
            <th className="px-3 py-1.5"></th>
            {COLUMNS.map(col => (
              <th key={col.buttonKeys.join(',') + '_info'} className="px-3 py-1.5 text-center">
                <Badge variant="secondary" className="text-[10px] mb-0.5">{col.section}</Badge>
                <p className="text-[10px] text-muted-foreground font-normal">{col.precheck}</p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processRows.map(proc => (
            <tr key={proc.key} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
              <td className="px-3 py-2.5 text-foreground">{proc.label}</td>
              {COLUMNS.map(col => {
                const setting = findSetting(col.buttonKeys, proc.key);
                return (
                  <td key={col.buttonKeys.join(',') + proc.key} className="px-3 py-2.5 text-center">
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
