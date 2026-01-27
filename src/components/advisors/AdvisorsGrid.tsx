import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Advisor, AdvisorPhoto } from '@/hooks/useAdvisors';
import { Plus, Trash2, Star, Upload, Image, Loader2, Settings, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ImageInput } from '@/components/ui/image-input';
import { CsvImporter } from '@/components/import/CsvImporter';
import { ADVISOR_COLUMN_MAPPING, ADVISOR_PREVIEW_COLUMNS } from '@/components/import/importConfigs';

interface AdvisorsGridProps {
  advisors: Advisor[];
  loading: boolean;
  onAddAdvisor: (data: { name: string; display_name?: string }) => Promise<any>;
  onUpdateAdvisor: (id: string, updates: Partial<Advisor>) => Promise<void>;
  onDeleteAdvisor: (id: string) => Promise<void>;
  onAddPhoto: (advisorId: string, photoUrl: string, isPrimary?: boolean) => Promise<any>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onSetPrimaryPhoto: (advisorId: string, photoId: string) => Promise<void>;
  onUploadToHeygen: (photo: AdvisorPhoto) => Promise<void>;
  onBulkImport?: (data: Partial<Advisor>[]) => Promise<void>;
}

export function AdvisorsGrid({
  advisors,
  loading,
  onAddAdvisor,
  onUpdateAdvisor,
  onDeleteAdvisor,
  onAddPhoto,
  onDeletePhoto,
  onSetPrimaryPhoto,
  onUploadToHeygen,
  onBulkImport,
}: AdvisorsGridProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [selectedAdvisor, setSelectedAdvisor] = useState<Advisor | null>(null);
  const [uploadingAdvisorId, setUploadingAdvisorId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddAdvisor = async () => {
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddAdvisor({ name: newName, display_name: newDisplayName || undefined });
      setNewName('');
      setNewDisplayName('');
      setShowAddDialog(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPhoto = async (advisorId: string) => {
    if (!newPhotoUrl.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddPhoto(advisorId, newPhotoUrl, false);
      setNewPhotoUrl('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (advisorId: string, file: File) => {
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Файл слишком большой (макс. 5MB)');
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `advisors/${advisorId}/${Date.now()}.${ext}`;

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

      if (!urlData.publicUrl) throw new Error('Failed to get public URL');

      await onAddPhoto(advisorId, urlData.publicUrl, false);
      toast.success('Фото загружено');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Ошибка загрузки: ' + (error.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
      setUploadingAdvisorId(null);
    }
  };

  const triggerFileInput = (advisorId: string) => {
    setUploadingAdvisorId(advisorId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingAdvisorId) {
      handleFileUpload(uploadingAdvisorId, file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async (data: Record<string, any>[]) => {
    if (onBulkImport) {
      await onBulkImport(data as Partial<Advisor>[]);
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
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Духовники ({advisors.length})</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImporter(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Импорт CSV
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Добавить духовника
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый духовник</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Имя (ID)</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Orthodox, Rabbi, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Отображаемое имя</Label>
                  <Input
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="Православный старец"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Отмена
                </Button>
                <Button onClick={handleAddAdvisor} disabled={isSubmitting || !newName.trim()}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Добавить
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {advisors.map((advisor) => (
          <Card key={advisor.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{advisor.name}</CardTitle>
                  {advisor.display_name && (
                    <p className="text-sm text-muted-foreground">{advisor.display_name}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedAdvisor(advisor)}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDeleteAdvisor(advisor.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant={advisor.is_active ? 'default' : 'secondary'}>
                  {advisor.is_active ? 'Активен' : 'Неактивен'}
                </Badge>
                <Badge variant="outline">
                  {advisor.photos?.length || 0} фото
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {advisor.photos?.map((photo) => (
                  <div
                    key={photo.id}
                    className={cn(
                      "relative aspect-square rounded-lg overflow-hidden border-2 group",
                      photo.is_primary ? "border-primary" : "border-transparent"
                    )}
                  >
                    <img
                      src={photo.photo_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {photo.is_primary && (
                      <Star className="absolute top-1 left-1 w-4 h-4 text-primary fill-primary" />
                    )}
                    {photo.heygen_asset_id && (
                      <Badge className="absolute bottom-1 left-1 text-[10px] px-1">
                        HeyGen
                      </Badge>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      {!photo.is_primary && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-white hover:text-primary"
                          onClick={() => onSetPrimaryPhoto(advisor.id, photo.id)}
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      )}
                      {!photo.heygen_asset_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-white hover:text-primary"
                          onClick={() => onUploadToHeygen(photo)}
                        >
                          <Upload className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white hover:text-destructive"
                        onClick={() => onDeletePhoto(photo.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-full w-full rounded-lg">
                        <Plus className="w-6 h-6 text-muted-foreground" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Добавить фото для {advisor.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <ImageInput
                          value={newPhotoUrl}
                          onChange={(url) => {
                            setNewPhotoUrl(url);
                            onAddPhoto(advisor.id, url, false);
                            setNewPhotoUrl('');
                          }}
                          folder={`advisors/${advisor.id}`}
                          aspectRatio="1:1"
                          generatePromptPrefix={`Professional portrait photo of ${advisor.display_name || advisor.name}, a spiritual advisor. High quality headshot suitable for video content.`}
                          showPreview={false}
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {advisor.elevenlabs_voice_id && (
                <div className="text-xs text-muted-foreground">
                  Voice ID: {advisor.elevenlabs_voice_id}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedAdvisor} onOpenChange={(open) => !open && setSelectedAdvisor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Настройки: {selectedAdvisor?.name}</DialogTitle>
          </DialogHeader>
          {selectedAdvisor && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Отображаемое имя</Label>
                <Input
                  value={selectedAdvisor.display_name || ''}
                  onChange={(e) => setSelectedAdvisor({ ...selectedAdvisor, display_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Скорость речи</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="2"
                  value={selectedAdvisor.speech_speed}
                  onChange={(e) => setSelectedAdvisor({ ...selectedAdvisor, speech_speed: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>ElevenLabs Voice ID</Label>
                <Input
                  value={selectedAdvisor.elevenlabs_voice_id || ''}
                  onChange={(e) => setSelectedAdvisor({ ...selectedAdvisor, elevenlabs_voice_id: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAdvisor(null)}>
              Отмена
            </Button>
            <Button
              onClick={async () => {
                if (selectedAdvisor) {
                  await onUpdateAdvisor(selectedAdvisor.id, {
                    display_name: selectedAdvisor.display_name,
                    speech_speed: selectedAdvisor.speech_speed,
                    elevenlabs_voice_id: selectedAdvisor.elevenlabs_voice_id,
                  });
                  setSelectedAdvisor(null);
                }
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CsvImporter
        open={showImporter}
        onClose={() => setShowImporter(false)}
        title="Импорт духовников из CSV"
        columnMapping={ADVISOR_COLUMN_MAPPING}
        previewColumns={ADVISOR_PREVIEW_COLUMNS}
        onImport={handleImport}
        requiredFields={['name']}
      />
    </div>
  );
}
