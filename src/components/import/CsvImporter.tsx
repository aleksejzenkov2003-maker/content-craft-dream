import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';
import { parseCSV, readFileAsText, ParsedRow, ParseResult, ColumnMappingInfo, normalizeHeader, parseCSVLine, detectDelimiter } from './csvUtils';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { FieldDefinition } from './importConfigs';
import { FieldStructureInfo } from './FieldStructureInfo';
import { ColumnMappingEditor } from './ColumnMappingEditor';

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
  fieldDefinitions?: FieldDefinition[];
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
  fieldDefinitions,
}: CsvImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [resolvedRows, setResolvedRows] = useState<ParsedRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [customMapping, setCustomMapping] = useState<ColumnMappingInfo[] | null>(null);
  const [rawFileContent, setRawFileContent] = useState<string>('');

  const resetState = () => {
    setFile(null);
    setParseResult(null);
    setResolvedRows([]);
    setIsLoading(false);
    setIsImporting(false);
    setCustomMapping(null);
    setRawFileContent('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const resolveRows = (rows: ParsedRow[]) => {
    if (resolveRow && lookups) {
      return rows.map(row => {
        const { data, errors } = resolveRow(row.data, lookups);
        return {
          ...row,
          data,
          errors: [...row.errors, ...errors],
          isValid: row.errors.length === 0 && errors.length === 0,
        };
      });
    }
    return rows;
  };

  const processFile = async (selectedFile: File) => {
    setIsLoading(true);
    setFile(selectedFile);

    try {
      let content: string;

      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        content = XLSX.utils.sheet_to_csv(firstSheet, { FS: ',' });
      } else {
        content = await readFileAsText(selectedFile);
      }

      setRawFileContent(content);
      const result = parseCSV(content, columnMapping, requiredFields);
      setParseResult(result);
      setCustomMapping(result.mappedColumns);
      setResolvedRows(resolveRows(result.rows));
    } catch (error) {
      console.error('Error parsing file:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMappingChange = (columnIndex: number, newField: string | null) => {
    if (!customMapping) return;
    const updated = customMapping.map(col =>
      col.columnIndex === columnIndex ? { ...col, mappedField: newField } : col
    );
    setCustomMapping(updated);
  };

  const handleApplyMapping = () => {
    if (!rawFileContent || !customMapping) return;

    // Rebuild column mapping from customMapping
    const newMapping: Record<string, string> = {};
    customMapping.forEach(col => {
      if (col.mappedField && col.csvHeader) {
        newMapping[col.csvHeader.toLowerCase()] = col.mappedField;
      }
    });

    const result = parseCSV(rawFileContent, newMapping, requiredFields);
    // Preserve custom mapping selections
    const updatedMapped = result.mappedColumns.map(col => {
      const custom = customMapping.find(c => c.columnIndex === col.columnIndex);
      return custom ? { ...col, mappedField: custom.mappedField } : col;
    });
    
    // Re-parse rows with custom mapping
    const delimiter = detectDelimiter(rawFileContent);
    const lines = rawFileContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
    
    if (lines.length <= 1) return;
    
    const headerToField: Record<number, string> = {};
    customMapping.forEach(col => {
      if (col.mappedField) {
        headerToField[col.columnIndex] = col.mappedField;
      }
    });

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter);
      const data: Record<string, string> = {};
      const errors: string[] = [];
      
      values.forEach((value, index) => {
        const fieldName = headerToField[index];
        if (fieldName) data[fieldName] = value;
      });

      if (requiredFields) {
        for (const field of requiredFields) {
          if (!data[field] || !data[field].trim()) {
            errors.push(`Отсутствует обязательное поле: ${field}`);
          }
        }
      }

      rows.push({ rowIndex: i, data, errors, isValid: errors.length === 0 });
    }

    setParseResult({ ...result, mappedColumns: updatedMapped });
    setResolvedRows(resolveRows(rows));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
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
    if (selectedFile) processFile(selectedFile);
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
            <div>
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
                <p className="text-sm text-muted-foreground mb-4">или нажмите для выбора файла</p>
                <p className="text-xs text-muted-foreground mb-4">Поддерживаемые форматы: CSV, XLS, XLSX</p>
                <input type="file" accept=".csv,.xls,.xlsx" onChange={handleFileSelect} className="hidden" id="csv-file-input" />
                <label htmlFor="csv-file-input">
                  <Button variant="outline" asChild><span>Выбрать файл</span></Button>
                </label>
              </div>
              {fieldDefinitions && fieldDefinitions.length > 0 && (
                <FieldStructureInfo fieldDefinitions={fieldDefinitions} />
              )}
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Обработка файла...</p>
            </div>
          ) : (
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
                  <Button variant="ghost" size="sm" onClick={resetState}>
                    <X className="w-4 h-4 mr-1" />
                    Другой файл
                  </Button>
                </div>
              </div>

              {/* Column mapping editor or fallback */}
              {fieldDefinitions && fieldDefinitions.length > 0 && customMapping ? (
                <ColumnMappingEditor
                  mappedColumns={customMapping}
                  fieldDefinitions={fieldDefinitions}
                  onMappingChange={handleMappingChange}
                  onApplyMapping={handleApplyMapping}
                />
              ) : parseResult && (
                <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>Разделитель:</span>
                    <Badge variant="outline">
                      {parseResult.detectedDelimiter === ',' ? 'запятая' : 
                       parseResult.detectedDelimiter === ';' ? 'точка с запятой' : 
                       parseResult.detectedDelimiter === '\t' ? 'табуляция' : parseResult.detectedDelimiter}
                    </Badge>
                    <span className="ml-4">Распознанные колонки:</span>
                    <Badge variant="secondary">
                      {parseResult.mappedColumns.filter(c => c.mappedField).length} из {parseResult.mappedColumns.length}
                    </Badge>
                  </div>
                  
                  {parseResult.unmappedColumns.length > 0 && (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-amber-600">Нераспознанные колонки: </span>
                        <span className="text-muted-foreground">
                          {parseResult.unmappedColumns.slice(0, 5).join(', ')}
                          {parseResult.unmappedColumns.length > 5 && ` и ещё ${parseResult.unmappedColumns.length - 5}`}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <details className="cursor-pointer">
                    <summary className="text-muted-foreground hover:text-foreground">
                      Показать все колонки файла
                    </summary>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                      {parseResult.mappedColumns.map((col, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-muted-foreground">{col.csvHeader || `[пусто]`}</span>
                          <span>→</span>
                          {col.mappedField ? (
                            <Badge variant="default" className="text-xs">{col.mappedField}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">не распознано</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              <ScrollArea className="h-[400px] border rounded-lg">
                <div className="min-w-max">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-10 text-center">#</TableHead>
                        {previewColumns.map((col) => (
                          <TableHead key={col.key} className="whitespace-nowrap px-3">{col.label}</TableHead>
                        ))}
                        <TableHead className="w-28 text-center">Статус</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resolvedRows.map((row, index) => (
                        <TableRow key={index} className={cn(!row.isValid && "bg-destructive/5")}>
                          <TableCell className="font-mono text-xs text-muted-foreground text-center w-10">{row.rowIndex}</TableCell>
                          {previewColumns.map((col) => {
                            const value = row.data[col.key];
                            const displayValue = col.render ? col.render(value, row.data) : value || '—';
                            const stringValue = String(value || '');
                            const isTruncated = stringValue.length > 30;
                            return (
                              <TableCell key={col.key} className="px-3 max-w-[200px]" title={isTruncated ? stringValue : undefined}>
                                <span className="block truncate">{displayValue}</span>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center w-28">
                            {row.isValid ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />OK
                              </Badge>
                            ) : (
                              <div className="space-y-1">
                                {row.errors.map((error, i) => (
                                  <Badge key={i} variant="destructive" className="text-xs block">{error}</Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Отмена</Button>
          <Button onClick={handleImport} disabled={!file || isImporting || validCount === 0}>
            {isImporting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Импорт...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" />Импортировать {validCount} записей</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
