import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Calendar } from 'lucide-react';
import { Channel } from '@/types/content';

interface ParseOptionsDialogProps {
  channel: Channel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onParse: (channelId: string, daysBack: number) => Promise<void>;
  isLoading?: boolean;
}

const DAYS_OPTIONS = [
  { value: '7', label: '7 дней' },
  { value: '14', label: '14 дней' },
  { value: '30', label: '30 дней' },
  { value: '60', label: '60 дней' },
  { value: '90', label: '3 месяца' },
  { value: '180', label: '6 месяцев' },
  { value: '365', label: '1 год' },
];

export function ParseOptionsDialog({
  channel,
  open,
  onOpenChange,
  onParse,
  isLoading = false,
}: ParseOptionsDialogProps) {
  const [daysBack, setDaysBack] = useState('30');

  const handleParse = async () => {
    if (!channel) return;
    await onParse(channel.id, parseInt(daysBack));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Настройки парсинга</DialogTitle>
          <DialogDescription>
            {channel?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="daysBack" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Глубина парсинга
            </Label>
            <Select value={daysBack} onValueChange={setDaysBack}>
              <SelectTrigger id="daysBack">
                <SelectValue placeholder="Выберите период" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Будут загружены посты за последние {daysBack} дней
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleParse} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Парсинг...
              </>
            ) : (
              'Запустить парсинг'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
