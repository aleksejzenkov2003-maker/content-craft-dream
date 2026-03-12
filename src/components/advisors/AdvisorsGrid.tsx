import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Advisor, AdvisorPhoto } from '@/hooks/useAdvisors';
import { Plus, Trash2, Star, Loader2, FileSpreadsheet, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ImageInput } from '@/components/ui/image-input';
import { CsvImporter } from '@/components/import/CsvImporter';
import { ADVISOR_COLUMN_MAPPING, ADVISOR_PREVIEW_COLUMNS, ADVISOR_FIELD_DEFINITIONS } from '@/components/import/importConfigs';

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
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Advisor>>({});
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

  const handleFileUpload = async (advisorId: string, file: File) => {
    if (!file || !file.type.startsWith('image/')) {
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
      const { error } = await supabase.storage
        .from('media-files')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('media-files').getPublicUrl(fileName);
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
    if (file && uploadingAdvisorId) handleFileUpload(uploadingAdvisorId, file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async (data: Record<string, any>[]) => {
    if (onBulkImport) {
      try {
        await onBulkImport(data as Partial<Advisor>[]);
      } catch (error: any) {
        toast.error(`Ошибка импорта: ${error.message}`);
      }
    }
  };

  // Derive live advisor from array; merge with local form edits
  const selectedAdvisorLive = selectedAdvisorId ? (advisors.find(a => a.id === selectedAdvisorId) ?? null) : null;
  const selectedAdvisor = selectedAdvisorLive ? { ...selectedAdvisorLive, ...editFormData } as Advisor : null;

  const openAdvisorDialog = (advisor: Advisor) => {
    setSelectedAdvisorId(advisor.id);
    setEditFormData({
      display_name: advisor.display_name,
      elevenlabs_voice_id: advisor.elevenlabs_voice_id,
      speech_speed: advisor.speech_speed,
      scene_photo_id: advisor.scene_photo_id,
      thumbnail_photo_id: advisor.thumbnail_photo_id,
    });
  };

  const closeAdvisorDialog = () => {
    setSelectedAdvisorId(null);
    setEditFormData({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const getPrimaryPhoto = (advisor: Advisor) =>
    advisor.photos?.find(p => p.is_primary) || advisor.photos?.[0];

  const getScenePhoto = (advisor: Advisor) =>
    advisor.photos?.find(p => p.id === advisor.scene_photo_id) || getPrimaryPhoto(advisor);

  const getThumbnailPhoto = (advisor: Advisor) =>
    advisor.photos?.find(p => p.id === advisor.thumbnail_photo_id) || getPrimaryPhoto(advisor);

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />


      {/* Cards grid — portrait style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {advisors.map((advisor) => {
          const photo = getScenePhoto(advisor);
          return (
            <div
              key={advisor.id}
              className="cursor-pointer rounded-xl border bg-card overflow-hidden hover:border-primary/50 transition-colors group"
              onClick={() => openAdvisorDialog(advisor)}
            >
              {/* Name above the card */}
              <div className="px-3 py-2 text-sm font-medium truncate text-center">
                {advisor.display_name || advisor.name}
              </div>
              {/* Portrait image */}
              <div className="relative aspect-[9/16] bg-muted">
                {photo ? (
                  <img
                    src={photo.photo_url}
                    alt={advisor.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-10 h-10 text-muted-foreground" />
                  </div>
                )}
                {/* Name overlay at bottom */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent pt-8 pb-2 px-3">
                  <span className="text-white text-xs font-medium">
                    {advisor.name}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail dialog — left fields, right photos */}
      <Dialog open={!!selectedAdvisorId} onOpenChange={(open) => !open && closeAdvisorDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Редактирование духовника</DialogTitle>
          </DialogHeader>

          {selectedAdvisor && (
            <div className="space-y-4">
              {/* Top: fields in a row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Имя</Label>
                  <Input
                    value={selectedAdvisor.display_name || selectedAdvisor.name}
                    onChange={(e) => setEditFormData({ ...editFormData, display_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Eleven Labs Voice ID</Label>
                  <Input
                    value={selectedAdvisor.elevenlabs_voice_id || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, elevenlabs_voice_id: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Скорость речи</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="2"
                    value={selectedAdvisor.speech_speed ?? 1}
                    onChange={(e) => setEditFormData({ ...editFormData, speech_speed: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              {/* Photos row: scene + thumbnail + gallery */}
              <div className="flex gap-4">
                {/* Scene photo */}
                <div className="space-y-1">
                  <div className="text-sm font-medium text-center">Основное фото</div>
                  <div className="relative w-48 aspect-[9/16] bg-muted rounded-xl overflow-hidden border-2 border-border">
                    {getScenePhoto(selectedAdvisor) ? (
                      <img src={getScenePhoto(selectedAdvisor)!.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Thumbnail photo */}
                <div className="space-y-1">
                  <div className="text-sm font-medium text-center">Миниатюра</div>
                  <div className="relative w-48 aspect-[9/16] bg-muted rounded-xl overflow-hidden border-2 border-border">
                    {getThumbnailPhoto(selectedAdvisorLive!) ? (
                      <>
                        <img src={getThumbnailPhoto(selectedAdvisorLive!)!.photo_url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent pt-6 pb-2 px-2">
                          <span className="text-white text-xs font-medium">
                            {selectedAdvisor.display_name || selectedAdvisor.name}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Gallery + role selectors */}
                <div className="flex-1 space-y-3">
                  <div className="text-sm font-medium">Все фотографии</div>
                  <div className="flex gap-2 flex-wrap">
                    {selectedAdvisor.photos?.map((photo) => {
                      const isScene = photo.id === selectedAdvisor.scene_photo_id;
                      const isThumbnail = photo.id === selectedAdvisor.thumbnail_photo_id;
                      return (
                        <div key={photo.id} className="relative group">
                          <button
                            onClick={() => onSetPrimaryPhoto(selectedAdvisor.id, photo.id)}
                            className={cn(
                              "w-12 h-12 rounded-full border-2 overflow-hidden transition-colors",
                              photo.is_primary ? "border-primary" : "border-border hover:border-primary/50"
                            )}
                          >
                            <img src={photo.photo_url} alt="" className="w-full h-full object-cover" />
                          </button>
                          <div className="flex gap-0.5 justify-center mt-1">
                            {isScene && <span className="text-[9px] bg-blue-500/20 text-blue-600 rounded px-1">С</span>}
                            {isThumbnail && <span className="text-[9px] bg-purple-500/20 text-purple-600 rounded px-1">М</span>}
                          </div>
                          <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeletePhoto(photo.id); }}
                              className="w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                              title="Удалить"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => triggerFileInput(selectedAdvisor.id)}
                      className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50"
                    >
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                  {selectedAdvisor.photos && selectedAdvisor.photos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Основное фото</Label>
                        <select
                          className="w-full text-xs border rounded px-2 py-1 bg-background"
                          value={selectedAdvisor.scene_photo_id || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, scene_photo_id: e.target.value || null })}
                        >
                          <option value="">По умолчанию</option>
                          {selectedAdvisor.photos.map((p, i) => (
                            <option key={p.id} value={p.id}>Фото {i + 1}{p.is_primary ? ' (осн.)' : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Миниатюра</Label>
                        <select
                          className="w-full text-xs border rounded px-2 py-1 bg-background"
                          value={selectedAdvisor.thumbnail_photo_id || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, thumbnail_photo_id: e.target.value || null })}
                        >
                          <option value="">По умолчанию</option>
                          {selectedAdvisor.photos.map((p, i) => (
                            <option key={p.id} value={p.id}>Фото {i + 1}{p.is_primary ? ' (осн.)' : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => closeAdvisorDialog()}>
              Отмена
            </Button>
            <Button
              onClick={async () => {
                if (selectedAdvisor) {
                  await onUpdateAdvisor(selectedAdvisor.id, {
                    name: selectedAdvisor.name,
                    display_name: selectedAdvisor.display_name,
                    speech_speed: selectedAdvisor.speech_speed,
                    elevenlabs_voice_id: selectedAdvisor.elevenlabs_voice_id,
                    is_active: selectedAdvisor.is_active,
                    scene_photo_id: selectedAdvisor.scene_photo_id,
                    thumbnail_photo_id: selectedAdvisor.thumbnail_photo_id,
                  } as any);
                  closeAdvisorDialog();
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
        fieldDefinitions={ADVISOR_FIELD_DEFINITIONS}
      />
    </div>
  );
}
