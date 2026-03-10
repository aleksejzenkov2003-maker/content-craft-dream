import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, Loader2, FileSpreadsheet, Trash2, Check, ArrowUpDown, ArrowUp, ArrowDown, CalendarIcon, Clock, Settings2, Play } from 'lucide-react';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Video as VideoType } from '@/hooks/useVideos';
import { Publication } from '@/hooks/usePublications';
import { format, setHours, setMinutes } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CsvImporter } from '@/components/import/CsvImporter';
import { QUESTION_COLUMN_MAPPING, QUESTION_PREVIEW_COLUMNS, QUESTION_FIELD_DEFINITIONS } from '@/components/import/importConfigs';
import { InlineEdit, SelectOption } from '@/components/ui/inline-edit';
import { BulkActionsBar, BulkActionButton } from '@/components/ui/bulk-actions-bar';
import { QuestionFilters, FilterState } from './QuestionFilters';
import { cn } from '@/lib/utils';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Playlist {
  id: string;
  name: string;
}

interface AdvisorLookup {
  id: string;
  name: string;
  display_name?: string | null;
}

interface QuestionsTableProps {
  videos: VideoType[];
  publications: Publication[];
  loading: boolean;
  selectedQuestionIds?: string[];
  onSelectionChange?: (questionKeys: string[]) => void;
  onAddQuestion?: (data: { 
    question_id: number; 
    question: string; 
    question_rus?: string;
    question_eng?: string;
    hook_rus?: string;
    hook_eng?: string;
    safety_score: string;
    playlist_id?: string | null;
    publication_date?: string | null;
  }) => void;
  onGoToVideos?: () => void;
  onUpdateQuestion?: (uniqueKey: string, updates: { question?: string; question_eng?: string; safety_score?: string; publication_date?: string; question_status?: string; playlist_id?: string }) => void;
  onBulkImport?: (data: Record<string, any>[]) => Promise<void>;
  onDeleteQuestion?: (uniqueKey: string) => Promise<void>;
  playlists?: Playlist[];
  advisors?: AdvisorLookup[];
  onBulkUpdateStatus?: (uniqueKeys: string[], status: string) => Promise<void>;
  onBulkUpdateDate?: (uniqueKeys: string[], date: string) => Promise<void>;
  onStartProduction?: (uniqueKeys: string[]) => Promise<void>;
}

interface QuestionData {
  unique_key: string;
  question_id: number;
  question: string;
  question_rus: string | null;
  question_eng: string | null;
  hook: string | null;
  hook_rus: string | null;
  safety_score: string;
  relevance_score: number;
  question_status: string;
  planned_date: string | null;
  videos_count: number;
  total_publications: number;
  has_video: boolean;
  has_cover: boolean;
  has_published: boolean;
  playlist_id: string | null;
  playlist_name: string | null;
}

const safetyOptions: SelectOption[] = [
  { value: 'safe', label: 'Безопасно' },
  { value: 'critical', label: 'Критический' },
  { value: 'medium_risk', label: 'Средний риск' },
  { value: 'high_risk', label: 'Высокий риск' },
];

const statusOptions: SelectOption[] = [
  { value: 'not_selected', label: 'Не отобран' },
  { value: 'in_progress', label: 'Взят в работу' },
  { value: 'published', label: 'Опубликован' },
];

type SortColumn = 'id' | 'relevance' | 'date' | 'safety' | 'question' | 'status' | null;
type SortDirection = 'asc' | 'desc';

