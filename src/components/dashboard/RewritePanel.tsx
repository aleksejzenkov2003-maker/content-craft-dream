import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Copy, Check, Video, Send, Upload, FileText } from 'lucide-react';
import { ContentSource } from '@/types/content';
import { FileUploader } from '@/components/upload/FileUploader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface RewritePanelProps {
  originalContent: {
    title: string;
    description: string;
    source: ContentSource | string;
  } | null;
  contentId?: string;
  onRewrite?: (contentId: string, promptId?: string) => Promise<any>;
  onGenerateVideo?: (script: string) => void;
  onPostToChannel?: (content: string) => void;
  onUploadScript?: (script: string) => void;
}

export function RewritePanel({ 
  originalContent, 
  contentId, 
  onRewrite, 
  onGenerateVideo, 
  onPostToChannel,
  onUploadScript 
}: RewritePanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [scriptSource, setScriptSource] = useState<'ai' | 'upload' | 'manual'>('ai');
  const [manualScript, setManualScript] = useState('');
  const [rewrittenContent, setRewrittenContent] = useState<{
    headline: string;
    hook: string;
    mainStory: string;
    impact: string;
    cta: string;
    fullScript: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!contentId || !onRewrite) return;
    
    setIsGenerating(true);
    try {
      const result = await onRewrite(contentId);
      if (result) {
        const text = result.rewritten_text || result.script || '';
        setRewrittenContent({
          headline: '🔥 ' + (result.hook || originalContent?.title || 'Новый прорыв!').substring(0, 60),
          hook: result.hook || text.substring(0, 100),
          mainStory: text,
          impact: 'Это изменит ваше понимание темы.',
          cta: result.cta || 'Подписывайтесь, чтобы быть в курсе!',
          fullScript: text,
        });
      }
    } catch (error) {
      console.error('Rewrite error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualScript = () => {
    if (!manualScript.trim()) return;
    
    setRewrittenContent({
      headline: '📝 Ваш скрипт',
      hook: manualScript.substring(0, 100),
      mainStory: manualScript,
      impact: '',
      cta: '',
      fullScript: manualScript,
    });
    onUploadScript?.(manualScript);
  };

  const handleFileUpload = async (url: string, file: File) => {
    try {
      const text = await file.text();
      setManualScript(text);
      setRewrittenContent({
        headline: '📄 Загруженный скрипт',
        hook: text.substring(0, 100),
        mainStory: text,
        impact: '',
        cta: '',
        fullScript: text,
      });
      onUploadScript?.(text);
    } catch (error) {
      console.error('Error reading file:', error);
    }
  };

  const handleCopy = () => {
    if (rewrittenContent) {
      navigator.clipboard.writeText(rewrittenContent.fullScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!originalContent) {
    return (
      <div className="rounded-xl p-8 card-gradient border border-border text-center">
        <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">Выберите контент для рерайта</h3>
        <p className="text-sm text-muted-foreground">
          Нажмите на иконку ✨ рядом с любым постом, чтобы создать вирусный скрипт
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-6 card-gradient border border-border space-y-6">
      {/* Original content */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">Оригинал</h3>
          <Badge variant="secondary">{originalContent.source}</Badge>
        </div>
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <h4 className="font-medium mb-2">{originalContent.title}</h4>
          <p className="text-sm text-muted-foreground line-clamp-4">{originalContent.description}</p>
        </div>
      </div>

      {/* Script source selection */}
      {!rewrittenContent && (
        <div className="space-y-4">
          <Tabs value={scriptSource} onValueChange={(v) => setScriptSource(v as typeof scriptSource)}>
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="ai">
                <Sparkles className="w-4 h-4 mr-2" />
                AI генерация
              </TabsTrigger>
              <TabsTrigger value="upload">
                <Upload className="w-4 h-4 mr-2" />
                Загрузить
              </TabsTrigger>
              <TabsTrigger value="manual">
                <FileText className="w-4 h-4 mr-2" />
                Вручную
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="mt-4">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !contentId}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Генерация скрипта...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Сгенерировать вирусный скрипт
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="upload" className="mt-4">
              <FileUploader
                accept=".txt,.md,.doc,.docx"
                folder="scripts"
                onUpload={handleFileUpload}
                placeholder="Загрузите текстовый файл со скриптом"
              />
            </TabsContent>

            <TabsContent value="manual" className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label>Введите скрипт</Label>
                <Textarea
                  value={manualScript}
                  onChange={(e) => setManualScript(e.target.value)}
                  placeholder="Введите текст скрипта..."
                  rows={6}
                />
              </div>
              <Button onClick={handleManualScript} disabled={!manualScript.trim()}>
                Использовать этот скрипт
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Rewritten content */}
      {rewrittenContent && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold gradient-text">
              {scriptSource === 'ai' ? 'Вирусный скрипт' : 'Скрипт'}
            </h3>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRewrittenContent(null)}>
                Изменить
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? 'Скопировано' : 'Копировать'}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {rewrittenContent.headline && scriptSource === 'ai' && (
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                <span className="text-xs text-warning font-medium">ЗАГОЛОВОК</span>
                <p className="font-bold mt-1">{rewrittenContent.headline}</p>
              </div>
            )}

            {rewrittenContent.hook && scriptSource === 'ai' && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-xs text-primary font-medium">ХУК</span>
                <p className="mt-1">{rewrittenContent.hook}</p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <span className="text-xs text-muted-foreground font-medium">СКРИПТ</span>
              <p className="mt-1 whitespace-pre-wrap">{rewrittenContent.mainStory}</p>
            </div>

            {rewrittenContent.cta && scriptSource === 'ai' && (
              <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                <span className="text-xs text-success font-medium">ПРИЗЫВ К ДЕЙСТВИЮ</span>
                <p className="mt-1">{rewrittenContent.cta}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={() => onGenerateVideo?.(rewrittenContent.fullScript)}
            >
              <Video className="w-4 h-4 mr-2" />
              Создать видео
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onPostToChannel?.(rewrittenContent.fullScript)}
            >
              <Send className="w-4 h-4 mr-2" />
              В Telegram
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
