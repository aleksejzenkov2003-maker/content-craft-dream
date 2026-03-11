import { useAutomationSettings } from '@/hooks/useAutomationSettings';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Send, Play, Layers, Image, Video } from 'lucide-react';
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
  label: string;
  section: string;
  precheck: string;
  preview: ReactNode;
}

const BUTTONS: ButtonConfig[] = [
  {
    key: 'take_in_work',
    label: 'Взят в работу',
    section: 'Вопросы',
    precheck: '—',
    preview: (
      <Button size="sm" variant="default" className="pointer-events-none h-7 text-xs">
        <Play className="w-3 h-3 mr-1" />Взят в работу
      </Button>
    ),
  },
  {
    key: 'generate_video',
    label: 'Генерация видео',
    section: 'Ролики',
    precheck: 'Проверка фона и обложки',
    preview: (
      <Button size="sm" variant="outline" className="pointer-events-none h-7 text-xs border-green-500/50 text-green-700">
        <RefreshCw className="w-3 h-3 mr-1" />Шаг 3. Видео
      </Button>
    ),
  },
  {
    key: 'side_cover',
    label: 'Шаг 2. Обложка',
    section: 'Панель ролика',
    precheck: 'Проверка фона',
    preview: (
      <Button size="sm" variant="outline" className="pointer-events-none h-7 text-xs border-orange-500/50 text-orange-700">
        <RefreshCw className="w-3 h-3 mr-1" />Шаг 2. Обложка
      </Button>
    ),
  },
  {
    key: 'side_video',
    label: 'Шаг 3. Видео',
    section: 'Панель ролика',
    precheck: 'Наличие озвучки',
    preview: (
      <Button size="sm" variant="outline" className="pointer-events-none h-7 text-xs border-green-500/50 text-green-700">
        <RefreshCw className="w-3 h-3 mr-1" />Шаг 3. Видео
      </Button>
    ),
  },
  {
    key: 'prepare_publish',
    label: 'Подготовка к публикации',
    section: 'Ролики',
    precheck: 'Выбор Соцсетей',
    preview: (
      <Button size="sm" variant="default" className="pointer-events-none h-7 text-xs">
        <Send className="w-3 h-3 mr-1" />Подготовка к публикации
      </Button>
    ),
  },
  {
    key: 'bulk_generate_covers',
    label: 'Массовая генерация обложек',
    section: 'Ролики',
    precheck: '—',
    preview: (
      <Button size="sm" variant="outline" className="pointer-events-none h-7 text-xs">
        <Layers className="w-3 h-3 mr-1" />Обложки
      </Button>
    ),
  },
  {
    key: 'bulk_publish',
    label: 'Массовая публикация',
    section: 'Ролики',
    precheck: 'Плановая дата',
    preview: (
      <Button size="sm" variant="outline" className="pointer-events-none h-7 text-xs">
        <Send className="w-3 h-3 mr-1" />Публикация
      </Button>
    ),
  },
  {
    key: 'publish',
    label: 'Опубликовать',
    section: 'Публикации',
    precheck: 'Проверка текстов',
    preview: (
      <Button size="sm" variant="default" className="pointer-events-none h-7 text-xs bg-green-600 hover:bg-green-600">
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
            <TableHead className="w-[220px]">Кнопка</TableHead>
            <TableHead className="w-[120px]">Раздел</TableHead>
            <TableHead className="w-[180px]">Предпроверка</TableHead>
            <TableHead>Процессы</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map(btn => (
            <TableRow key={btn.key}>
              <TableCell className="align-top py-3">
                <div className="flex flex-col gap-1.5">
                  {btn.preview}
                  <span className="text-[10px] text-muted-foreground">{btn.key}</span>
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
