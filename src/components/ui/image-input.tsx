import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Sparkles, Link, Loader2, Image, X } from 'lucide-react';

interface ImageInputProps {
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  placeholder?: string;
  generatePromptPrefix?: string;
  className?: string;
  showPreview?: boolean;
}

export function ImageInput({
  value,
  onChange,
  folder = 'images',
  aspectRatio = '16:9',
  placeholder = 'Введите URL изображения',
  generatePromptPrefix = '',
  className = '',
  showPreview = true,
}: ImageInputProps) {
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [urlInput, setUrlInput] = useState(value || '');
  const [generatePrompt, setGeneratePrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAspectClass = () => {
    switch (aspectRatio) {
      case '9:16': return 'aspect-[9/16]';
      case '1:1': return 'aspect-square';
      default: return 'aspect-video';
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Файл слишком большой (макс. 10MB)');
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

      const { data, error } = await supabase.storage
        .from('media-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('media-files')
        .getPublicUrl(fileName);

      onChange(urlData.publicUrl);
      toast.success('Изображение загружено');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Ошибка загрузки: ' + (error.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!generatePrompt.trim()) {
      toast.error('Введите описание для генерации');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: generatePromptPrefix ? `${generatePromptPrefix} ${generatePrompt}` : generatePrompt,
          aspectRatio,
          folder,
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        onChange(data.imageUrl);
        setGeneratePrompt('');
        toast.success('Изображение сгенерировано');
      } else {
        throw new Error('No image URL returned');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error('Ошибка генерации: ' + (error.message || 'Unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) {
      toast.error('Введите URL изображения');
      return;
    }
    onChange(urlInput.trim());
    toast.success('URL применён');
  };

  const handleClear = () => {
    onChange('');
    setUrlInput('');
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Preview */}
      {showPreview && value && (
        <div className={`relative ${getAspectClass()} bg-muted rounded-lg overflow-hidden group max-h-48`}>
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
            onClick={handleClear}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="text-xs">
            <Upload className="w-3 h-3 mr-1" />
            Загрузить
          </TabsTrigger>
          <TabsTrigger value="generate" className="text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            Генерация
          </TabsTrigger>
          <TabsTrigger value="url" className="text-xs">
            <Link className="w-3 h-3 mr-1" />
            URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-2 mt-3">
          <div
            className={`
              border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
              hover:border-primary/50 hover:bg-muted/50
              ${isUploading ? 'opacity-50 pointer-events-none' : ''}
            `}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-primary" />
            ) : (
              <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            )}
            <p className="text-sm text-muted-foreground">
              {isUploading ? 'Загрузка...' : 'Нажмите или перетащите файл'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              PNG, JPG до 10MB
            </p>
          </div>
        </TabsContent>

        <TabsContent value="generate" className="space-y-3 mt-3">
          <div className="space-y-2">
            <Textarea
              value={generatePrompt}
              onChange={(e) => setGeneratePrompt(e.target.value)}
              placeholder="Опишите изображение, которое хотите сгенерировать..."
              className="min-h-[80px] resize-none"
            />
            {generatePromptPrefix && (
              <p className="text-xs text-muted-foreground">
                Контекст: {generatePromptPrefix.slice(0, 50)}...
              </p>
            )}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !generatePrompt.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Генерация...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Сгенерировать
              </>
            )}
          </Button>
        </TabsContent>

        <TabsContent value="url" className="space-y-3 mt-3">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={placeholder}
          />
          <Button
            onClick={handleUrlSubmit}
            disabled={!urlInput.trim()}
            variant="outline"
            className="w-full"
          >
            <Link className="w-4 h-4 mr-2" />
            Применить URL
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
