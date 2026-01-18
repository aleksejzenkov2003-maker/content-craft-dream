import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Library, PenTool, FileCheck } from 'lucide-react';
import { PromptLibrary } from '@/components/prompts/PromptLibrary';
import { PromptForm } from '@/components/prompts/PromptForm';
import { RewriteCreator } from './RewriteCreator';
import { RewriteResultsCards } from './RewriteResultsCards';
import { DbPrompt } from '@/hooks/usePrompts';

interface ContentItem {
  id: string;
  title: string;
  content: string;
  source: string;
  channel?: string;
}

interface RewriteStudioProps {
  contents: ContentItem[];
  prompts: DbPrompt[];
  selectedContentIds?: string[];
  onAddPrompt: (prompt: Omit<DbPrompt, 'id' | 'created_at' | 'is_active'>) => Promise<any>;
  onUpdatePrompt: (id: string, updates: Partial<DbPrompt>) => Promise<any>;
  onDeletePrompt: (id: string) => Promise<void>;
  onTestPrompt: (prompt: DbPrompt, testContent: string) => Promise<string>;
  onRewrite: (contentId: string, promptId: string) => Promise<any>;
  onCreateVoiceover?: (rewriteId: string) => void;
  onClearSelection?: () => void;
}

export function RewriteStudio({
  contents,
  prompts,
  selectedContentIds = [],
  onAddPrompt,
  onUpdatePrompt,
  onDeletePrompt,
  onTestPrompt,
  onRewrite,
  onCreateVoiceover,
  onClearSelection,
}: RewriteStudioProps) {
  const [activeTab, setActiveTab] = useState('create');
  const [editingPrompt, setEditingPrompt] = useState<DbPrompt | null>(null);
  const [isCreatingPrompt, setIsCreatingPrompt] = useState(false);

  const handleEditPrompt = (prompt: DbPrompt) => {
    setEditingPrompt(prompt);
    setActiveTab('library');
  };

  const handleDuplicatePrompt = async (prompt: DbPrompt) => {
    await onAddPrompt({
      name: prompt.name + ' (копия)',
      type: prompt.type,
      model: prompt.model,
      temperature: prompt.temperature,
      max_tokens: prompt.max_tokens,
      system_prompt: prompt.system_prompt,
      user_template: prompt.user_template,
    });
  };

  const handleDeletePrompt = async (id: string) => {
    await onDeletePrompt(id);
  };

  const handleSetActivePrompt = async (id: string) => {
    // Deactivate all other prompts
    for (const p of prompts) {
      if (p.is_active && p.id !== id) {
        await onUpdatePrompt(p.id, { is_active: false });
      }
    }
    // Activate the selected one
    await onUpdatePrompt(id, { is_active: true });
  };

  const handleSavePrompt = async (data: Omit<DbPrompt, 'id' | 'created_at' | 'is_active'>) => {
    if (editingPrompt) {
      await onUpdatePrompt(editingPrompt.id, data);
      setEditingPrompt(null);
    } else {
      await onAddPrompt(data);
      setIsCreatingPrompt(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingPrompt(null);
    setIsCreatingPrompt(false);
  };

  const handleCreateNew = () => {
    setEditingPrompt(null);
    setIsCreatingPrompt(true);
  };

  const showForm = editingPrompt || isCreatingPrompt;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <PenTool className="h-4 w-4" />
            Создать
          </TabsTrigger>
          <TabsTrigger value="library" className="flex items-center gap-2">
            <Library className="h-4 w-4" />
            Промпты
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Результаты
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <RewriteCreator
            contents={contents}
            prompts={prompts}
            selectedContentIds={selectedContentIds}
            onRewrite={onRewrite}
            onCreateVoiceover={onCreateVoiceover}
            onClearSelection={onClearSelection}
          />
        </TabsContent>

        <TabsContent value="library" className="mt-6">
          {showForm ? (
            <PromptForm
              prompt={editingPrompt}
              onSave={handleSavePrompt}
              onCancel={handleCancelEdit}
              onTest={onTestPrompt}
            />
          ) : (
            <PromptLibrary
              prompts={prompts}
              onEdit={handleEditPrompt}
              onDuplicate={handleDuplicatePrompt}
              onDelete={handleDeletePrompt}
              onSetActive={handleSetActivePrompt}
              onCreateNew={handleCreateNew}
            />
          )}
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <RewriteResultsCards onCreateVoiceover={onCreateVoiceover} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
