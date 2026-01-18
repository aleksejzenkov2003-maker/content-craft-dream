import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Advisor } from '@/hooks/useAdvisors';
import { Playlist } from '@/hooks/usePlaylists';
import { Video } from '@/hooks/useVideos';

interface VideoImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (videos: Partial<Video>[]) => Promise<void>;
  advisors: Advisor[];
  playlists: Playlist[];
}

interface ParsedRow {
  video_number?: number;
  question_id?: number;
  advisor_name?: string;
  advisor_id?: string;
  playlist_name?: string;
  playlist_id?: string;
  safety_score?: string;
  hook?: string;
  question?: string;
  answer_prompt?: string;
  advisor_answer?: string;
  answer_status?: string;
  video_title?: string;
  cover_prompt?: string;
  main_photo_url?: string;
  cover_url?: string;
  video_path?: string;
  generation_status?: string;
  valid?: boolean;
  errors?: string[];
}

const COLUMN_MAPPING: Record<string, keyof ParsedRow> = {
  'video_number': 'video_number',
  'номер': 'video_number',
  'question_id': 'question_id',
  'advisor': 'advisor_name',
  'advisor_id': 'advisor_name',
  'духовник': 'advisor_name',
  'playlist': 'playlist_name',
  'playlist_id': 'playlist_name',
  'плейлист': 'playlist_name',
  'safety_score': 'safety_score',
  'hook': 'hook',
  'хук': 'hook',
  'question': 'question',
  'вопрос': 'question',
  'answer_prompt': 'answer_prompt',
  'advisor_answer': 'advisor_answer',
  'ответ': 'advisor_answer',
  'answer_status': 'answer_status',
  'video_title': 'video_title',
  'заголовок': 'video_title',
  'cover_prompt': 'cover_prompt',
  'main_photo_url': 'main_photo_url',
  'cover_url': 'cover_url',
  'video_path': 'video_path',
  'generation_status': 'generation_status',
  'статус': 'generation_status',
};

