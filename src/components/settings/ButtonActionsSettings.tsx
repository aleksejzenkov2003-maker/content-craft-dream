import { useAutomationSettings } from '@/hooks/useAutomationSettings';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ButtonConfig {
  key: string;
  label: string;
  section: string;
  precheck: string;
}

const BUTTONS: ButtonConfig[] = [
  { key: 'take_in_work', label: 'Взят в работу', section: 'Вопросы', precheck: '—' },
  { key: 'generate_video', label: 'Генерация видео', section: 'Ролики', precheck: 'Проверка фона и обложки' },
  { key: 'side_cover', label: 'Шаг 2. Обложка', section: 'Панель ролика', precheck: 'Проверка фона' },
  { key: 'side_video', label: 'Шаг 3. Видео', section: 'Панель ролика', precheck: 'Наличие озвучки' },
  { key: 'prepare_publish', label: 'Подготовка к публикации', section: 'Ролики', precheck: 'Выбор Соцсетей' },
  { key: 'bulk_generate_covers', label: 'Массовая генерация обложек', section: 'Ролики', precheck: '—' },
  { key: 'bulk_publish', label: 'Массовая публикация', section: 'Ролики', precheck: 'Плановая дата' },
  { key: 'publish', label: 'Опубликовать', section: 'Публикации', precheck: 'Проверка текстов' },
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
            <TableHead className="w-[200px]">Кнопка</TableHead>
            <TableHead className="w-[120px]">Раздел</TableHead>
            <TableHead className="w-[200px]">Предварительная проверка</TableHead>
            <TableHead>Процессы</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map(btn => (
            <TableRow key={btn.key}>
              <TableCell className="font-medium text-sm align-top py-3">
                {btn.label}
              </TableCell>
              <TableCell className="align-top py-3">
                <Badge variant="secondary" className="text-[10px]">{btn.section}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground align-top py-3">
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
