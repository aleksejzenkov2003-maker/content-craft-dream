import { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Search, CheckCircle, Clock, AlertCircle, Video, Loader2, Plus, ArrowRight, X } from 'lucide-react';
import { Video as VideoType } from '@/hooks/useVideos';
import { Publication } from '@/hooks/usePublications';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { QuestionSidePanel } from './QuestionSidePanel';

interface QuestionsTableProps {
  videos: VideoType[];
  publications: Publication[];
  loading: boolean;
  selectedQuestionIds?: number[];
  onSelectionChange?: (questionIds: number[]) => void;
  onAddQuestion?: (data: { question_id: number; question: string; safety_score: string }) => void;
  onGoToVideos?: () => void;
  onUpdateQuestion?: (questionId: number, updates: { question?: string; question_eng?: string; safety_score?: string; publication_date?: string }) => void;
}

interface QuestionData {
  question_id: number;
  question: string;
  question_eng: string | null;
  safety_score: string;
  relevance: number;
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
  onUpdateQuestion
}: QuestionsTableProps) {
  const [searchInput, setSearchInput] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [localSelectedIds, setLocalSelectedIds] = useState<number[]>(selectedQuestionIds);
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
        } else {
          questionMap.set(video.question_id, {
            question_id: video.question_id,
            question: video.question || '',
            question_eng: (video as any).question_eng || null,
            safety_score: video.safety_score || 'unchecked',
            relevance: 0,
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

  // Calculate next question_id for new question
  const nextQuestionId = useMemo(() => {
    if (questions.length === 0) return 1;
    return Math.max(...questions.map(q => q.question_id)) + 1;
  }, [questions]);

  const allSelected = filteredQuestions.length > 0 && 
    filteredQuestions.every(q => localSelectedIds.includes(q.question_id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setLocalSelectedIds([]);
      onSelectionChange?.([]);
    } else {
      const allIds = filteredQuestions.map(q => q.question_id);
      setLocalSelectedIds(allIds);
      onSelectionChange?.(allIds);
    }
  };

  const toggleSelect = (questionId: number) => {
    const newSelection = localSelectedIds.includes(questionId)
      ? localSelectedIds.filter(id => id !== questionId)
      : [...localSelectedIds, questionId];
    setLocalSelectedIds(newSelection);
    onSelectionChange?.(newSelection);
  };

  const clearSelection = () => {
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

  const getSafetyBadge = (score: string) => {
    const option = safetyOptions.find(o => o.value === score) || safetyOptions[3];
    return (
      <Badge variant="outline" className="gap-1">
        <span className={`w-2 h-2 rounded-full ${option.color}`} />
        {option.label}
      </Badge>
    );
  };

  const getStatusIcon = (q: QuestionData) => {
    if (q.has_published) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (q.has_video) return <Video className="w-4 h-4 text-blue-500" />;
    if (q.has_cover) return <Clock className="w-4 h-4 text-yellow-500" />;
    return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and add button */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по ID или тексту вопроса..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => { setNewQuestion({ question_id: nextQuestionId, question: '', safety_score: 'unchecked' }); setShowAddDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Добавить вопрос
        </Button>
        <span className="text-sm text-muted-foreground">
          Показано {filteredQuestions.length} из {questions.length} вопросов
        </span>
      </div>

      {/* Selection bar - shows when questions are selected */}
      {localSelectedIds.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <span className="text-sm font-medium">
            Выбрано {localSelectedIds.length} вопросов
          </span>
          <Button variant="outline" size="sm" onClick={clearSelection}>
            <X className="w-4 h-4 mr-1" />
            Сбросить
          </Button>
          {onGoToVideos && (
            <Button size="sm" onClick={onGoToVideos}>
              Перейти к роликам
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      )}

      {/* Table with Checkboxes */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Вопросы к духовникам</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-20">ID</TableHead>
                <TableHead className="w-28">Безопасность</TableHead>
                <TableHead className="w-24">Релевант.</TableHead>
                <TableHead>Вопрос</TableHead>
                <TableHead className="w-32">Дата план.</TableHead>
                <TableHead className="w-24">Статус</TableHead>
                <TableHead className="w-24">Роликов</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuestions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {questions.length === 0 ? 'Нет вопросов' : 'Ничего не найдено'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuestions.map((q) => (
                  <TableRow
                    key={q.question_id}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${localSelectedIds.includes(q.question_id) ? 'bg-primary/5' : ''}`}
                    onClick={() => handleRowClick(q)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={localSelectedIds.includes(q.question_id)}
                        onCheckedChange={() => toggleSelect(q.question_id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{q.question_id}</TableCell>
                    <TableCell>{getSafetyBadge(q.safety_score)}</TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">—</span>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="font-medium truncate">{q.question}</p>
                        {q.question_eng && (
                          <p className="text-sm text-muted-foreground truncate">{q.question_eng}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {q.planned_date ? format(new Date(q.planned_date), 'dd MMM yyyy', { locale: ru }) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(q)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {q.videos_count} / {q.total_publications}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
    </div>
  );
}
