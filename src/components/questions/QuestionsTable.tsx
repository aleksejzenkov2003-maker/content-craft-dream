import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, Loader2, Plus, ArrowRight, FileSpreadsheet, Trash2, Check, ArrowUpDown, MoreHorizontal, Image, RefreshCw, ArrowUp, ArrowDown, CalendarIcon, Clock } from 'lucide-react';
import { Video as VideoType } from '@/hooks/useVideos';
import { Publication } from '@/hooks/usePublications';
import { format, setHours, setMinutes } from 'date-fns';
import { ru } from 'date-fns/locale';
import { QuestionSidePanel } from './QuestionSidePanel';
import { CsvImporter } from '@/components/import/CsvImporter';
import { VIDEO_COLUMN_MAPPING, VIDEO_PREVIEW_COLUMNS } from '@/components/import/importConfigs';
import { InlineEdit, SelectOption } from '@/components/ui/inline-edit';
import { BulkActionsBar, BulkActionButton } from '@/components/ui/bulk-actions-bar';
import { QuestionFilters, FilterState } from './QuestionFilters';
import { AddQuestionDialog } from './AddQuestionDialog';
import { cn } from '@/lib/utils';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
interface Playlist {
  id: string;
  name: string;
}

interface QuestionsTableProps {
  videos: VideoType[];
  publications: Publication[];
  loading: boolean;
  selectedQuestionIds?: number[];
  onSelectionChange?: (questionIds: number[]) => void;
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
  onUpdateQuestion?: (questionId: number, updates: { question?: string; question_eng?: string; safety_score?: string; publication_date?: string; question_status?: string }) => void;
  onBulkImport?: (data: Record<string, any>[]) => Promise<void>;
  onDeleteQuestion?: (questionId: number) => Promise<void>;
  playlists?: Playlist[];
  onBulkUpdateStatus?: (questionIds: number[], status: string) => Promise<void>;
  onBulkUpdateSafety?: (questionIds: number[], safety: string) => Promise<void>;
  onBulkGenerateCovers?: (questionIds: number[]) => Promise<void>;
  onBulkUpdateDate?: (questionIds: number[], date: string) => Promise<void>;
}

interface QuestionData {
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
  { value: 'warning', label: 'Внимание' },
  { value: 'danger', label: 'Опасно' },
  { value: 'unchecked', label: 'Не проверено' },
];

const statusOptions: SelectOption[] = [
  { value: 'pending', label: 'Ожидает' },
  { value: 'checked', label: 'Проверен' },
];

type SortColumn = 'id' | 'relevance' | 'date' | null;
type SortDirection = 'asc' | 'desc';

