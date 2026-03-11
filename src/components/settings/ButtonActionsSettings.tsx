import { useAutomationSettings } from '@/hooks/useAutomationSettings';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Send, Play, Layers } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ReactNode } from 'react';

interface ButtonConfig {
  key: string;
  section: string;
  precheck: string;
  preview: ReactNode;
}

const BUTTONS: ButtonConfig[] = [
  {
    key: 'take_in_work',
    section: 'Вопросы',
    precheck: 'Дата, плейлист, сцена',
    preview: (
      <Button size="xs" variant="secondary" className="pointer-events-none">
        <Play className="w-3 h-3 mr-1" />Взять в работу
      </Button>
    ),
  },
  {
    key: 'side_cover',
    section: 'Панель ролика',
    precheck: '—',
    preview: (
      <Button size="xs" variant="outline" className="pointer-events-none border-orange-500/50 text-orange-700">
        <RefreshCw className="w-3 h-3 mr-1" />Шаг 2. Обложка
      </Button>
    ),
  },
  {
    key: 'generate_video',
    section: 'Таблица роликов',
    precheck: 'Наличие озвучки',
    preview: (
      <Button size="xs" variant="generate-video" className="pointer-events-none">
        Видео
      </Button>
    ),
  },
  {
    key: 'side_video',
    section: 'Панель ролика',
    precheck: 'Наличие озвучки',
    preview: (
      <Button size="xs" variant="outline" className="pointer-events-none border-green-500/50 text-green-700">
        <RefreshCw className="w-3 h-3 mr-1" />Шаг 3. Видео
      </Button>
    ),
  },
  {
    key: 'prepare_publish',
    section: 'Панель ролика',
    precheck: 'Готовность + каналы',
    preview: (
      <Button size="sm" variant="default" className="pointer-events-none h-7 text-xs">
        Отправить на подготовку к публикации
      </Button>
    ),
  },
  {
    key: 'bulk_generate_covers',
    section: 'Таблица роликов',
    precheck: '—',
    preview: (
      <Button size="xs" variant="generate-cover" className="pointer-events-none">
        <Layers className="w-3 h-3 mr-1" />Обложки
      </Button>
    ),
  },
  {
    key: 'bulk_publish',
    section: 'Таблица роликов',
    precheck: 'Плановая дата',
    preview: (
      <Button size="xs" variant="publish" className="pointer-events-none">
        <Send className="w-3 h-3 mr-1" />Публикация
      </Button>
    ),
  },
  {
    key: 'publish',
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const grouped = BUTTONS.map(btn => ({
    ...btn,
    processes: settings.filter(s => s.button_key === btn.key),
  }));

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Кнопка</TableHead>
            <TableHead className="w-[140px]">Раздел</TableHead>
            <TableHead className="w-[160px]">Предпроверка</TableHead>
            <TableHead>Процессы</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map(btn => (
            <TableRow key={btn.key}>
              <TableCell className="align-top py-3">
                <div className="flex flex-col gap-1.5">
                  {btn.preview}
                  <span className="text-[10px] text-muted-foreground font-mono">{btn.key}</span>
                </div>
              </TableCell>
              <TableCell className="align-top py-3">
                <Badge variant="secondary" className="text-[10px]">{btn.section}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground align-top py-3">
                {btn.precheck}
              </TableCell>
              <TableCell className="py-3">
                <div className="flex flex-col gap-2">
                  {btn.processes.map(proc => (
                    <label
                      key={proc.process_key}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={proc.is_enabled}
                        onCheckedChange={(checked) =>
                          toggle(btn.key, proc.process_key, !!checked)
                        }
                      />
                      <span className="text-sm">{proc.process_label}</span>
                    </label>
                  ))}
                  {btn.processes.length === 0 && (
                    <span className="text-xs text-muted-foreground">Нет процессов</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
