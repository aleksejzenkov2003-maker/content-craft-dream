import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';
import { parseCSV, readFileAsText, ParsedRow, ParseResult } from './csvUtils';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

export interface PreviewColumn {
  key: string;
  label: string;
  render?: (value: any, row: Record<string, any>) => React.ReactNode;
}

export interface Lookups {
  advisors?: { id: string; name: string; display_name?: string | null }[];
  playlists?: { id: string; name: string }[];
  channels?: { id: string; name: string }[];
  videos?: { id: string; video_number: number | null }[];
}

export interface CsvImporterProps {
  open: boolean;
  onClose: () => void;
  title: string;
  columnMapping: Record<string, string>;
  previewColumns: PreviewColumn[];
  onImport: (data: Record<string, any>[]) => Promise<void>;
  requiredFields?: string[];
  lookups?: Lookups;
  resolveRow?: (row: Record<string, any>, lookups: Lookups) => { data: Record<string, any>; errors: string[] };
}

export function CsvImporter({
  open,
  onClose,
  title,
  columnMapping,
  previewColumns,
  onImport,
  requiredFields,
  lookups,
  resolveRow,
}: CsvImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [resolvedRows, setResolvedRows] = useState<ParsedRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const resetState = () => {
    setFile(null);
    setParseResult(null);
    setResolvedRows([]);
    setIsLoading(false);
    setIsImporting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFile = async (selectedFile: File) => {
    setIsLoading(true);
    setFile(selectedFile);

    try {
      let content: string;

      // Handle Excel files
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        content = XLSX.utils.sheet_to_csv(firstSheet, { FS: ',' });
      } else {
        content = await readFileAsText(selectedFile);
      }

      const result = parseCSV(content, columnMapping, requiredFields);
      setParseResult(result);

      // Resolve lookups if provided
      if (resolveRow && lookups) {
        const resolved = result.rows.map(row => {
          const { data, errors } = resolveRow(row.data, lookups);
          return {
            ...row,
            data,
            errors: [...row.errors, ...errors],
            isValid: row.errors.length === 0 && errors.length === 0,
          };
        });
        setResolvedRows(resolved);
      } else {
        setResolvedRows(result.rows);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, [columnMapping, requiredFields, lookups, resolveRow]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleImport = async () => {
    const validRows = resolvedRows.filter(r => r.isValid);
    if (validRows.length === 0) return;

    setIsImporting(true);
    try {
      await onImport(validRows.map(r => r.data));
      handleClose();
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = resolvedRows.filter(r => r.isValid).length;
  const errorCount = resolvedRows.filter(r => !r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {!file ? (
            // Upload zone
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
                dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Перетащите файл сюда</p>
              <p className="text-sm text-muted-foreground mb-4">
                или нажмите для выбора файла
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Поддерживаемые форматы: CSV, XLS, XLSX
              </p>
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-file-input"
              />
              <label htmlFor="csv-file-input">
                <Button variant="outline" asChild>
                  <span>Выбрать файл</span>
                </Button>
              </label>
            </div>
          ) : isLoading ? (
            // Loading state
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Обработка файла...</p>
            </div>
          ) : (
            // Preview
            <div className="space-y-4">
              {/* File info */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <span className="font-medium">{file.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{resolvedRows.length} строк</Badge>
                  {validCount > 0 && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {validCount} готово
                    </Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge variant="destructive">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {errorCount} ошибок
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetState}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Другой файл
                  </Button>
                </div>
              </div>

              {/* Preview table */}
              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">#</TableHead>
                      {previewColumns.map(col => (
                        <TableHead key={col.key}>{col.label}</TableHead>
                      ))}
                      <TableHead className="w-40">Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resolvedRows.map((row, index) => (
                      <TableRow
                        key={index}
                        className={cn(
                          !row.isValid && "bg-destructive/5"
                        )}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {row.rowIndex}
                        </TableCell>
                        {previewColumns.map(col => (
                          <TableCell key={col.key} className="max-w-[200px] truncate">
                            {col.render
                              ? col.render(row.data[col.key], row.data)
                              : row.data[col.key] || '—'}
                          </TableCell>
                        ))}
                        <TableCell>
                          {row.isValid ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <div className="space-y-1">
                              {row.errors.map((error, i) => (
                                <Badge key={i} variant="destructive" className="text-xs block">
                                  {error}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Отмена
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || isImporting || validCount === 0}
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Импорт...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Импортировать {validCount} записей
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
