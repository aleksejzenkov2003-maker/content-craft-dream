import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';

interface DateRangeFilterProps {
  dateFrom?: Date;
  dateTo?: Date;
  onDateChange: (from: Date | undefined, to: Date | undefined) => void;
}

const presets = [
  { label: 'Сегодня', getValue: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: 'Вчера', getValue: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { label: 'Неделя', getValue: () => ({ from: startOfWeek(new Date(), { locale: ru }), to: new Date() }) },
  { label: 'Месяц', getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'Все время', getValue: () => ({ from: undefined, to: undefined }) },
];

export function DateRangeFilter({ dateFrom, dateTo, onDateChange }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePreset = (preset: typeof presets[0]) => {
    const { from, to } = preset.getValue();
    onDateChange(from, to);
    setIsOpen(false);
  };

  const formatDateRange = () => {
    if (!dateFrom && !dateTo) return 'Все время';
    if (dateFrom && dateTo) {
      if (format(dateFrom, 'dd.MM.yyyy') === format(dateTo, 'dd.MM.yyyy')) {
        return format(dateFrom, 'd MMM yyyy', { locale: ru });
      }
      return `${format(dateFrom, 'd MMM', { locale: ru })} — ${format(dateTo, 'd MMM yyyy', { locale: ru })}`;
    }
    if (dateFrom) return `с ${format(dateFrom, 'd MMM yyyy', { locale: ru })}`;
    if (dateTo) return `до ${format(dateTo, 'd MMM yyyy', { locale: ru })}`;
    return 'Выбрать даты';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[200px] justify-start text-left font-normal bg-secondary/50',
            !dateFrom && !dateTo && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDateRange()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="border-r p-2 space-y-1">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => handlePreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="p-2">
            <Calendar
              mode="range"
              selected={{ from: dateFrom, to: dateTo }}
              onSelect={(range) => {
                onDateChange(range?.from, range?.to);
              }}
              numberOfMonths={1}
              locale={ru}
              className="pointer-events-auto"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
