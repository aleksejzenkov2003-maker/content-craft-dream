import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Copy, Trash2, Check, Sparkles } from 'lucide-react';
import { DbPrompt } from '@/hooks/usePrompts';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PromptLibraryProps {
  prompts: DbPrompt[];
  onEdit: (prompt: DbPrompt) => void;
  onDuplicate: (prompt: DbPrompt) => void;
  onDelete: (id: string) => void;
  onSetActive: (id: string) => void;
  onCreateNew: () => void;
}

const typeLabels: Record<string, string> = {
  rewrite: 'Рерайт',
  summary: 'Резюме',
  translate: 'Перевод',
  custom: 'Кастомный',
};

const modelLabels: Record<string, string> = {
  'google/gemini-2.5-flash': 'Gemini Flash',
  'google/gemini-2.5-pro': 'Gemini Pro',
  'google/gemini-2.5-flash-lite': 'Gemini Lite',
  'openai/gpt-5': 'GPT-5',
  'openai/gpt-5-mini': 'GPT-5 Mini',
};

export function PromptLibrary({ 
  prompts, 
  onEdit, 
  onDuplicate, 
  onDelete, 
  onSetActive,
  onCreateNew 
}: PromptLibraryProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Библиотека промптов</h3>
        <Button onClick={onCreateNew} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Новый промпт
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {prompts.map((prompt) => (
          <Card 
            key={prompt.id} 
            className={`relative ${prompt.is_active ? 'ring-2 ring-primary' : ''}`}
          >
            {prompt.is_active && (
              <div className="absolute -top-2 -right-2">
                <Badge className="bg-primary">
                  <Check className="h-3 w-3 mr-1" />
                  Активный
                </Badge>
              </div>
            )}
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                {prompt.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {typeLabels[prompt.type] || prompt.type}
                </Badge>
                <Badge variant="secondary">
                  {modelLabels[prompt.model] || prompt.model}
                </Badge>
              </div>
              
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Temperature: {prompt.temperature}</div>
                <div>Max tokens: {prompt.max_tokens}</div>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">
                {prompt.system_prompt.substring(0, 100)}...
              </p>

              <div className="flex items-center gap-1 pt-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onEdit(prompt)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onDuplicate(prompt)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {!prompt.is_active && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onSetActive(prompt.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setDeleteId(prompt.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить промпт?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Промпт будет удалён навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
