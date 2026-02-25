import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, Loader2, FileSpreadsheet, Trash2, Check, ArrowUpDown, ArrowUp, ArrowDown, CalendarIcon, Clock } from 'lucide-react';
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
  onUpdateQuestion?: (uniqueKey: string, updates: { question?: string; question_eng?: string; safety_score?: string; publication_date?: string; question_status?: string }) => void;
  onBulkImport?: (data: Record<string, any>[]) => Promise<void>;
  onDeleteQuestion?: (uniqueKey: string) => Promise<void>;
  playlists?: Playlist[];
  advisors?: AdvisorLookup[];
  onBulkUpdateStatus?: (uniqueKeys: string[], status: string) => Promise<void>;
  onBulkUpdateDate?: (uniqueKeys: string[], date: string) => Promise<void>;
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
        const uniqueKey = `${video.question_id}_${video.question_rus || video.question_eng || video.question || ''}`;
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

  const allBulkSelected = filteredQuestions.length > 0 && 
    filteredQuestions.every(q => bulkDeleteIds.includes(q.unique_key));

  const toggleBulkSelectAll = () => {
    if (allBulkSelected) {
      setBulkDeleteIds([]);
    } else {
      setBulkDeleteIds(filteredQuestions.map(q => q.unique_key));
    }
  };

  const toggleBulkSelect = (uniqueKey: string) => {
    setBulkDeleteIds(prev => 
      prev.includes(uniqueKey)
        ? prev.filter(id => id !== uniqueKey)
        : [...prev, uniqueKey]
    );
  };

  const handleSaveQuestion = (uniqueKey: string, updates: { question?: string; question_eng?: string; safety_score?: string; publication_date?: string; question_status?: string }) => {
    onUpdateQuestion?.(uniqueKey, updates);
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
    try {
      for (const uniqueKey of bulkDeleteIds) {
        await onDeleteQuestion(uniqueKey);
      }
      setBulkDeleteIds([]);
      setShowBulkDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!onBulkUpdateStatus || !bulkActionValue) return;
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
      {/* Top bar with search and import */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-7 w-40 pl-7 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowImporter(true)}>
            <FileSpreadsheet className="w-3 h-3 mr-1" />
            Импорт
          </Button>
          <QuestionFilters filters={filters} onFiltersChange={setFilters} />
        </div>
        <span className="text-xs text-muted-foreground">
          {filteredQuestions.length} из {questions.length}
        </span>
      </div>

      {/* Bulk actions bar */}
      {bulkDeleteIds.length > 0 && (
        <div className="px-4 py-2 border-b">
          <BulkActionsBar
            selectedCount={bulkDeleteIds.length}
            totalCount={filteredQuestions.length}
            onClearSelection={() => setBulkDeleteIds([])}
          >
            {onBulkUpdateDate && (
              <BulkActionButton
                icon={<CalendarIcon className="w-3 h-3 mr-1" />}
                onClick={() => { setBulkDateValue(undefined); setShowBulkDateDialog(true); }}
              >
                Плановая дата
              </BulkActionButton>
            )}
            {onBulkUpdateStatus && (
              <BulkActionButton
                icon={<Check className="w-3 h-3 mr-1" />}
                onClick={() => { setBulkActionValue(''); setShowBulkStatusDialog(true); }}
              >
                Статус
              </BulkActionButton>
            )}
            {onDeleteQuestion && (
              <BulkActionButton
                variant="destructive"
                icon={<Trash2 className="w-3 h-3 mr-1" />}
                onClick={() => setShowBulkDeleteDialog(true)}
              >
                Удалить
              </BulkActionButton>
            )}
          </BulkActionsBar>
        </div>
      )}

      {/* Table header */}
      <div className="grid grid-cols-[40px_60px_120px_80px_1fr_130px_100px] gap-0 px-4 py-2 border-b bg-muted/20 text-xs font-medium text-muted-foreground sticky top-0">
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
        <button className="flex items-center cursor-pointer hover:text-foreground" onClick={() => handleSort('status')}>
          Статус {getSortIcon('status')}
        </button>
      </div>

      {/* Table body */}
      <div className="flex-1 overflow-auto">
        {filteredQuestions.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            {questions.length === 0 ? 'Нет вопросов' : 'Ничего не найдено'}
          </div>
        ) : (
          filteredQuestions.map((q) => (
            <div
              key={q.unique_key}
              className={`group grid grid-cols-[40px_60px_120px_80px_1fr_130px_100px] gap-0 px-4 py-2 border-b hover:bg-muted/30 transition-colors text-sm ${
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
              
              {/* Column 7: Status - Inline Edit (no filter checkbox) */}
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
                  displayClassName="text-xs"
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

          // Resolve advisor_name → advisor_id
          if (data.advisor_name && lk.advisors) {
            const found = lk.advisors.find(a =>
              a.name.toLowerCase() === String(data.advisor_name).toLowerCase() ||
              (a.display_name && a.display_name.toLowerCase() === String(data.advisor_name).toLowerCase())
            );
            if (found) {
              data.advisor_id = found.id;
            } else {
              errors.push(`Духовник не найден: ${data.advisor_name}`);
            }
            delete data.advisor_name;
          }

          // Resolve playlist_name → playlist_id (skip if playlists empty, will be stored as name)
          if (data.playlist_name && lk.playlists && lk.playlists.length > 0) {
            const found = lk.playlists.find(p =>
              p.name.toLowerCase() === String(data.playlist_name).toLowerCase()
            );
            if (found) {
              data.playlist_id = found.id;
            }
            // Don't error if not found - playlist will be auto-created during import
          }

          return { data, errors };
        }}
        onImport={async (data) => {
          if (!onBulkImport) return;

          // Auto-create playlists that don't exist yet
          const playlistNames = [...new Set(
            data
              .filter(row => row.playlist_name && !row.playlist_id)
              .map(row => String(row.playlist_name).trim())
              .filter(Boolean)
          )];

          const playlistMap: Record<string, string> = {};

          if (playlistNames.length > 0) {
            // Fetch existing playlists
            const { data: existingPlaylists } = await supabase.from('playlists').select('id, name');
            const existing = new Map((existingPlaylists || []).map(p => [p.name.toLowerCase(), p.id]));

            const toCreate = playlistNames.filter(n => !existing.has(n.toLowerCase()));
            if (toCreate.length > 0) {
              const { data: created, error } = await supabase
                .from('playlists')
                .insert(toCreate.map(name => ({ name })))
                .select('id, name');
              if (!error && created) {
                created.forEach(p => existing.set(p.name.toLowerCase(), p.id));
                toast.success(`Создано ${created.length} новых плейлистов`);
              }
            }

            existing.forEach((id, name) => { playlistMap[name] = id; });
          }

          const transformed = data.map(row => {
            const result: Record<string, any> = { ...row };

            // Resolve playlist_name to playlist_id if not already resolved
            if (result.playlist_name && !result.playlist_id) {
              const pid = playlistMap[String(result.playlist_name).toLowerCase().trim()];
              if (pid) result.playlist_id = pid;
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

            // Normalize safety_score from display values to DB values
            if (result.safety_score) {
              const safetyStr = String(result.safety_score).toLowerCase().replace(/[✅⚠️🔴❌]/g, '').trim();
              if (safetyStr.includes('безопасно') || safetyStr === 'safe') result.safety_score = 'safe';
              else if (safetyStr.includes('критич') || safetyStr === 'critical') result.safety_score = 'critical';
              else if (safetyStr.includes('средн') || safetyStr === 'medium') result.safety_score = 'medium_risk';
              else if (safetyStr.includes('высок') || safetyStr === 'high') result.safety_score = 'high_risk';
            }

            // Normalize question_status from display values to DB values
            if (result.question_status) {
              const statusStr = String(result.question_status).toLowerCase().trim();
              if (statusStr.includes('работ') || statusStr === 'in_progress' || statusStr === 'в работе') result.question_status = 'in_progress';
              else if (statusStr.includes('опубликован') || statusStr === 'published' || statusStr === 'завершен') result.question_status = 'published';
              else result.question_status = 'not_selected';
            }

            // Date field
            if (result.publication_date && String(result.publication_date).trim()) {
              const parsed = new Date(String(result.publication_date).trim());
              if (!isNaN(parsed.getTime())) {
                result.publication_date = parsed.toISOString();
              } else {
                delete result.publication_date;
              }
            }

            // Set question_eng from question if not present
            if (!result.question_eng && result.question) {
              result.question_eng = result.question;
            }

            // Remove virtual fields that don't exist in DB
            delete result.playlist_name;
            delete result.advisor_name;
            delete result._ignore;

            return result;
          }).filter(row => row.question_id !== undefined && row.question_id !== null);

          if (transformed.length === 0) {
            toast.error('Нет валидных строк: проверьте маппинг поля ID Вопроса');
            return;
          }

          await onBulkImport(transformed);
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
