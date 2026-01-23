import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Search, Image, Trash2, User } from 'lucide-react';
import { useAdvisors, Advisor } from '@/hooks/useAdvisors';
import { toast } from 'sonner';
import { ImageInput } from '@/components/ui/image-input';

export function BackCoversGrid() {
  const { advisors, loading, updateAdvisor } = useAdvisors();
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAdvisor, setEditingAdvisor] = useState<Advisor | null>(null);
  const [backCoverUrl, setBackCoverUrl] = useState('');

  const advisorsWithBackCovers = advisors.filter(
    (a) =>
      a.back_cover_template_url &&
      (search === '' ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.display_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const advisorsWithoutBackCovers = advisors.filter(
    (a) =>
      !a.back_cover_template_url &&
      (search === '' ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.display_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSaveBackCover = async () => {
    if (!editingAdvisor || !backCoverUrl) return;

    try {
      await updateAdvisor(editingAdvisor.id, {
        back_cover_template_url: backCoverUrl,
      });
      toast.success('Задняя обложка сохранена');
      setShowAddDialog(false);
      setEditingAdvisor(null);
      setBackCoverUrl('');
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleRemoveBackCover = async (advisor: Advisor) => {
    try {
      await updateAdvisor(advisor.id, {
        back_cover_template_url: null,
      });
      toast.success('Задняя обложка удалена');
    } catch (error) {
      toast.error('Ошибка удаления');
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
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по духовникам..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {advisorsWithBackCovers.length} из {advisors.length} с обложками
        </div>
      </div>

      {/* Advisors with back covers */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Задние обложки</h3>
        {advisorsWithBackCovers.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Image className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Нет добавленных задних обложек</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {advisorsWithBackCovers.map((advisor) => (
              <Card key={advisor.id} className="glass-card group overflow-hidden">
                <div className="aspect-[9/16] relative bg-muted">
                  <img
                    src={advisor.back_cover_template_url!}
                    alt={`Back cover for ${advisor.display_name || advisor.name}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveBackCover(advisor)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium truncate">
                      {advisor.display_name || advisor.name}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Advisors without back covers */}
      {advisorsWithoutBackCovers.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-muted-foreground">
            Без задних обложек ({advisorsWithoutBackCovers.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {advisorsWithoutBackCovers.map((advisor) => (
              <Card
                key={advisor.id}
                className="glass-card cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => {
                  setEditingAdvisor(advisor);
                  setBackCoverUrl('');
                  setShowAddDialog(true);
                }}
              >
                <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Plus className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <span className="font-medium">
                    {advisor.display_name || advisor.name}
                  </span>
                  <Badge variant="secondary">Добавить обложку</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Задняя обложка для {editingAdvisor?.display_name || editingAdvisor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Задняя обложка</Label>
            <ImageInput
              value={backCoverUrl}
              onChange={setBackCoverUrl}
              folder="back-covers"
              aspectRatio="9:16"
              generatePromptPrefix={`Back cover template for spiritual advisor "${editingAdvisor?.display_name || editingAdvisor?.name}". Elegant, vertical format with space for text.`}
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Отмена
              </Button>
              <Button onClick={handleSaveBackCover} disabled={!backCoverUrl}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
