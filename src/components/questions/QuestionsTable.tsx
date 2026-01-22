import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Search, Shield, CheckCircle, Clock, AlertCircle, Trash2, Play } from 'lucide-react';
import { Video } from '@/hooks/useVideos';
import { Publication } from '@/hooks/usePublications';

interface QuestionsTableProps {
  videos: Video[];
  publications: Publication[];
  loading: boolean;
  onSelectQuestion?: (questionId: number) => void;
  onBulkAction?: (questionIds: number[], action: 'delete' | 'generate') => void;
}

interface QuestionData {
  id: number;
  question: string;
  questionEng?: string;
  safetyScore: string;
  relevanceScore: number;
  plannedDate: string | null;
  status: 'pending' | 'in_progress' | 'ready' | 'published';
  videosCount: number;
  publicationsCount: number;
}

export function QuestionsTable({ videos, publications, loading, onSelectQuestion, onBulkAction }: QuestionsTableProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const questions = useMemo(() => {
    const questionMap = new Map<string, QuestionData>();

    videos.forEach((video) => {
      if (!video.question) return;

      const existing = questionMap.get(video.question);
      if (existing) {
        existing.videosCount++;
        // Update status based on video statuses
        if (video.generation_status === 'ready') {
          existing.status = 'ready';
        }
      } else {
        questionMap.set(video.question, {
          id: video.question_id || questionMap.size + 1,
          question: video.question,
          questionEng: undefined,
          safetyScore: video.safety_score || 'safe',
          relevanceScore: Math.floor(Math.random() * 100),
          plannedDate: video.publication_date,
          status: video.generation_status === 'ready' ? 'ready' : 'pending',
          videosCount: 1,
          publicationsCount: 0,
        });
      }
    });

    return Array.from(questionMap.values()).sort((a, b) => a.id - b.id);
  }, [videos]);

  const filteredQuestions = useMemo(() => {
    if (!search) return questions;
    const searchLower = search.toLowerCase();
    return questions.filter(
      (q) =>
        q.question.toLowerCase().includes(searchLower) ||
        q.questionEng?.toLowerCase().includes(searchLower)
    );
  }, [questions, search]);

  const allSelected = filteredQuestions.length > 0 && filteredQuestions.every(q => selectedIds.has(q.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuestions.map(q => q.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkAction = (action: 'delete' | 'generate') => {
    if (selectedIds.size > 0 && onBulkAction) {
      onBulkAction(Array.from(selectedIds), action);
      setSelectedIds(new Set());
    }
  };

  const getSafetyBadge = (score: string) => {
    switch (score) {
      case 'safe':
        return (
          <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
            <Shield className="w-3 h-3 mr-1" />
            Безопасно
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-500/30">
            <AlertCircle className="w-3 h-3 mr-1" />
            Внимание
          </Badge>
        );
      case 'danger':
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Опасно
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            Не проверен
          </Badge>
        );
    }
  };

  const getStatusIcon = (status: QuestionData['status']) => {
    switch (status) {
      case 'ready':
      case 'published':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'in_progress':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
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
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по вопросам..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          Всего: {filteredQuestions.length} вопросов
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {someSelected && (
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
          <span className="text-sm font-medium">
            Выбрано: {selectedIds.size}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('generate')}
            >
              <Play className="w-4 h-4 mr-2" />
              Сгенерировать
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => handleBulkAction('delete')}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Отменить выбор
          </Button>
        </div>
      )}

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Вопросы к духовникам</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Выбрать все"
                  />
                </TableHead>
                <TableHead className="w-16">ID</TableHead>
                <TableHead className="w-32">Безопасность</TableHead>
                <TableHead className="w-24">Актуальность</TableHead>
                <TableHead>Вопрос (рус)</TableHead>
                <TableHead className="w-48">Дата публикации</TableHead>
                <TableHead className="w-16">Статус</TableHead>
                <TableHead className="w-24">Роликов</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuestions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Нет вопросов
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuestions.map((q) => (
                  <TableRow
                    key={q.id}
                    className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(q.id) ? 'bg-muted/30' : ''}`}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(q.id)}
                        onCheckedChange={() => toggleSelect(q.id)}
                        aria-label={`Выбрать вопрос ${q.id}`}
                      />
                    </TableCell>
                    <TableCell 
                      className="font-mono text-muted-foreground"
                      onClick={() => onSelectQuestion?.(q.id)}
                    >
                      {q.id}
                    </TableCell>
                    <TableCell onClick={() => onSelectQuestion?.(q.id)}>
                      {getSafetyBadge(q.safetyScore)}
                    </TableCell>
                    <TableCell onClick={() => onSelectQuestion?.(q.id)}>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${q.relevanceScore}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{q.relevanceScore}</span>
                      </div>
                    </TableCell>
                    <TableCell 
                      className="max-w-md"
                      onClick={() => onSelectQuestion?.(q.id)}
                    >
                      <p className="truncate">{q.question}</p>
                    </TableCell>
                    <TableCell onClick={() => onSelectQuestion?.(q.id)}>
                      {q.plannedDate ? (
                        <span className="text-sm">
                          {format(new Date(q.plannedDate), 'dd MMM yyyy, HH:mm', { locale: ru })} MSK
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell 
                      className="text-center"
                      onClick={() => onSelectQuestion?.(q.id)}
                    >
                      {getStatusIcon(q.status)}
                    </TableCell>
                    <TableCell onClick={() => onSelectQuestion?.(q.id)}>
                      <Badge variant="secondary">{q.videosCount}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
