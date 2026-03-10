import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Play, Save, Copy, Check, Loader2, 
  Sparkles, Settings2, ChevronDown, ChevronUp 
} from 'lucide-react';
import { DbPrompt } from '@/hooks/usePrompts';

interface PromptEditorProps {
  prompts?: DbPrompt[];
  onUpdatePrompt?: (id: string, updates: Partial<DbPrompt>) => Promise<DbPrompt | undefined>;
  onTestPrompt?: (prompt: DbPrompt, testContent: string) => Promise<string>;
}

export function PromptEditor({ prompts = [], onUpdatePrompt, onTestPrompt }: PromptEditorProps) {
  const [selectedPromptId, setSelectedPromptId] = useState(prompts[0]?.id || '');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [showTestData, setShowTestData] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Local edits
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<DbPrompt>>>({});
  
  // Тестовые данные
  const [testData, setTestData] = useState({
    content: 'Как защитить товарный знак в 2024 году. В этом видео мы разберём все этапы регистрации товарного знака в России. От подачи заявки до получения свидетельства.',
  });

  const selectedPrompt = prompts.find(p => p.id === selectedPromptId);
  const editedPrompt = selectedPrompt ? { ...selectedPrompt, ...localEdits[selectedPromptId] } : null;

  const updateLocalEdit = (field: keyof DbPrompt, value: any) => {
    if (!selectedPromptId) return;
    setLocalEdits(prev => ({
      ...prev,
      [selectedPromptId]: {
        ...prev[selectedPromptId],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!selectedPromptId || !onUpdatePrompt || !localEdits[selectedPromptId]) return;
    
    setIsSaving(true);
    try {
      await onUpdatePrompt(selectedPromptId, localEdits[selectedPromptId]);
      setLocalEdits(prev => {
        const copy = { ...prev };
        delete copy[selectedPromptId];
        return copy;
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!editedPrompt || !onTestPrompt) return;
    
    setIsTesting(true);
    setTestResult('');
    
    try {
      const result = await onTestPrompt(editedPrompt, testData.content);
      setTestResult(result);
    } catch (error) {
      setTestResult('Ошибка: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopy = () => {
    if (editedPrompt) {
      navigator.clipboard.writeText(editedPrompt.system_prompt + '\n\n' + editedPrompt.user_template);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (prompts.length === 0) {
    return (
      <div className="rounded-xl p-8 card-gradient border border-border text-center">
        <Settings2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">Нет промптов</h3>
        <p className="text-sm text-muted-foreground">
          Промпты загружаются из базы данных
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl card-gradient border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Settings2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Редактор промптов</h3>
            <p className="text-xs text-muted-foreground">Настройка и тестирование AI промптов</p>
          </div>
        </div>
        
        <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
          <SelectTrigger className="w-64 bg-secondary/50">
            <SelectValue placeholder="Выберите промпт" />
          </SelectTrigger>
          <SelectContent>
            {prompts.map(p => (
              <SelectItem key={p.id} value={p.id}>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {p.type}
                  </Badge>
                  {p.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {editedPrompt && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-x divide-border">
          {/* Editor Panel */}
          <div className="p-4 space-y-4">
            {/* Model settings */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Модель</label>
                <Select 
                  value={editedPrompt.model} 
                  onValueChange={v => updateLocalEdit('model', v)}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-sonnet-4-5">Claude Sonnet 4.5</SelectItem>
                    <SelectItem value="claude-opus-4-5-20251101">Claude Opus 4.5</SelectItem>
                    <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                    <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground mb-1 block">Temp</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={editedPrompt.temperature}
                  onChange={e => updateLocalEdit('temperature', parseFloat(e.target.value))}
                  className="bg-secondary/50"
                />
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground mb-1 block">Max tokens</label>
                <Input
                  type="number"
                  step="100"
                  min="100"
                  max="8000"
                  value={editedPrompt.max_tokens}
                  onChange={e => updateLocalEdit('max_tokens', parseInt(e.target.value))}
                  className="bg-secondary/50"
                />
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">System Prompt</label>
              <Textarea
                value={editedPrompt.system_prompt}
                onChange={e => updateLocalEdit('system_prompt', e.target.value)}
                className="min-h-[100px] bg-secondary/50 font-mono text-sm"
                placeholder="Системный промпт..."
              />
            </div>

            {/* User Prompt Template */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                User Prompt Template 
                <span className="text-primary ml-2">{'{{content}}'}</span>
              </label>
              <Textarea
                value={editedPrompt.user_template}
                onChange={e => updateLocalEdit('user_template', e.target.value)}
                className="min-h-[200px] bg-secondary/50 font-mono text-sm"
                placeholder="Шаблон промпта с переменными..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? 'Скопировано' : 'Копировать'}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSave}
                disabled={isSaving || !localEdits[selectedPromptId]}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Сохранить
              </Button>
            </div>
          </div>

          {/* Test Panel */}
          <div className="p-4 space-y-4 bg-muted/20">
            {/* Test Data */}
            <div>
              <button
                onClick={() => setShowTestData(!showTestData)}
                className="flex items-center gap-2 text-sm font-medium mb-2 hover:text-primary transition-colors"
              >
                {showTestData ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Тестовые данные
              </button>
              
              {showTestData && (
                <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <div>
                    <label className="text-xs text-muted-foreground">content</label>
                    <Textarea
                      value={testData.content}
                      onChange={e => setTestData(prev => ({ ...prev, content: e.target.value }))}
                      className="bg-background min-h-[80px]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Test Button */}
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              onClick={handleTest}
              disabled={isTesting}
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Тестирование...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Запустить тест
                </>
              )}
            </Button>

            {/* Result */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Результат</label>
              <div className="relative">
                <pre className={cn(
                  "min-h-[300px] max-h-[400px] overflow-auto p-3 rounded-lg",
                  "bg-background border border-border font-mono text-xs whitespace-pre-wrap break-words",
                  !testResult && "flex items-center justify-center text-muted-foreground"
                )}>
                  {testResult || (
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Результат теста появится здесь
                    </span>
                  )}
                </pre>
                {testResult && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => navigator.clipboard.writeText(testResult)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
