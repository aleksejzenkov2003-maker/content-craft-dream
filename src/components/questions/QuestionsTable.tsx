import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Search, Shield, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Video } from '@/hooks/useVideos';
import { Publication } from '@/hooks/usePublications';
import { Progress } from '@/components/ui/progress';

interface QuestionsTableProps {
  videos: Video[];
  publications: Publication[];
  loading: boolean;
  onSelectQuestion?: (questionId: number) => void;
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

export function QuestionsTable({ videos, publications, loading, onSelectQuestion }: QuestionsTableProps) {
  const [search, setSearch] = useState('');

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

  const getSafetyBadge = (score: string) => {
    switch (score) {
      case 'safe':
        return (
          <Badge variant="default" className="bg-success/20 text-success border-success/30">
            <Shield className="w-3 h-3 mr-1" />
            Безопасно
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30">
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
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'in_progress':
        return <Loader2 className="w-4 h-4 text-info animate-spin" />;
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

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Вопросы к духовникам</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Нет вопросов
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuestions.map((q) => (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onSelectQuestion?.(q.id)}
                  >
                    <TableCell className="font-mono text-muted-foreground">
                      {q.id}
                    </TableCell>
                    <TableCell>{getSafetyBadge(q.safetyScore)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${q.relevanceScore}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{q.relevanceScore}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate">{q.question}</p>
                    </TableCell>
                    <TableCell>
                      {q.plannedDate ? (
                        <span className="text-sm">
                          {format(new Date(q.plannedDate), 'dd MMM yyyy, HH:mm', { locale: ru })} MSK
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusIcon(q.status)}
                    </TableCell>
                    <TableCell>
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
