import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Volume2, Loader2, Mic, Upload, ChevronDown, Plus } from 'lucide-react';
import { TeleprompterRecorder } from './TeleprompterRecorder';
import { AudioUploader } from './AudioUploader';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface CustomTextVoiceoverProps {
  onGenerateElevenLabs: (text: string, title: string) => Promise<void>;
  onSaveRecording: (text: string, title: string, blob: Blob, duration: number) => Promise<void>;
  onUploadAudio: (text: string, title: string, file: File) => Promise<void>;
}

export function CustomTextVoiceover({
  onGenerateElevenLabs,
  onSaveRecording,
  onUploadAudio
}: CustomTextVoiceoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showUploader, setShowUploader] = useState(false);

  const handleGenerateElevenLabs = async () => {
    if (!text.trim()) return;
    setGenerating(true);
    try {
      await onGenerateElevenLabs(text, title || 'Кастомная озвучка');
      setText('');
      setTitle('');
      setIsOpen(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleRecordingSave = async (blob: Blob, duration: number) => {
    await onSaveRecording(text, title || 'Кастомная озвучка', blob, duration);
    setText('');
    setTitle('');
    setShowRecorder(false);
    setIsOpen(false);
  };

  const handleFileUpload = async (file: File) => {
    await onUploadAudio(text, title || 'Кастомная озвучка', file);
    setText('');
    setTitle('');
    setShowUploader(false);
    setIsOpen(false);
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Создать озвучку из своего текста</h3>
                  <p className="text-sm text-muted-foreground">
                    Вставьте текст и создайте озвучку с AI, запишите или загрузите аудио
                  </p>
                </div>
              </div>
              <ChevronDown className={cn(
                "w-5 h-5 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-2 border-t border-border space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-title">Название (опционально)</Label>
                <Input
                  id="custom-title"
                  placeholder="Например: Реклама продукта"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-text">Текст для озвучки</Label>
                <Textarea
                  id="custom-text"
                  placeholder="Вставьте текст, который нужно озвучить..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleGenerateElevenLabs}
                  disabled={!text.trim() || generating}
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Volume2 className="w-4 h-4 mr-2" />
                  )}
                  ElevenLabs (Григорий)
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowRecorder(true)}
                  disabled={!text.trim()}
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Записать
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowUploader(true)}
                  disabled={!text.trim()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Загрузить файл
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Teleprompter Modal */}
      <TeleprompterRecorder
        open={showRecorder}
        onClose={() => setShowRecorder(false)}
        text={text}
        onSave={handleRecordingSave}
      />

      {/* Upload Modal */}
      <AudioUploader
        open={showUploader}
        onClose={() => setShowUploader(false)}
        onUpload={handleFileUpload}
      />
    </>
  );
}