export function QuestionsTable({ 
  videos, 
  publications, 
  loading, 
  selectedQuestionIds = [],
  onSelectionChange,
  onAddQuestion,
  onGoToVideos,
  onUpdateQuestion,
  onBulkImport,
  onDeleteQuestion,
  playlists = [],
  onBulkUpdateStatus,
  onBulkUpdateSafety,
  onBulkGenerateCovers,
  onBulkUpdateDate,
}: QuestionsTableProps) {
  const [searchInput, setSearchInput] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [localSelectedIds, setLocalSelectedIds] = useState<number[]>(selectedQuestionIds);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[]>([]);
  const [deleteQuestionId, setDeleteQuestionId] = useState<number | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  
  // Filters and sorting state
  const [filters, setFilters] = useState<FilterState>({
    statusFilter: [],
    safetyFilter: [],
    dateRange: { from: null, to: null },
    hasVideos: null,
  });
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Bulk action dialog state
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [showBulkSafetyDialog, setShowBulkSafetyDialog] = useState(false);
  const [showBulkDateDialog, setShowBulkDateDialog] = useState(false);
  const [bulkActionValue, setBulkActionValue] = useState('');
  const [bulkDateValue, setBulkDateValue] = useState<Date | undefined>(undefined);
  const [bulkHour, setBulkHour] = useState('12');
  const [bulkMinute, setBulkMinute] = useState('00');

  useEffect(() => {
    setLocalSelectedIds(selectedQuestionIds);
  }, [selectedQuestionIds]);

  // Aggregate questions from videos
  const questions = useMemo(() => {
    const questionMap = new Map<number, QuestionData>();
    
    videos.forEach(video => {
      if (video.question_id !== null && video.question_id !== undefined) {
        const existing = questionMap.get(video.question_id);
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
          questionMap.set(video.question_id, {
            question_id: video.question_id,
            question: video.question || '',
            question_rus: video.question_rus || null,
            question_eng: video.question_eng || null,
            hook: video.hook || null,
            hook_rus: video.hook_rus || null,
            safety_score: video.safety_score || 'unchecked',
            relevance_score: video.relevance_score || 0,
            question_status: video.question_status || 'pending',
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
    
    // Safety filter
    if (filters.safetyFilter.length > 0) {
      result = result.filter(q => filters.safetyFilter.includes(q.safety_score));
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
    
    // Has videos filter
    if (filters.hasVideos !== null) {
      result = result.filter(q => q.has_video === filters.hasVideos);
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
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    } else {
      // Default sort by ID
      result = [...result].sort((a, b) => a.question_id - b.question_id);
    }
    
    return result;
  }, [questions, searchInput, filters, sortColumn, sortDirection]);

  const nextQuestionId = useMemo(() => {
    if (questions.length === 0) return 1;
    return Math.max(...questions.map(q => q.question_id)) + 1;
  }, [questions]);

  const allBulkSelected = filteredQuestions.length > 0 && 
    filteredQuestions.every(q => bulkDeleteIds.includes(q.question_id));

  const toggleBulkSelectAll = () => {
    if (allBulkSelected) {
      setBulkDeleteIds([]);
    } else {
      setBulkDeleteIds(filteredQuestions.map(q => q.question_id));
    }
  };

  const toggleBulkSelect = (questionId: number) => {
    setBulkDeleteIds(prev => 
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const toggleFilterSelect = (questionId: number) => {
    const newSelection = localSelectedIds.includes(questionId)
      ? localSelectedIds.filter(id => id !== questionId)
      : [...localSelectedIds, questionId];
    setLocalSelectedIds(newSelection);
    onSelectionChange?.(newSelection);
  };

  const handleRowClick = (q: QuestionData) => {
    setEditingQuestion(q);
    setShowEditPanel(true);
  };

  const handleAddQuestion = (data: {
    question_id: number;
    question_rus: string;
    question_eng: string;
    hook_rus: string;
    hook_eng: string;
    safety_score: string;
    playlist_id: string | null;
    publication_date: Date | null;
  }) => {
    if (onAddQuestion) {
      onAddQuestion({
        question_id: data.question_id,
        question: data.question_rus || data.question_eng,
        question_rus: data.question_rus,
        question_eng: data.question_eng,
        hook_rus: data.hook_rus,
        hook_eng: data.hook_eng,
        safety_score: data.safety_score,
        playlist_id: data.playlist_id,
        publication_date: data.publication_date?.toISOString() || null,
      });
    }
  };

  const handleSaveQuestion = (questionId: number, updates: { question?: string; question_eng?: string; safety_score?: string; publication_date?: string; question_status?: string }) => {
    onUpdateQuestion?.(questionId, updates);
  };

  const handleDeleteQuestion = async () => {
    if (deleteQuestionId === null || !onDeleteQuestion) return;
    setIsDeleting(true);
    try {
      await onDeleteQuestion(deleteQuestionId);
      setDeleteQuestionId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDeleteIds.length === 0 || !onDeleteQuestion) return;
    setIsDeleting(true);
    try {
      for (const questionId of bulkDeleteIds) {
        await onDeleteQuestion(questionId);
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

  const handleBulkSafetyUpdate = async () => {
    if (!onBulkUpdateSafety || !bulkActionValue) return;
    setIsBulkUpdating(true);
    try {
      await onBulkUpdateSafety(bulkDeleteIds, bulkActionValue);
      setShowBulkSafetyDialog(false);
      setBulkActionValue('');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkGenerateCovers = async () => {
    if (!onBulkGenerateCovers) return;
    setIsBulkUpdating(true);
    try {
      await onBulkGenerateCovers(bulkDeleteIds);
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

  const getSafetyBadge = (score: string) => {
    const option = safetyOptions.find(o => o.value === score) || safetyOptions[3];
    const colors: Record<string, string> = {
      safe: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      danger: 'bg-red-100 text-red-800',
      unchecked: 'bg-gray-100 text-gray-600',
    };
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${colors[score] || colors.unchecked}`}>
        {score === 'safe' && <Check className="w-3 h-3" />}
        {option.label}
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    const option = statusOptions.find(o => o.value === status) || statusOptions[0];
    const colors: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-600',
      checked: 'bg-blue-100 text-blue-800',
    };
    return (
      <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] || colors.pending}`}>
        {option.label}
      </div>
    );
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
      {/* Airtable-style header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Interface</span>
          <span>/</span>
          <span className="font-medium text-foreground">Questions</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            Group
          </Button>
          <QuestionFilters filters={filters} onFiltersChange={setFilters} />
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => handleSort('id')}>
            <ArrowUpDown className="w-3 h-3" />
            Sort
          </Button>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-7 w-40 pl-7 text-xs"
            />
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        <Button variant="outline" size="sm" onClick={() => setShowImporter(true)}>
          <FileSpreadsheet className="w-3 h-3 mr-1" />
          Импорт CSV
        </Button>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="w-3 h-3 mr-1" />
          Добавить
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
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
            {onDeleteQuestion && (
              <BulkActionButton
                variant="destructive"
                icon={<Trash2 className="w-3 h-3 mr-1" />}
                onClick={() => setShowBulkDeleteDialog(true)}
              >
                Удалить
              </BulkActionButton>
            )}
            {onBulkUpdateStatus && (
              <BulkActionButton
                icon={<RefreshCw className="w-3 h-3 mr-1" />}
                onClick={() => { setBulkActionValue(''); setShowBulkStatusDialog(true); }}
              >
                Статус
              </BulkActionButton>
            )}
            {onBulkUpdateSafety && (
              <BulkActionButton
                icon={<Check className="w-3 h-3 mr-1" />}
                onClick={() => { setBulkActionValue(''); setShowBulkSafetyDialog(true); }}
              >
                Безопасность
              </BulkActionButton>
            )}
            {onBulkGenerateCovers && (
              <BulkActionButton
                variant="generate-cover"
                icon={<Image className="w-3 h-3 mr-1" />}
                onClick={handleBulkGenerateCovers}
                loading={isBulkUpdating}
              >
                Обложки
              </BulkActionButton>
            )}
            {onBulkUpdateDate && (
              <BulkActionButton
                icon={<CalendarIcon className="w-3 h-3 mr-1" />}
                onClick={() => { setBulkDateValue(undefined); setShowBulkDateDialog(true); }}
              >
                Дата
              </BulkActionButton>
            )}
          </BulkActionsBar>
        </div>
      )}

      {/* Video filter bar (for square checkboxes) */}
      {localSelectedIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border-b border-primary/20">
          <span className="text-sm font-medium">
            Выбрано для фильтра: {localSelectedIds.length}
          </span>
          <Button variant="outline" size="sm" onClick={() => { setLocalSelectedIds([]); onSelectionChange?.([]); }}>
            Сбросить
          </Button>
          {onGoToVideos && (
            <Button size="sm" onClick={onGoToVideos}>
              К роликам
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          )}
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
        <div>Безопасность</div>
        <button className="flex items-center cursor-pointer hover:text-foreground" onClick={() => handleSort('relevance')}>
          Актуал. {getSortIcon('relevance')}
        </button>
        <div className="flex items-center gap-1">
          Вопрос
          <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal">RU/EN</Badge>
        </div>
        <button className="flex items-center cursor-pointer hover:text-foreground" onClick={() => handleSort('date')}>
          Дата {getSortIcon('date')}
        </button>
        <div>Статус</div>
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
              key={q.question_id}
              className={`group grid grid-cols-[40px_60px_120px_80px_1fr_130px_100px] gap-0 px-4 py-2 border-b hover:bg-muted/30 cursor-pointer transition-colors text-sm ${
                bulkDeleteIds.includes(q.question_id) ? 'bg-destructive/5' : localSelectedIds.includes(q.question_id) ? 'bg-primary/5' : ''
              }`}
              onClick={() => handleRowClick(q)}
            >
              {/* Column 1: Checkbox for bulk actions */}
              <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={bulkDeleteIds.includes(q.question_id)}
                  onCheckedChange={() => toggleBulkSelect(q.question_id)}
                  className="rounded-sm"
                />
              </div>
              
              {/* Column 2: ID */}
              <div className="flex items-center text-muted-foreground">{q.question_id}</div>
              
              {/* Column 3: Safety - Inline Edit */}
              <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                <InlineEdit
                  type="select"
                  value={q.safety_score}
                  options={safetyOptions}
                  onSave={(value) => handleSaveQuestion(q.question_id, { safety_score: value })}
                  formatDisplay={(val) => {
                    const opt = safetyOptions.find(o => o.value === val);
                    return opt?.label || 'Не проверено';
                  }}
                  displayClassName="text-xs"
                />
              </div>
              
              {/* Column 4: Relevance */}
              <div className="flex items-center text-muted-foreground">{q.relevance_score || '—'}</div>
              
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
                  <HoverCardContent className="w-80 p-3" side="bottom" align="start">
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
              <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                <InlineEdit
                  type="datetime"
                  value={q.planned_date}
                  onSave={(value) => handleSaveQuestion(q.question_id, { publication_date: value })}
                  placeholder="—"
                  displayClassName="text-xs text-muted-foreground"
                />
              </div>
              
              {/* Column 7: Status - Inline Edit + Filter checkbox */}
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <InlineEdit
                  type="select"
                  value={q.question_status}
                  options={statusOptions}
                  onSave={(value) => handleSaveQuestion(q.question_id, { question_status: value })}
                  formatDisplay={(val) => {
                    const opt = statusOptions.find(o => o.value === val);
                    return opt?.label || 'Ожидает';
                  }}
                  displayClassName="text-xs"
                />
                <Checkbox
                  checked={localSelectedIds.includes(q.question_id)}
                  onCheckedChange={() => toggleFilterSelect(q.question_id)}
                  className="rounded-sm border-primary data-[state=checked]:bg-primary"
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Question Dialog */}
      <AddQuestionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        nextQuestionId={nextQuestionId}
        playlists={playlists}
        onAdd={handleAddQuestion}
      />

      {/* Edit Question Side Panel */}
      <QuestionSidePanel
        question={editingQuestion}
        open={showEditPanel}
        onOpenChange={setShowEditPanel}
        onSave={handleSaveQuestion}
      />

      {/* CSV Importer */}
      <CsvImporter
        open={showImporter}
        onClose={() => setShowImporter(false)}
        title="Импорт вопросов/роликов из CSV"
        columnMapping={VIDEO_COLUMN_MAPPING}
        previewColumns={VIDEO_PREVIEW_COLUMNS}
        onImport={async (data) => {
          if (onBulkImport) {
            await onBulkImport(data);
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteQuestionId !== null} onOpenChange={(open) => !open && setDeleteQuestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить вопрос #{deleteQuestionId}?</AlertDialogTitle>
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

      {/* Bulk Safety Update Dialog */}
      <AlertDialog open={showBulkSafetyDialog} onOpenChange={setShowBulkSafetyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изменить безопасность для {bulkDeleteIds.length} вопросов</AlertDialogTitle>
            <AlertDialogDescription>
              Выберите новый уровень безопасности для выбранных вопросов.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={bulkActionValue} onValueChange={setBulkActionValue}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите уровень..." />
              </SelectTrigger>
              <SelectContent>
                {safetyOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkUpdating}>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkSafetyUpdate} 
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
