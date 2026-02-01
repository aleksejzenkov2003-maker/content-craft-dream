import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

export interface VideoFilterState {
  coverStatusFilter: string[];
  videoStatusFilter: string[];
  hasCover: boolean | null;
  hasVideo: boolean | null;
  dateRange: { from: Date | null; to: Date | null };
}

interface VideoFiltersProps {
  filters: VideoFilterState;
  onFiltersChange: (filters: VideoFilterState) => void;
}

const coverStatusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'generating', label: 'In progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'error', label: 'Error' },
];

const videoStatusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'generating', label: 'In progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'published', label: 'Published' },
  { value: 'error', label: 'Error' },
];

export function VideoFilters({ filters, onFiltersChange }: VideoFiltersProps) {
  const [open, setOpen] = useState(false);

  const activeFiltersCount = [
    filters.coverStatusFilter.length > 0,
    filters.videoStatusFilter.length > 0,
    filters.hasCover !== null,
    filters.hasVideo !== null,
    filters.dateRange.from !== null || filters.dateRange.to !== null,
  ].filter(Boolean).length;

  const toggleCoverStatus = (value: string) => {
    const newFilter = filters.coverStatusFilter.includes(value)
      ? filters.coverStatusFilter.filter((v) => v !== value)
      : [...filters.coverStatusFilter, value];
    onFiltersChange({ ...filters, coverStatusFilter: newFilter });
  };

  const toggleVideoStatus = (value: string) => {
    const newFilter = filters.videoStatusFilter.includes(value)
      ? filters.videoStatusFilter.filter((v) => v !== value)
      : [...filters.videoStatusFilter, value];
    onFiltersChange({ ...filters, videoStatusFilter: newFilter });
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        from: range?.from || null,
        to: range?.to || null,
      },
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      coverStatusFilter: [],
      videoStatusFilter: [],
      hasCover: null,
      hasVideo: null,
      dateRange: { from: null, to: null },
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="w-4 h-4 mr-2" />
          Фильтры
          {activeFiltersCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Фильтры</h4>
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={clearFilters}
                className="text-muted-foreground"
              >
                <X className="w-3 h-3 mr-1" />
                Сбросить
              </Button>
            )}
          </div>

          {/* Cover Status Filter */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Статус обложки</Label>
            <div className="flex flex-wrap gap-2">
              {coverStatusOptions.map((option) => (
                <Badge
                  key={option.value}
                  variant={
                    filters.coverStatusFilter.includes(option.value)
                      ? 'default'
                      : 'outline'
                  }
                  className="cursor-pointer"
                  onClick={() => toggleCoverStatus(option.value)}
                >
                  {option.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Video Status Filter */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Статус видео</Label>
            <div className="flex flex-wrap gap-2">
              {videoStatusOptions.map((option) => (
                <Badge
                  key={option.value}
                  variant={
                    filters.videoStatusFilter.includes(option.value)
                      ? 'default'
                      : 'outline'
                  }
                  className="cursor-pointer"
                  onClick={() => toggleVideoStatus(option.value)}
                >
                  {option.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Has Cover / Has Video */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Обложка</Label>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="has-cover-yes"
                    checked={filters.hasCover === true}
                    onCheckedChange={(checked) =>
                      onFiltersChange({
                        ...filters,
                        hasCover: checked ? true : null,
                      })
                    }
                  />
                  <label htmlFor="has-cover-yes" className="text-xs">
                    Есть
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="has-cover-no"
                    checked={filters.hasCover === false}
                    onCheckedChange={(checked) =>
                      onFiltersChange({
                        ...filters,
                        hasCover: checked ? false : null,
                      })
                    }
                  />
                  <label htmlFor="has-cover-no" className="text-xs">
                    Нет
                  </label>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Видео</Label>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="has-video-yes"
                    checked={filters.hasVideo === true}
                    onCheckedChange={(checked) =>
                      onFiltersChange({
                        ...filters,
                        hasVideo: checked ? true : null,
                      })
                    }
                  />
                  <label htmlFor="has-video-yes" className="text-xs">
                    Есть
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="has-video-no"
                    checked={filters.hasVideo === false}
                    onCheckedChange={(checked) =>
                      onFiltersChange({
                        ...filters,
                        hasVideo: checked ? false : null,
                      })
                    }
                  />
                  <label htmlFor="has-video-no" className="text-xs">
                    Нет
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Дата создания</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  {filters.dateRange.from ? (
                    filters.dateRange.to ? (
                      <>
                        {format(filters.dateRange.from, 'dd.MM.yyyy', { locale: ru })} -{' '}
                        {format(filters.dateRange.to, 'dd.MM.yyyy', { locale: ru })}
                      </>
                    ) : (
                      format(filters.dateRange.from, 'dd.MM.yyyy', { locale: ru })
                    )
                  ) : (
                    <span className="text-muted-foreground">Выберите период</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{
                    from: filters.dateRange.from || undefined,
                    to: filters.dateRange.to || undefined,
                  }}
                  onSelect={handleDateRangeChange}
                  numberOfMonths={2}
                  locale={ru}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