export function QuestionsTable({ 
  videos, 
  publications, 
  loading, 
  onUpdateQuestion,
  onBulkImport,
  onDeleteQuestion,
  playlists = [],
  advisors = [],
  onBulkUpdateStatus,
  onBulkUpdateDate,
  onStartProduction,
}: QuestionsTableProps) {
  const [searchInput, setSearchInput] = useState('');
  const [showImporter, setShowImporter] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [deleteQuestionKey, setDeleteQuestionKey] = useState<string | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  
  // Filters and sorting state
  const [filters, setFilters] = useState<FilterState>({
    statusFilter: [],
    safetyFilter: [],
    safetyRange: { from: null, to: null },
    dateRange: { from: null, to: null },
  });
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Bulk action dialog state
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [showBulkDateDialog, setShowBulkDateDialog] = useState(false);
  const [bulkActionValue, setBulkActionValue] = useState('');
  const [bulkDateValue, setBulkDateValue] = useState<Date | undefined>(undefined);
  const [bulkHour, setBulkHour] = useState('12');
  const [bulkMinute, setBulkMinute] = useState('00');

  // Aggregate questions from videos using composite key
  const questions = useMemo(() => {
    const questionMap = new Map<string, QuestionData>();
    
    videos.forEach(video => {
      if (video.question_id !== null && video.question_id !== undefined) {
        const uniqueKey = `${video.question_id}`;
        const existing = questionMap.get(uniqueKey);
        const videoPublications = publications.filter(p => p.video_id === video.id);
        
        if (existing) {
          existing.videos_count += 1;
          existing.total_publications += videoPublications.length;
          if (video.heygen_video_url) existing.has_video = true;
          if (video.front_cover_url || video.cover_url) existing.has_cover = true;
          if (videoPublications.some(p => p.publication_status === 'published')) existing.has_published = true;
          if (video.publication_date && (!existing.planned_date || video.publication_date < existing.planned_date)) {
            existing.planned_date = video.publication_date;
          }
          if ((video.relevance_score || 0) > existing.relevance_score) {
            existing.relevance_score = video.relevance_score || 0;
          }
          // Merge language fields from all videos in the group
          if (!existing.question_rus && video.question_rus) existing.question_rus = video.question_rus;
          if (!existing.question_eng && video.question_eng) existing.question_eng = video.question_eng;
          if (!existing.hook_rus && video.hook_rus) existing.hook_rus = video.hook_rus;
          if (!existing.hook && video.hook) existing.hook = video.hook;
        } else {
          questionMap.set(uniqueKey, {
            unique_key: uniqueKey,
            question_id: video.question_id,
            question: video.question || '',
            question_rus: video.question_rus || null,
            question_eng: video.question_eng || null,
            hook: video.hook || null,
            hook_rus: video.hook_rus || null,
            safety_score: video.safety_score || 'safe',
            relevance_score: video.relevance_score || 0,
            question_status: video.question_status || 'not_selected',
            planned_date: video.publication_date,
            videos_count: 1,
            total_publications: videoPublications.length,
            has_video: !!video.heygen_video_url,
            has_cover: !!(video.front_cover_url || video.cover_url),
            has_published: videoPublications.some(p => p.publication_status === 'published'),
            playlist_id: video.playlist_id || null,
            playlist_name: video.playlist?.name || null,
          });
        }
      }
    });
    
    return Array.from(questionMap.values());
  }, [videos, publications]);

  // Apply filters
  const filteredQuestions = useMemo(() => {
    let result = questions;
    
    // Text search
    if (searchInput.trim()) {
      const search = searchInput.toLowerCase();
      result = result.filter(q => 
        q.question.toLowerCase().includes(search) ||
        (q.question_rus?.toLowerCase().includes(search)) ||
        (q.question_eng?.toLowerCase().includes(search)) ||
        q.question_id.toString().includes(search)
      );
    }
    
    // Status filter
    if (filters.statusFilter.length > 0) {
      result = result.filter(q => filters.statusFilter.includes(q.question_status));
    }
    
    // Safety filter (category checkboxes)
    if (filters.safetyFilter.length > 0) {
      result = result.filter(q => filters.safetyFilter.includes(q.safety_score));
    }
    
    // Safety range filter (numeric 0-100)
    if (filters.safetyRange.from !== null || filters.safetyRange.to !== null) {
      const safetyToNumber: Record<string, number> = { critical: 0, high_risk: 25, medium_risk: 50, safe: 100 };
      result = result.filter(q => {
        const numericValue = safetyToNumber[q.safety_score] ?? 50;
        if (filters.safetyRange.from !== null && numericValue < filters.safetyRange.from) return false;
        if (filters.safetyRange.to !== null && numericValue > filters.safetyRange.to) return false;
        return true;
      });
    }
    
    // Date range filter
    if (filters.dateRange.from || filters.dateRange.to) {
      result = result.filter(q => {
        if (!q.planned_date) return false;
        const date = new Date(q.planned_date);
        if (filters.dateRange.from && date < filters.dateRange.from) return false;
        if (filters.dateRange.to && date > filters.dateRange.to) return false;
        return true;
      });
    }
    
    // Apply sorting
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let comparison = 0;
        switch (sortColumn) {
          case 'id':
            comparison = a.question_id - b.question_id;
            break;
          case 'relevance':
            comparison = a.relevance_score - b.relevance_score;
            break;
          case 'date':
            const dateA = a.planned_date ? new Date(a.planned_date).getTime() : 0;
            const dateB = b.planned_date ? new Date(b.planned_date).getTime() : 0;
            comparison = dateA - dateB;
            break;
          case 'safety':
            comparison = a.safety_score.localeCompare(b.safety_score);
            break;
          case 'question':
            comparison = (a.question_rus || a.question_eng || a.question || '').localeCompare(b.question_rus || b.question_eng || b.question || '');
            break;
          case 'status':
            comparison = a.question_status.localeCompare(b.question_status);
            break;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    } else {
      result = [...result].sort((a, b) => a.question_id - b.question_id);
    }
    
    return result;
  }, [questions, searchInput, filters, sortColumn, sortDirection]);

  // Status counts for filter tabs
  const statusCounts = useMemo(() => {
    const counts = { all: questions.length, in_progress: 0, published: 0, not_selected: 0 };
    questions.forEach(q => {
      if (q.question_status === 'in_progress') counts.in_progress++;
      else if (q.question_status === 'published') counts.published++;
      else counts.not_selected++;
    });
    return counts;
  }, [questions]);

  const [activeTab, setActiveTab] = useState<string | null>(null);

  const tabFilteredQuestions = useMemo(() => {
    if (!activeTab) return filteredQuestions;
    return filteredQuestions.filter(q => q.question_status === activeTab);
  }, [filteredQuestions, activeTab]);

  const allBulkSelected = tabFilteredQuestions.length > 0 && 
    tabFilteredQuestions.every(q => bulkDeleteIds.includes(q.unique_key));

  const toggleBulkSelectAll = () => {
    if (allBulkSelected) {
      setBulkDeleteIds([]);
    } else {
      setBulkDeleteIds(tabFilteredQuestions.map(q => q.unique_key));
    }
  };

  const toggleBulkSelect = (uniqueKey: string) => {
    setBulkDeleteIds(prev => 
      prev.includes(uniqueKey)
        ? prev.filter(id => id !== uniqueKey)
        : [...prev, uniqueKey]
    );
  };

  const handleSaveQuestion = async (uniqueKey: string, updates: { question?: string; question_eng?: string; safety_score?: string; publication_date?: string; question_status?: string; playlist_id?: string }) => {
    // Validate: can't set "in_progress" without a planned date, playlist, and ready scene
    if (updates.question_status === 'in_progress') {
      const question = questions.find(q => q.unique_key === uniqueKey);
      if (!question?.planned_date && !updates.publication_date) {
        toast.error('Сначала укажите плановую дату публикации');
        return;
      }
      if (!question?.playlist_id && !updates.playlist_id) {
        toast.error('Сначала назначьте плейлист');
        return;
      }
      // Check scene readiness
      const playlistId = updates.playlist_id || question?.playlist_id;
      if (playlistId) {
        const { data: scenes } = await supabase
          .from('playlist_scenes')
          .select('id')
          .eq('playlist_id', playlistId)
          .not('scene_url', 'is', null)
          .limit(1);
        if (!scenes || scenes.length === 0) {
          toast.error('Нет готовой сцены для плейлиста');
          return;
        }
      }
    }
    onUpdateQuestion?.(uniqueKey, updates);
  };

  const handleStartProduction = async () => {
    if (bulkDeleteIds.length === 0) return;
    
    // Validate all selected questions
    const errors: string[] = [];
    for (const key of bulkDeleteIds) {
      const q = questions.find(q => q.unique_key === key);
      if (!q) continue;
      if (!q.planned_date) {
        errors.push(`Вопрос ${q.question_id}: нет плановой даты`);
      }
      if (!q.playlist_id) {
        errors.push(`Вопрос ${q.question_id}: не назначен плейлист`);
      }
    }
    
    if (errors.length > 0) {
      toast.error(errors.slice(0, 3).join('\n'), { duration: 5000 });
      return;
    }
    
    // Check scenes for all unique playlists
    const playlistIds = [...new Set(bulkDeleteIds.map(k => questions.find(q => q.unique_key === k)?.playlist_id).filter(Boolean))] as string[];
    for (const plId of playlistIds) {
      const { data: scenes } = await supabase
        .from('playlist_scenes')
        .select('id')
        .eq('playlist_id', plId)
        .not('scene_url', 'is', null)
        .limit(1);
      if (!scenes || scenes.length === 0) {
        const pl = playlists.find(p => p.id === plId);
        toast.error(`Нет готовой сцены для плейлиста "${pl?.name || plId}"`);
        return;
      }
    }
    
    // Update status to in_progress
    setIsBulkUpdating(true);
    try {
      if (onBulkUpdateStatus) {
        await onBulkUpdateStatus(bulkDeleteIds, 'in_progress');
      }
      if (onStartProduction) {
        await onStartProduction(bulkDeleteIds);
      }
      toast.success(`${bulkDeleteIds.length} вопрос(ов) взято в работу`);
      setBulkDeleteIds([]);
    } catch (e) {
      toast.error('Ошибка запуска производства');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (deleteQuestionKey === null || !onDeleteQuestion) return;
    setIsDeleting(true);
    try {
      await onDeleteQuestion(deleteQuestionKey);
      setDeleteQuestionKey(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDeleteIds.length === 0 || !onDeleteQuestion) return;
    setIsDeleting(true);
    const count = bulkDeleteIds.length;
    try {
      for (const uniqueKey of bulkDeleteIds) {
        await onDeleteQuestion(uniqueKey);
      }
      setBulkDeleteIds([]);
      setShowBulkDeleteDialog(false);
      toast.success(`Удалено ${count} вопрос(ов)`);
    } catch (e) {
      toast.error('Ошибка при удалении');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!onBulkUpdateStatus || !bulkActionValue) return;
    
    // Validate: can't bulk set "in_progress" if any selected question has no date
    if (bulkActionValue === 'in_progress') {
      const withoutDate = bulkDeleteIds.filter(key => {
        const q = questions.find(q => q.unique_key === key);
        return !q?.planned_date;
      });
      if (withoutDate.length > 0) {
        toast.error(`${withoutDate.length} вопрос(ов) без плановой даты. Сначала укажите дату.`);
        return;
      }
    }
    
    setIsBulkUpdating(true);
    try {
      await onBulkUpdateStatus(bulkDeleteIds, bulkActionValue);
      setShowBulkStatusDialog(false);
      setBulkActionValue('');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkDateUpdate = async () => {
    if (!onBulkUpdateDate || !bulkDateValue) return;
    setIsBulkUpdating(true);
    try {
      const dateWithTime = setMinutes(setHours(bulkDateValue, parseInt(bulkHour)), parseInt(bulkMinute));
      await onBulkUpdateDate(bulkDeleteIds, dateWithTime.toISOString());
      setShowBulkDateDialog(false);
      setBulkDateValue(undefined);
      setBulkHour('12');
      setBulkMinute('00');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Status filter tabs + toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2">
          {/* Compact status tabs */}
          <div className="flex items-center gap-1">
            {[
              { key: null, label: 'Все вопросы', count: statusCounts.all, activeClass: 'bg-primary/10 text-primary border-primary' },
              { key: 'in_progress', label: 'В работе', count: statusCounts.in_progress, activeClass: 'bg-yellow-500/10 text-yellow-700 border-yellow-500' },
              { key: 'published', label: 'Опубликованы', count: statusCounts.published, activeClass: 'bg-green-500/10 text-green-700 border-green-500' },
              { key: 'not_selected', label: 'Не отобраны', count: statusCounts.not_selected, activeClass: 'bg-muted text-foreground border-muted-foreground/40' },
            ].map(tab => (
              <button
                key={tab.key ?? 'all'}
                onClick={() => setActiveTab(tab.key as string | null)}
                className={cn(
                  "px-3 py-1 rounded-full border text-xs font-medium transition-colors whitespace-nowrap",
                  activeTab === tab.key ? tab.activeClass : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {tab.label} <span className="font-semibold">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-border mx-1" />

          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-7 w-40 pl-7 text-xs"
            />
          </div>
          <QuestionFilters filters={filters} onFiltersChange={setFilters} />

          {/* Gear dropdown for bulk actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 relative">
                <Settings2 className="w-3.5 h-3.5" />
                {bulkDeleteIds.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-medium">
                    {bulkDeleteIds.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Import — always available */}
              <DropdownMenuItem onClick={() => setShowImporter(true)}>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />
                Импорт
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {bulkDeleteIds.length > 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground border-b mb-1">
                  Выбрано: {bulkDeleteIds.length} из {tabFilteredQuestions.length}
                  <button className="ml-2 text-primary hover:underline" onClick={() => setBulkDeleteIds([])}>Сбросить</button>
                </div>
              )}
              
              {/* Взять в работу */}
              <DropdownMenuItem
                disabled={bulkDeleteIds.length === 0 || isBulkUpdating}
                onClick={handleStartProduction}
              >
                <Play className="w-3.5 h-3.5 mr-2" />
                Взять в работу
              </DropdownMenuItem>
              
              {onBulkUpdateDate && (
                <DropdownMenuItem
                  disabled={bulkDeleteIds.length === 0}
                  onClick={() => { setBulkDateValue(undefined); setShowBulkDateDialog(true); }}
                >
                  <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                  Плановая дата
                </DropdownMenuItem>
              )}
              {onBulkUpdateStatus && (
                <DropdownMenuItem
                  disabled={bulkDeleteIds.length === 0}
                  onClick={() => { setBulkActionValue(''); setShowBulkStatusDialog(true); }}
                >
                  <Check className="w-3.5 h-3.5 mr-2" />
                  Статус
                </DropdownMenuItem>
              )}
              {onDeleteQuestion && (
                <DropdownMenuItem
                  disabled={bulkDeleteIds.length === 0}
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowBulkDeleteDialog(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Удалить
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <span className="text-xs text-muted-foreground">
          {tabFilteredQuestions.length} из {questions.length}
        </span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[40px_60px_120px_80px_1fr_140px_130px_100px] gap-0 px-4 py-2 border-b bg-muted/20 text-xs font-medium text-muted-foreground sticky top-0">
        <div className="flex items-center justify-center">
          <Checkbox
            checked={allBulkSelected}
            onCheckedChange={toggleBulkSelectAll}
            className="rounded-sm"
          />
        </div>
        <button className="flex items-center cursor-pointer hover:text-foreground" onClick={() => handleSort('id')}>
          ID {getSortIcon('id')}
        </button>
        <button className="flex items-center cursor-pointer hover:text-foreground" onClick={() => handleSort('safety')}>
          Безопасность {getSortIcon('safety')}
        </button>
        <button className="flex items-center cursor-pointer hover:text-foreground" onClick={() => handleSort('relevance')}>
          Актуал. {getSortIcon('relevance')}
        </button>
        <button className="flex items-center gap-1 cursor-pointer hover:text-foreground" onClick={() => handleSort('question')}>
          Вопрос
          <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal">RU/EN</Badge>
          {getSortIcon('question')}
        </button>
        <button className="flex items-center cursor-pointer hover:text-foreground" onClick={() => handleSort('date')}>
          Плановая публ. {getSortIcon('date')}
        </button>
        <div className="flex items-center">Плейлист</div>
        <button className="flex items-center cursor-pointer hover:text-foreground" onClick={() => handleSort('status')}>
          Статус {getSortIcon('status')}
        </button>
      </div>

      {/* Table body */}
      <div className="flex-1 overflow-auto">
        {tabFilteredQuestions.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            {questions.length === 0 ? 'Нет вопросов' : 'Ничего не найдено'}
          </div>
        ) : (
          tabFilteredQuestions.map((q) => (
            <div
              key={q.unique_key}
              className={`group grid grid-cols-[40px_60px_120px_80px_1fr_140px_130px_100px] gap-0 px-4 py-2 border-b hover:bg-muted/30 transition-colors text-sm ${
                bulkDeleteIds.includes(q.unique_key) ? 'bg-destructive/5' : ''
              }`}
            >
              {/* Column 1: Checkbox for bulk actions */}
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={bulkDeleteIds.includes(q.unique_key)}
                  onCheckedChange={() => toggleBulkSelect(q.unique_key)}
                  className="rounded-sm"
                />
              </div>
              
              {/* Column 2: ID */}
              <div className="flex items-center text-muted-foreground">{q.question_id}</div>
              
              {/* Column 3: Safety - Inline Edit */}
              <div className="flex items-center">
                <InlineEdit
                  type="select"
                  value={q.safety_score}
                  options={safetyOptions}
                  onSave={(value) => handleSaveQuestion(q.unique_key, { safety_score: value })}
                  formatDisplay={(val) => {
                    const opt = safetyOptions.find(o => o.value === val);
                    return opt?.label || 'Безопасно';
                  }}
                  displayClassName="text-xs"
                />
              </div>
              
              {/* Column 4: Relevance */}
              <div className="flex items-center text-muted-foreground">{q.relevance_score || 0}</div>
              
              {/* Column 5: Question RU with EN hover preview */}
              <div className="flex items-center truncate pr-2">
                <HoverCard openDelay={200} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <span className="truncate cursor-help">
                      {q.question_rus || (
                        <span className="text-muted-foreground italic">
                          {q.question_eng || q.question || '—'}
                        </span>
                      )}
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-[500px] p-3 bg-popover/95 backdrop-blur-sm" side="bottom" align="start">
                    <div className="space-y-2">
                      <div>
                        <Badge variant="outline" className="text-[10px] mb-1">RU</Badge>
                        <p className="text-sm">{q.question_rus || <span className="text-muted-foreground italic">не заполнено</span>}</p>
                      </div>
                      <div className="border-t pt-2">
                        <Badge variant="outline" className="text-[10px] mb-1">EN</Badge>
                        <p className="text-sm text-muted-foreground">{q.question_eng || q.question || '—'}</p>
                      </div>
                      {(q.hook_rus || q.hook) && (
                        <div className="border-t pt-2">
                          <Badge variant="secondary" className="text-[10px] mb-1">Hook</Badge>
                          <p className="text-sm text-muted-foreground">{q.hook_rus || q.hook}</p>
                        </div>
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
              
              {/* Column 6: Planned publication date - Inline Edit */}
              <div className="flex items-center">
                <InlineEdit
                  type="datetime"
                  value={q.planned_date}
                  onSave={(value) => handleSaveQuestion(q.unique_key, { publication_date: value })}
                  placeholder="—"
                  displayClassName="text-xs text-muted-foreground"
                />
              </div>
              
              {/* Column 7: Playlist - Inline Edit */}
              <div className="flex items-center">
                <InlineEdit
                  type="select"
                  value={q.playlist_id || ''}
                  options={playlists.map(p => ({ value: p.id, label: p.name }))}
                  onSave={(value) => handleSaveQuestion(q.unique_key, { playlist_id: value })}
                  formatDisplay={(val) => {
                    if (!val) return '—';
                    const pl = playlists.find(p => p.id === val);
                    return pl?.name || '—';
                  }}
                  displayClassName="text-xs text-muted-foreground"
                  placeholder="—"
                />
              </div>
              
              {/* Column 8: Status - Inline Edit (no filter checkbox) */}
              <div className="flex items-center">
                <InlineEdit
                  type="select"
                  value={q.question_status}
                  options={statusOptions}
                  onSave={(value) => handleSaveQuestion(q.unique_key, { question_status: value })}
                  formatDisplay={(val) => {
                    const opt = statusOptions.find(o => o.value === val);
                    return opt?.label || 'Не отобран';
                  }}
                  displayClassName={`text-xs ${
                    q.question_status === 'in_progress' ? 'text-yellow-600 dark:text-yellow-400' :
                    q.question_status === 'not_selected' ? 'text-muted-foreground' : ''
                  }`}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* CSV Importer */}
      <CsvImporter
        open={showImporter}
        onClose={() => setShowImporter(false)}
        title="Импорт вопросов"
        columnMapping={QUESTION_COLUMN_MAPPING}
        previewColumns={QUESTION_PREVIEW_COLUMNS}
        requiredFields={['question_id']}
        lookups={{
          advisors: advisors?.map(a => ({ id: a.id, name: a.name, display_name: a.display_name })),
          playlists: playlists?.map(p => ({ id: p.id, name: p.name })),
        }}
        resolveRow={(row, lk) => {
          const errors: string[] = [];
          const data = { ...row };

          // Resolve advisor_name → advisor_id (don't error, will auto-create)
          if (data.advisor_name && lk.advisors) {
            const found = lk.advisors.find(a =>
              a.name.toLowerCase() === String(data.advisor_name).toLowerCase() ||
              (a.display_name && a.display_name.toLowerCase() === String(data.advisor_name).toLowerCase())
            );
            if (found) {
              data.advisor_id = found.id;
            }
            // Keep advisor_name for auto-create during import
          }

          // Resolve playlist_name → playlist_id (don't error, will auto-create)
          if (data.playlist_name && lk.playlists) {
            const found = lk.playlists.find(p =>
              p.name.toLowerCase() === String(data.playlist_name).toLowerCase()
            );
            if (found) {
              data.playlist_id = found.id;
            }
            // Keep playlist_name for auto-create during import
          }

          return { data, errors };
        }}
        onImport={async (data) => {
          if (!onBulkImport) return;

          try {
            // Auto-create advisors that don't exist yet
            const advisorNames = [...new Set(
              data.filter(row => row.advisor_name && !row.advisor_id)
                .map(row => String(row.advisor_name).trim()).filter(Boolean)
            )];
            const advisorMap: Record<string, string> = {};
            if (advisorNames.length > 0) {
              const { data: existingAdvisors } = await supabase.from('advisors').select('id, name');
              const existing = new Map((existingAdvisors || []).map(a => [a.name.toLowerCase(), a.id]));
              const toCreate = advisorNames.filter(n => !existing.has(n.toLowerCase()));
              if (toCreate.length > 0) {
                const { data: created, error } = await supabase.from('advisors').insert(toCreate.map(name => ({ name }))).select('id, name');
                if (!error && created) {
                  created.forEach(a => existing.set(a.name.toLowerCase(), a.id));
                  toast.success(`Создано ${created.length} новых духовников`);
                }
              }
              existing.forEach((id, name) => { advisorMap[name] = id; });
            }

            // Auto-create playlists that don't exist yet
            const playlistNames = [...new Set(
              data.filter(row => (row.playlist_name || row.playlist_name_rus) && !row.playlist_id)
                .map(row => String(row.playlist_name || row.playlist_name_rus).trim()).filter(Boolean)
            )];
            const playlistMap: Record<string, string> = {};
            if (playlistNames.length > 0) {
              const { data: existingPlaylists } = await supabase.from('playlists').select('id, name');
              const existing = new Map((existingPlaylists || []).map(p => [p.name.toLowerCase(), p.id]));
              const toCreate = playlistNames.filter(n => !existing.has(n.toLowerCase()));
              if (toCreate.length > 0) {
                const { data: created, error } = await supabase.from('playlists').insert(toCreate.map(name => ({ name }))).select('id, name');
                if (!error && created) {
                  created.forEach(p => existing.set(p.name.toLowerCase(), p.id));
                  toast.success(`Создано ${created.length} новых плейлистов`);
                }
              }
              existing.forEach((id, name) => { playlistMap[name] = id; });
            }

            const transformed = data.map(row => {
              const result: Record<string, any> = { ...row };

              // Resolve names to IDs
              if (result.advisor_name && !result.advisor_id) {
                result.advisor_id = advisorMap[String(result.advisor_name).toLowerCase().trim()] || null;
              }
              // Use playlist_name or playlist_name_rus (eng preferred)
              const pName = result.playlist_name || result.playlist_name_rus;
              if (pName && !result.playlist_id) {
                result.playlist_id = playlistMap[String(pName).toLowerCase().trim()] || null;
              }

              // Integer fields
              if (result.question_id !== undefined && result.question_id !== '') {
                result.question_id = parseInt(String(result.question_id), 10);
                if (isNaN(result.question_id)) delete result.question_id;
              }
              if (result.video_number !== undefined && result.video_number !== '') {
                result.video_number = parseInt(String(result.video_number), 10);
                if (isNaN(result.video_number)) delete result.video_number;
              }
              if (result.relevance_score !== undefined && result.relevance_score !== '') {
                result.relevance_score = parseInt(String(result.relevance_score), 10);
                if (isNaN(result.relevance_score)) result.relevance_score = 0;
              }

              // Normalize safety_score
              if (result.safety_score) {
                const safetyStr = String(result.safety_score).toLowerCase().replace(/[✅⚠️🔴❌]/g, '').trim();
                if (safetyStr.includes('безопасно') || safetyStr === 'safe') result.safety_score = 'safe';
                else if (safetyStr.includes('критич') || safetyStr === 'critical') result.safety_score = 'critical';
                else if (safetyStr.includes('средн') || safetyStr === 'medium') result.safety_score = 'medium_risk';
                else if (safetyStr.includes('высок') || safetyStr === 'high') result.safety_score = 'high_risk';
              }

              // Normalize question_status
              if (result.question_status) {
                const statusStr = String(result.question_status).toLowerCase().trim();
                if (statusStr.includes('работ') || statusStr === 'in_progress' || statusStr === 'в работе') result.question_status = 'in_progress';
                else if (statusStr.includes('опубликован') || statusStr === 'published' || statusStr === 'завершен') result.question_status = 'published';
                else result.question_status = 'not_selected';
              }

              // Date field
              if (result.publication_date !== undefined) {
                const dateStr = String(result.publication_date).trim();
                if (dateStr === '') {
                  delete result.publication_date;
                } else {
                  const parsed = new Date(dateStr);
                  if (!isNaN(parsed.getTime())) {
                    result.publication_date = parsed.toISOString();
                  } else {
                    delete result.publication_date;
                  }
                }
              }

              // Set question_eng from question if not present
              if (!result.question_eng && result.question) {
                result.question_eng = result.question;
              }

              // Remove ALL virtual fields
              delete result.playlist_name;
              delete result.playlist_name_rus;
              delete result.advisor_name;
              delete result._ignore;

              // Sanitize empty strings to null for all remaining fields
              for (const key of Object.keys(result)) {
                if (typeof result[key] === 'string' && result[key].trim() === '') {
                  result[key] = null;
                }
              }

              return result;
            }).filter(row => row.question_id !== undefined && row.question_id !== null);

            if (transformed.length === 0) {
              toast.error('Нет валидных строк: проверьте маппинг поля ID Вопроса');
              return;
            }

            // Expand: create one video per active advisor for rows without advisor_id
            const { data: allAdvisorsData } = await supabase.from('advisors').select('id').eq('is_active', true);
            const activeAdvisorIds = (allAdvisorsData || []).map(a => a.id);

            const expanded: Record<string, any>[] = [];
            for (const row of transformed) {
              if (row.advisor_id) {
                expanded.push(row);
              } else if (activeAdvisorIds.length > 0) {
                for (const advisorId of activeAdvisorIds) {
                  expanded.push({ ...row, advisor_id: advisorId });
                }
              } else {
                expanded.push(row);
              }
            }

            await onBulkImport(expanded);
            toast.success(`Импортировано ${transformed.length} вопросов`);
          } catch (error: any) {
            console.error('Question import error:', error);
            toast.error(`Ошибка импорта: ${error.message || 'Unknown error'}`);
          }
        }}
        fieldDefinitions={QUESTION_FIELD_DEFINITIONS}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteQuestionKey !== null} onOpenChange={(open) => !open && setDeleteQuestionKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить вопрос?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие удалит вопрос и все связанные с ним ролики и публикации. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteQuestion} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить {bulkDeleteIds.length} вопросов?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие удалит выбранные вопросы и все связанные с ними ролики и публикации. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Удалить все
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Status Update Dialog */}
      <AlertDialog open={showBulkStatusDialog} onOpenChange={setShowBulkStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изменить статус для {bulkDeleteIds.length} вопросов</AlertDialogTitle>
            <AlertDialogDescription>
              Выберите новый статус для выбранных вопросов.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={bulkActionValue} onValueChange={setBulkActionValue}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите статус..." />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkUpdating}>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkStatusUpdate} 
              disabled={isBulkUpdating || !bulkActionValue}
            >
              {isBulkUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Применить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Date Update Dialog */}
      <AlertDialog open={showBulkDateDialog} onOpenChange={setShowBulkDateDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Установить дату публикации для {bulkDeleteIds.length} вопросов</AlertDialogTitle>
            <AlertDialogDescription>
              Выберите дату и время публикации для выбранных вопросов.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <Calendar
              mode="single"
              selected={bulkDateValue}
              onSelect={setBulkDateValue}
              className="rounded-md border pointer-events-auto"
              locale={ru}
            />
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Время:</span>
              <Select value={bulkHour} onValueChange={setBulkHour}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>:</span>
              <Select value={bulkMinute} onValueChange={setBulkMinute}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['00', '15', '30', '45'].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkUpdating}>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDateUpdate} 
              disabled={isBulkUpdating || !bulkDateValue}
            >
              {isBulkUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Применить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