export function VideoImportDialog({
  open,
  onClose,
  onImport,
  advisors,
  playlists,
}: VideoImportDialogProps) {
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findAdvisorId = useCallback((name: string | undefined) => {
    if (!name) return undefined;
    const nameLower = name.toLowerCase().trim();
    const advisor = advisors.find(
      a => a.name.toLowerCase() === nameLower || 
           (a.display_name && a.display_name.toLowerCase() === nameLower)
    );
    return advisor?.id;
  }, [advisors]);

  const findPlaylistId = useCallback((name: string | undefined) => {
    if (!name) return undefined;
    const nameLower = name.toLowerCase().trim();
    const playlist = playlists.find(p => p.name.toLowerCase() === nameLower);
    return playlist?.id;
  }, [playlists]);

  const parseFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          setError('Файл пуст или не содержит данных');
          return;
        }

        // Get headers and map them
        const headers = (jsonData[0] as string[]).map(h => {
          const key = String(h || '').toLowerCase().trim();
          return COLUMN_MAPPING[key] || key;
        });

        // Parse rows
        const rows: ParsedRow[] = jsonData.slice(1).map((row) => {
          const parsed: ParsedRow = { errors: [] };
          
          headers.forEach((header, idx) => {
            const value = row[idx];
            if (value !== undefined && value !== null && value !== '') {
              (parsed as any)[header] = value;
            }
          });

          // Map advisor name to ID
          if (parsed.advisor_name) {
            parsed.advisor_id = findAdvisorId(parsed.advisor_name);
            if (!parsed.advisor_id) {
              parsed.errors?.push(`Духовник "${parsed.advisor_name}" не найден`);
            }
          }

          // Map playlist name to ID
          if (parsed.playlist_name) {
            parsed.playlist_id = findPlaylistId(parsed.playlist_name);
            if (!parsed.playlist_id) {
              parsed.errors?.push(`Плейлист "${parsed.playlist_name}" не найден`);
            }
          }

          parsed.valid = parsed.errors?.length === 0;
          return parsed;
        }).filter(row => 
          row.video_number || row.question || row.hook || row.video_title
        );

        setParsedData(rows);
      } catch (err) {
        console.error('Parse error:', err);
        setError('Ошибка при чтении файла. Убедитесь, что это корректный CSV или Excel файл.');
      }
    };

    reader.onerror = () => {
      setError('Ошибка при чтении файла');
    };

    reader.readAsBinaryString(file);
  }, [findAdvisorId, findPlaylistId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      parseFile(file);
    }
  }, [parseFile]);

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const videosToImport: Partial<Video>[] = parsedData
        .filter(row => row.valid !== false)
        .map(row => ({
          video_number: row.video_number ? Number(row.video_number) : null,
          question_id: row.question_id ? Number(row.question_id) : null,
          advisor_id: row.advisor_id || null,
          playlist_id: row.playlist_id || null,
          safety_score: row.safety_score || null,
          hook: row.hook || null,
          question: row.question || null,
          answer_prompt: row.answer_prompt || null,
          advisor_answer: row.advisor_answer || null,
          answer_status: row.answer_status || 'pending',
          video_title: row.video_title || null,
          cover_prompt: row.cover_prompt || null,
          main_photo_url: row.main_photo_url || null,
          cover_url: row.cover_url || null,
          video_path: row.video_path || null,
          generation_status: row.generation_status || 'pending',
        }));

      await onImport(videosToImport);
      handleClose();
    } catch (err) {
      console.error('Import error:', err);
      setError('Ошибка при импорте данных');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setParsedData([]);
    setFileName('');
    setError(null);
    onClose();
  };

  const validCount = parsedData.filter(r => r.valid !== false).length;
  const invalidCount = parsedData.filter(r => r.valid === false).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Импорт роликов из CSV/Excel
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Upload area */}
          {parsedData.length === 0 && (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Перетащите файл сюда</p>
              <p className="text-sm text-muted-foreground mt-1">
                или нажмите для выбора
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                Поддерживаются форматы: CSV, XLS, XLSX
              </p>
              <Input
                id="file-input"
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Preview table */}
          {parsedData.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">{fileName}</span>
                  <Badge variant="outline">{parsedData.length} строк</Badge>
                  {validCount > 0 && (
                    <Badge variant="default" className="bg-success">
                      <Check className="w-3 h-3 mr-1" />
                      {validCount} готово к импорту
                    </Badge>
                  )}
                  {invalidCount > 0 && (
                    <Badge variant="destructive">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {invalidCount} с ошибками
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setParsedData([]); setFileName(''); }}
                >
                  Выбрать другой файл
                </Button>
              </div>

              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">№</TableHead>
                      <TableHead>Заголовок / Хук</TableHead>
                      <TableHead>Вопрос</TableHead>
                      <TableHead>Духовник</TableHead>
                      <TableHead>Плейлист</TableHead>
                      <TableHead>Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, idx) => (
                      <TableRow 
                        key={idx}
                        className={row.valid === false ? 'bg-destructive/5' : ''}
                      >
                        <TableCell className="font-mono text-sm">
                          {row.video_number || idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium line-clamp-1">
                              {row.video_title || '—'}
                            </div>
                            {row.hook && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {row.hook}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="line-clamp-2 text-sm">
                            {row.question || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {row.advisor_id ? (
                            <Badge variant="outline" className="bg-success/10">
                              {row.advisor_name}
                            </Badge>
                          ) : row.advisor_name ? (
                            <Badge variant="destructive" className="text-xs">
                              {row.advisor_name} ❌
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.playlist_id ? (
                            <Badge variant="secondary" className="bg-success/10">
                              {row.playlist_name}
                            </Badge>
                          ) : row.playlist_name ? (
                            <Badge variant="destructive" className="text-xs">
                              {row.playlist_name} ❌
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.valid === false ? (
                            <Badge variant="destructive" className="text-xs">
                              Ошибка
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              {row.generation_status || 'pending'}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Отмена
          </Button>
          <Button
            onClick={handleImport}
            disabled={validCount === 0 || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Импорт...
              </>
            ) : (
              <>
                Импортировать {validCount} роликов
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
