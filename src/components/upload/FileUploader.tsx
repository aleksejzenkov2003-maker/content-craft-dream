import { useState, useCallback } from 'react';
import { Upload, X, File, Image, Music, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FileUploaderProps {
  accept?: string;
  maxSize?: number; // in MB
  folder?: string;
  onUpload: (url: string, file: File) => void;
  placeholder?: string;
  className?: string;
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return Image;
  if (type.startsWith('audio/')) return Music;
  if (type.startsWith('video/')) return Video;
  return File;
};

export function FileUploader({
  accept = '*/*',
  maxSize = 50,
  folder = 'uploads',
  onUpload,
  placeholder = 'Перетащите файл сюда или нажмите для выбора',
  className = '',
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string; type: string } | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const uploadFile = async (file: File) => {
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`Файл слишком большой. Максимум ${maxSize}MB`);
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('media-files')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('media-files')
        .getPublicUrl(data.path);

      setUploadedFile({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
      });

      onUpload(urlData.publicUrl, file);
      toast.success('Файл загружен');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Ошибка загрузки файла');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
  };

  if (uploadedFile) {
    const FileIcon = getFileIcon(uploadedFile.type);
    return (
      <div className={`flex items-center gap-3 p-3 border rounded-lg bg-muted/50 ${className}`}>
        <FileIcon className="h-8 w-8 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
          <a 
            href={uploadedFile.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:underline"
          >
            Открыть файл
          </a>
        </div>
        <Button variant="ghost" size="icon" onClick={clearFile}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
        ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
        ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        ${className}
      `}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <Upload className={`h-8 w-8 mx-auto mb-2 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
      <p className="text-sm text-muted-foreground">
        {isUploading ? 'Загрузка...' : placeholder}
      </p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        Максимум {maxSize}MB
      </p>
    </div>
  );
}
