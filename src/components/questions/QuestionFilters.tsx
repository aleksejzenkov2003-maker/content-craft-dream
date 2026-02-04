import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { Filter, CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface FilterState {
  statusFilter: string[];
  safetyFilter: string[];
  dateRange: { from: Date | null; to: Date | null };
  hasVideos: boolean | null;
}

interface QuestionFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const statusOptions = [
  { value: 'pending', label: 'Ожидает' },
  { value: 'checked', label: 'Проверен' },
];

const safetyOptions = [
  { value: 'safe', label: 'Безопасно' },
  { value: 'warning', label: 'Внимание' },
  { value: 'danger', label: 'Опасно' },
  { value: 'unchecked', label: 'Не проверено' },
];

export function QuestionFilters({ filters, onFiltersChange }: QuestionFiltersProps) {
  const [open, setOpen] = useState(false);

  const activeFiltersCount = 
    filters.statusFilter.length + 
    filters.safetyFilter.length + 
    (filters.dateRange.from || filters.dateRange.to ? 1 : 0) +
    (filters.hasVideos !== null ? 1 : 0);

  const toggleArrayFilter = (
    key: 'statusFilter' | 'safetyFilter',
    value: string
  ) => {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  };

  const clearFilters = () => {
    onFiltersChange({
      statusFilter: [],
      safetyFilter: [],
      dateRange: { from: null, to: null },
      hasVideos: null,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs gap-1">
          <Filter className="w-3 h-3" />
          Фильтр
          {activeFiltersCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full text-[10px]">
              {activeFiltersCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="font-medium text-sm">Фильтры</span>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="xs" onClick={clearFilters} className="text-xs h-6">
              <X className="w-3 h-3 mr-1" />
              Сбросить
            </Button>
          )}
        </div>
        
        <div className="p-3 space-y-4 max-h-[400px] overflow-auto">
          {/* Status filter */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Статус вопроса</Label>
            <div className="space-y-1">
              {statusOptions.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                  <Checkbox
                    checked={filters.statusFilter.includes(opt.value)}
                    onCheckedChange={() => toggleArrayFilter('statusFilter', opt.value)}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* Safety filter */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Безопасность</Label>
            <div className="space-y-1">
              {safetyOptions.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                  <Checkbox
                    checked={filters.safetyFilter.includes(opt.value)}
                    onCheckedChange={() => toggleArrayFilter('safetyFilter', opt.value)}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* Date range filter */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Дата публикации</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left text-xs", !filters.dateRange.from && "text-muted-foreground")}>
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    {filters.dateRange.from ? format(filters.dateRange.from, 'dd.MM.yy', { locale: ru }) : 'От'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.from || undefined}
                    onSelect={(date) => onFiltersChange({ 
                      ...filters, 
                      dateRange: { ...filters.dateRange, from: date || null } 
                    })}
                    locale={ru}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left text-xs", !filters.dateRange.to && "text-muted-foreground")}>
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    {filters.dateRange.to ? format(filters.dateRange.to, 'dd.MM.yy', { locale: ru }) : 'До'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.to || undefined}
                    onSelect={(date) => onFiltersChange({ 
                      ...filters, 
                      dateRange: { ...filters.dateRange, to: date || null } 
                    })}
                    locale={ru}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Separator />

          {/* Has videos filter */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Наличие роликов</Label>
            <div className="flex gap-2">
              <Button 
                variant={filters.hasVideos === true ? "default" : "outline"} 
                size="sm" 
                className="flex-1 text-xs"
                onClick={() => onFiltersChange({ ...filters, hasVideos: filters.hasVideos === true ? null : true })}
              >
                С роликами
              </Button>
              <Button 
                variant={filters.hasVideos === false ? "default" : "outline"} 
                size="sm" 
                className="flex-1 text-xs"
                onClick={() => onFiltersChange({ ...filters, hasVideos: filters.hasVideos === false ? null : false })}
              >
                Без роликов
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
