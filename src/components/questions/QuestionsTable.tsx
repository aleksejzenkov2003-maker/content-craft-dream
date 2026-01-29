import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Search, CheckCircle, Circle, Loader2, Plus, ArrowRight, X, FileSpreadsheet, Trash2, Check, Filter, ArrowUpDown, MoreHorizontal } from 'lucide-react';
import { Video as VideoType } from '@/hooks/useVideos';
import { Publication } from '@/hooks/usePublications';
import { format } from 'date-fns';
import { QuestionSidePanel } from './QuestionSidePanel';
import { CsvImporter } from '@/components/import/CsvImporter';
import { VIDEO_COLUMN_MAPPING, VIDEO_PREVIEW_COLUMNS } from '@/components/import/importConfigs';

interface QuestionsTableProps {
  videos: VideoType[];
  publications: Publication[];
  loading: boolean;
  selectedQuestionIds?: number[];
  onSelectionChange?: (questionIds: number[]) => void;
  onAddQuestion?: (data: { question_id: number; question: string; safety_score: string }) => void;
  onGoToVideos?: () => void;
  onUpdateQuestion?: (questionId: number, updates: { question?: string; question_eng?: string; safety_score?: string; publication_date?: string }) => void;
  onBulkImport?: (data: Record<string, any>[]) => Promise<void>;
  onDeleteQuestion?: (questionId: number) => Promise<void>;
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

const safetyOptions = [
  { value: 'safe', label: 'Безопасно', color: 'bg-green-500' },
  { value: 'warning', label: 'Внимание', color: 'bg-yellow-500' },
  { value: 'danger', label: 'Опасно', color: 'bg-red-500' },
  { value: 'unchecked', label: 'Не проверено', color: 'bg-gray-500' },
];

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
  onDeleteQuestion
}: QuestionsTableProps) {
  const [searchInput, setSearchInput] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
  const [showEditPanel, setShowEditPanel] = useState(false);
  // For video filtering (square checkbox in Status column)
  const [localSelectedIds, setLocalSelectedIds] = useState<number[]>(selectedQuestionIds);
  // For bulk delete (circle checkbox in first column)
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[]>([]);
  const [deleteQuestionId, setDeleteQuestionId] = useState<number | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    question_id: 0,
    question: '',
    safety_score: 'unchecked'
  });

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
    
    return Array.from(questionMap.values()).sort((a, b) => a.question_id - b.question_id);
  }, [videos, publications]);

  const filteredQuestions = useMemo(() => {
    if (!searchInput.trim()) return questions;
    const search = searchInput.toLowerCase();
    return questions.filter(q => 
      q.question.toLowerCase().includes(search) ||
      q.question_id.toString().includes(search)
    );
  }, [questions, searchInput]);

  const nextQuestionId = useMemo(() => {
    if (questions.length === 0) return 1;
    return Math.max(...questions.map(q => q.question_id)) + 1;
  }, [questions]);

  // For video filtering (square checkbox) - all selected
  const allFilterSelected = filteredQuestions.length > 0 && 
    filteredQuestions.every(q => localSelectedIds.includes(q.question_id));
  
  // For bulk delete (circle checkbox) - all selected
  const allBulkSelected = filteredQuestions.length > 0 && 
    filteredQuestions.every(q => bulkDeleteIds.includes(q.question_id));

  // Toggle all for bulk delete (circle)
  const toggleBulkSelectAll = () => {
    if (allBulkSelected) {
      setBulkDeleteIds([]);
    } else {
      setBulkDeleteIds(filteredQuestions.map(q => q.question_id));
    }
  };

  // Toggle single for bulk delete (circle)
  const toggleBulkSelect = (questionId: number) => {
    setBulkDeleteIds(prev => 
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  // Toggle single for video filtering (square checkbox)
  const toggleFilterSelect = (questionId: number) => {
    const newSelection = localSelectedIds.includes(questionId)
      ? localSelectedIds.filter(id => id !== questionId)
      : [...localSelectedIds, questionId];
    setLocalSelectedIds(newSelection);
    onSelectionChange?.(newSelection);
  };

  const clearBulkSelection = () => {
    setBulkDeleteIds([]);
  };

  const clearFilterSelection = () => {
    setLocalSelectedIds([]);
    onSelectionChange?.([]);
  };

  const handleRowClick = (q: QuestionData) => {
    setEditingQuestion(q);
    setShowEditPanel(true);
  };

  const handleAddQuestion = () => {
    if (onAddQuestion && newQuestion.question.trim()) {
      onAddQuestion({
        ...newQuestion,
        question_id: newQuestion.question_id || nextQuestionId
      });
      setShowAddDialog(false);
      setNewQuestion({ question_id: 0, question: '', safety_score: 'unchecked' });
    }
  };

  const handleSaveQuestion = (questionId: number, updates: { question?: string; question_eng?: string; safety_score?: string; publication_date?: string }) => {
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

  const getSafetyBadge = (score: string) => {
    const option = safetyOptions.find(o => o.value === score) || safetyOptions[3];
    const isGreen = option.value === 'safe';
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
        isGreen ? 'bg-green-100 text-green-800' : 
        option.value === 'warning' ? 'bg-yellow-100 text-yellow-800' :
        option.value === 'danger' ? 'bg-red-100 text-red-800' :
        'bg-gray-100 text-gray-600'
      }`}>
        {isGreen && <Check className="w-3 h-3" />}
        {option.label}
      </div>
    );
  };

  const getStatusIcon = (q: QuestionData) => {
    if (q.has_published) return <CheckCircle className="w-4 h-4 text-green-500 fill-green-500" />;
    return <Circle className="w-4 h-4 text-muted-foreground" />;
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
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            <Filter className="w-3 h-3" />
            Filter
          </Button>
          <Button variant="ghost" size="sm" className="text-xs gap-1">
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
        <Button size="sm" onClick={() => { setNewQuestion({ question_id: nextQuestionId, question: '', safety_score: 'unchecked' }); setShowAddDialog(true); }}>
          <Plus className="w-3 h-3 mr-1" />
          Добавить
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredQuestions.length} из {questions.length}
        </span>
      </div>

      {/* Bulk delete bar (for circle checkboxes) */}
      {bulkDeleteIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-destructive/10 border-b border-destructive/20">
          <span className="text-sm font-medium text-destructive">
            Для удаления: {bulkDeleteIds.length}
          </span>
          <Button variant="outline" size="sm" onClick={clearBulkSelection}>
            <X className="w-3 h-3 mr-1" />
            Сбросить
          </Button>
          {onDeleteQuestion && (
            <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)}>
              <Trash2 className="w-3 h-3 mr-1" />
              Удалить
            </Button>
          )}
        </div>
      )}

      {/* Video filter bar (for square checkboxes) */}
      {localSelectedIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border-b border-primary/20">
          <span className="text-sm font-medium">
            Выбрано для фильтра: {localSelectedIds.length}
          </span>
          <Button variant="outline" size="sm" onClick={clearFilterSelection}>
            <X className="w-3 h-3 mr-1" />
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
      <div className="grid grid-cols-[40px_60px_110px_70px_1fr_160px_50px_1fr] gap-0 px-4 py-2 border-b bg-muted/20 text-xs font-medium text-muted-foreground sticky top-0">
        <div className="flex items-center justify-center">
          <button
            onClick={toggleBulkSelectAll}
            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
              allBulkSelected ? 'bg-destructive border-destructive' : 'border-muted-foreground hover:border-foreground'
            }`}
          >
            {allBulkSelected && <Check className="w-2.5 h-2.5 text-white" />}
          </button>
        </div>
        <div>ID</div>
        <div>Безопасность</div>
        <div>Актуальн.</div>
        <div>Вопрос к духовнику рус</div>
        <div>Plan. pub. date</div>
        <div>Статус</div>
        <div>Вопрос к духовнику eng</div>
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
              className={`group grid grid-cols-[40px_60px_110px_70px_1fr_160px_50px_1fr] gap-0 px-4 py-2 border-b hover:bg-muted/30 cursor-pointer transition-colors text-sm ${
                bulkDeleteIds.includes(q.question_id) ? 'bg-destructive/5' : localSelectedIds.includes(q.question_id) ? 'bg-primary/5' : ''
              }`}
              onClick={() => handleRowClick(q)}
            >
              {/* Column 1: Circle for bulk delete */}
              <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => toggleBulkSelect(q.question_id)}
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    bulkDeleteIds.includes(q.question_id) 
                      ? 'bg-destructive border-destructive' 
                      : 'border-muted-foreground hover:border-foreground'
                  }`}
                >
                  {bulkDeleteIds.includes(q.question_id) && <Check className="w-2.5 h-2.5 text-white" />}
                </button>
              </div>
              {/* Column 2: ID */}
              <div className="flex items-center text-muted-foreground">{q.question_id}</div>
              {/* Column 3: Safety */}
              <div className="flex items-center">{getSafetyBadge(q.safety_score)}</div>
              {/* Column 4: Relevance */}
              <div className="flex items-center text-muted-foreground">{q.relevance_score || '—'}</div>
              {/* Column 5: Question RUS */}
              <div className="flex items-center truncate pr-2">{q.question_rus || q.question}</div>
              {/* Column 6: Planned publication date */}
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                {q.planned_date ? (
                  <>
                    <span>{format(new Date(q.planned_date), 'd/M/yyyy')}</span>
                    <span>{format(new Date(q.planned_date), 'HH:mm')}</span>
                  </>
                ) : (
                  '—'
                )}
              </div>
              <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => toggleFilterSelect(q.question_id)}
                  className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${
                    localSelectedIds.includes(q.question_id) 
                      ? 'bg-primary border-primary' 
                      : 'border-primary hover:bg-primary/10'
                  }`}
                >
                  {localSelectedIds.includes(q.question_id) && <Check className="w-2.5 h-2.5 text-white" />}
                </button>
              </div>
              {/* Column 8: Question ENG */}
              <div className="flex items-center truncate text-muted-foreground pr-2">
                {q.question_eng || '—'}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Question Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Добавить новый вопрос</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID вопроса</Label>
                <Input
                  type="number"
                  value={newQuestion.question_id || ''}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, question_id: parseInt(e.target.value) || 0 }))}
                  placeholder={nextQuestionId.toString()}
                />
              </div>
              <div className="space-y-2">
                <Label>Безопасность</Label>
                <Select
                  value={newQuestion.safety_score}
                  onValueChange={(value) => setNewQuestion(prev => ({ ...prev, safety_score: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {safetyOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Текст вопроса</Label>
              <Textarea
                value={newQuestion.question}
                onChange={(e) => setNewQuestion(prev => ({ ...prev, question: e.target.value }))}
                placeholder="Введите текст вопроса..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Отмена</Button>
            <Button onClick={handleAddQuestion} disabled={!newQuestion.question.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
