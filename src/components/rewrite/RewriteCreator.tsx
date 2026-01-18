import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, FileText, Copy, Check, Volume2, Send, ChevronRight, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { DbPrompt } from '@/hooks/usePrompts';

interface ContentItem {
  id: string;
  title: string;
  content: string;
  source: string;
  channel?: string;
}

interface RewriteResult {
  id: string;
  rewritten_text: string;
  hook?: string;
  cta?: string;
}

interface RewriteCreatorProps {
  contents: ContentItem[];
  prompts: DbPrompt[];
  selectedContentIds?: string[];
  onRewrite: (contentId: string, promptId: string) => Promise<RewriteResult>;
  onCreateVoiceover?: (rewriteId: string) => void;
  onPostToChannel?: (rewriteId: string) => void;
  onClearSelection?: () => void;
}

export function RewriteCreator({ 
  contents, 
  prompts, 
  selectedContentIds = [],
  onRewrite,
  onCreateVoiceover,
  onPostToChannel,
  onClearSelection
}: RewriteCreatorProps) {
  const [selectedContentId, setSelectedContentId] = useState<string>('');
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<RewriteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  // Filter contents based on selection
  const isBatchMode = selectedContentIds.length > 0;
  const availableContents = isBatchMode 
    ? contents.filter(c => selectedContentIds.includes(c.id))
    : contents;

  const selectedContent = contents.find(c => c.id === selectedContentId);
  const selectedPrompt = prompts.find(p => p.id === selectedPromptId);
  const activePrompt = prompts.find(p => p.is_active);

  // Auto-select first selected content from table when navigating from Content tab
  useEffect(() => {
    if (selectedContentIds.length > 0) {
      setSelectedContentId(selectedContentIds[0]);
      setBatchIndex(0);
      setCompletedCount(0);
    }
  }, [selectedContentIds.join(',')]);

  // Auto-select active prompt
  useEffect(() => {
    if (activePrompt && !selectedPromptId) {
      setSelectedPromptId(activePrompt.id);
    }
  }, [activePrompt]);

  const handleGenerate = async () => {
    if (!selectedContentId || !selectedPromptId) return;
    
    setIsGenerating(true);
    setResult(null);
    
    try {
      const res = await onRewrite(selectedContentId, selectedPromptId);
      setResult(res);
      if (isBatchMode) {
        setCompletedCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Rewrite error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNextInBatch = () => {
    if (batchIndex < selectedContentIds.length - 1) {
      const nextIndex = batchIndex + 1;
      setBatchIndex(nextIndex);
      setSelectedContentId(selectedContentIds[nextIndex]);
      setResult(null);
    }
  };

  const handleClearBatch = () => {
    onClearSelection?.();
    setBatchIndex(0);
    setCompletedCount(0);
    setResult(null);
  };

  const handleCopy = () => {
    if (result?.rewritten_text) {
      navigator.clipboard.writeText(result.rewritten_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Preview template with substituted values
  const getPreview = () => {
    if (!selectedPrompt || !selectedContent) return '';
    
    return selectedPrompt.user_template
      .replace(/\{\{content\}\}/g, selectedContent.content?.substring(0, 200) + '...' || '')
      .replace(/\{\{title\}\}/g, selectedContent.title || '')
      .replace(/\{\{source\}\}/g, selectedContent.source || '')
      .replace(/\{\{channel\}\}/g, selectedContent.channel || '');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Левая панель - выбор и настройки */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Создать рерайт</CardTitle>
                <CardDescription>Выберите контент и промпт для генерации</CardDescription>
              </div>
              {isBatchMode && (
                <Button variant="ghost" size="sm" onClick={handleClearBatch}>
                  <X className="w-4 h-4 mr-1" />
                  Очистить выбор
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Batch mode indicator */}
            {isBatchMode && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-primary">
                    Пакетный рерайт: {batchIndex + 1} из {selectedContentIds.length}
                  </span>
                  <span className="text-muted-foreground">
                    Выполнено: {completedCount}
                  </span>
                </div>
                <Progress value={(completedCount / selectedContentIds.length) * 100} className="h-2" />
              </div>
            )}

            <div className="space-y-2">
              <Label>Контент для рерайта {isBatchMode && <Badge variant="secondary" className="ml-2">Только выбранные</Badge>}</Label>
              <Select value={selectedContentId} onValueChange={setSelectedContentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите контент..." />
                </SelectTrigger>
                <SelectContent>
                  {availableContents.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {c.source}
                        </Badge>
                        <span className="truncate max-w-[250px]">{c.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Промпт</Label>
              <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите промпт..." />
                </SelectTrigger>
                <SelectContent>
                  {prompts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        {p.is_active && <Badge className="text-xs">По умолчанию</Badge>}
                        <span>{p.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedContent && (
              <div className="space-y-2">
                <Label>Оригинальный контент</Label>
                <div className="p-3 bg-muted rounded-lg max-h-[200px] overflow-auto">
                  <h4 className="font-medium mb-2">{selectedContent.title}</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedContent.content?.substring(0, 500)}
                    {(selectedContent.content?.length || 0) > 500 && '...'}
                  </p>
                </div>
              </div>
            )}

            <Button 
              onClick={handleGenerate}
              disabled={!selectedContentId || !selectedPromptId || isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {isGenerating ? 'Генерация...' : 'Сгенерировать рерайт'}
            </Button>
          </CardContent>
        </Card>

        {selectedPrompt && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Превью промпта</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="p-2 bg-muted/50 rounded text-xs">
                  <p className="font-medium mb-1">System:</p>
                  <p className="text-muted-foreground line-clamp-3">{selectedPrompt.system_prompt}</p>
                </div>
                {selectedContent && (
                  <div className="p-2 bg-muted/50 rounded text-xs">
                    <p className="font-medium mb-1">User (с подстановкой):</p>
                    <p className="text-muted-foreground line-clamp-5">{getPreview()}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Правая панель - результат */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Результат
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>AI пишет рерайт...</p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {result.hook && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Хук</Label>
                  <p className="text-sm font-medium">{result.hook}</p>
                </div>
              )}
              
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Текст</Label>
                <Textarea 
                  value={result.rewritten_text} 
                  readOnly 
                  className="min-h-[250px] resize-none"
                />
              </div>

              {result.cta && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">CTA</Label>
                  <p className="text-sm font-medium">{result.cta}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-4">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? 'Скопировано' : 'Копировать'}
                </Button>
                {onCreateVoiceover && (
                  <Button variant="outline" size="sm" onClick={() => onCreateVoiceover(result.id)}>
                    <Volume2 className="h-4 w-4 mr-2" />
                    Создать озвучку
                  </Button>
                )}
                {onPostToChannel && (
                  <Button variant="outline" size="sm" onClick={() => onPostToChannel(result.id)}>
                    <Send className="h-4 w-4 mr-2" />
                    В Telegram
                  </Button>
                )}
                {isBatchMode && batchIndex < selectedContentIds.length - 1 && (
                  <Button size="sm" onClick={handleNextInBatch}>
                    Далее
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Sparkles className="h-8 w-8 mb-4 opacity-50" />
              <p>Выберите контент и промпт</p>
              <p className="text-sm">для генерации рерайта</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
