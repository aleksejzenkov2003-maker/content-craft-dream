import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Filter, X, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface PublicationFilterState {
  statuses: string[];
  channelIds: string[];
  hasGeneratedText: boolean | null;
  dateRange: { from: Date | null; to: Date | null };
}

interface PublicationFiltersProps {
  channels: { id: string; name: string }[];
  filters: PublicationFilterState;
  onFiltersChange: (filters: PublicationFilterState) => void;
}

const statusOptions = [
  { value: 'pending', label: 'Ожидает' },
  { value: 'checked', label: 'Проверено' },
  { value: 'scheduled', label: 'Запланирован' },
  { value: 'published', label: 'Опубликован' },
  { value: 'failed', label: 'Ошибка' },
];

export function PublicationFilters({
  channels,
  filters,
  onFiltersChange,
}: PublicationFiltersProps) {
  const [open, setOpen] = useState(false);
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const activeFiltersCount =
    filters.statuses.length +
    filters.channelIds.length +
    (filters.hasGeneratedText !== null ? 1 : 0) +
    (filters.dateRange.from ? 1 : 0) +
    (filters.dateRange.to ? 1 : 0);

  const handleStatusToggle = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const handleChannelToggle = (channelId: string) => {
    const newChannelIds = filters.channelIds.includes(channelId)
      ? filters.channelIds.filter((id) => id !== channelId)
      : [...filters.channelIds, channelId];
    onFiltersChange({ ...filters, channelIds: newChannelIds });
  };

  const handleTextFilterChange = (value: boolean | null) => {
    onFiltersChange({ ...filters, hasGeneratedText: value });
  };

  const handleDateFromChange = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      dateRange: { ...filters.dateRange, from: date || null },
    });
    setDateFromOpen(false);
  };

  const handleDateToChange = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      dateRange: { ...filters.dateRange, to: date || null },
    });
    setDateToOpen(false);
  };

  const clearFilters = () => {
    onFiltersChange({
      statuses: [],
      channelIds: [],
      hasGeneratedText: null,
      dateRange: { from: null, to: null },
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Фильтры
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Фильтры</h4>
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-auto px-2 py-1 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Сбросить
              </Button>
            )}
          </div>

          {/* Status filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Статус</Label>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map((status) => (
                <label
                  key={status.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={filters.statuses.includes(status.value)}
                    onCheckedChange={() => handleStatusToggle(status.value)}
                  />
                  <span className="text-sm">{status.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Channel filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Канал</Label>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {channels.map((channel) => (
                <label
                  key={channel.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={filters.channelIds.includes(channel.id)}
                    onCheckedChange={() => handleChannelToggle(channel.id)}
                  />
                  <span className="text-sm truncate">{channel.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Generated text filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Сгенерированный текст</Label>
            <div className="flex gap-2">
              <Button
                variant={filters.hasGeneratedText === true ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  handleTextFilterChange(
                    filters.hasGeneratedText === true ? null : true
                  )
                }
              >
                Есть
              </Button>
              <Button
                variant={filters.hasGeneratedText === false ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  handleTextFilterChange(
                    filters.hasGeneratedText === false ? null : false
                  )
                }
              >
                Нет
              </Button>
            </div>
          </div>

          {/* Date range filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Период публикации</Label>
            <div className="flex gap-2">
              <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'flex-1 justify-start text-left font-normal',
                      !filters.dateRange.from && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {filters.dateRange.from
                      ? format(filters.dateRange.from, 'dd.MM.yy', { locale: ru })
                      : 'От'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.from || undefined}
                    onSelect={handleDateFromChange}
                    locale={ru}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'flex-1 justify-start text-left font-normal',
                      !filters.dateRange.to && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {filters.dateRange.to
                      ? format(filters.dateRange.to, 'dd.MM.yy', { locale: ru })
                      : 'До'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.to || undefined}
                    onSelect={handleDateToChange}
                    locale={ru}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
