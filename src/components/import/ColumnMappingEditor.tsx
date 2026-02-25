import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FieldDefinition } from './importConfigs';
import { ColumnMappingInfo } from './csvUtils';
import { RefreshCw, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

interface ColumnMappingEditorProps {
  mappedColumns: ColumnMappingInfo[];
  fieldDefinitions: FieldDefinition[];
  onMappingChange: (columnIndex: number, newField: string | null) => void;
  onApplyMapping: () => void;
}

export function ColumnMappingEditor({
  mappedColumns,
  fieldDefinitions,
  onMappingChange,
  onApplyMapping,
}: ColumnMappingEditorProps) {
  const usedFields = new Set(
    mappedColumns.filter(c => c.mappedField).map(c => c.mappedField!)
  );

  const mappedCount = mappedColumns.filter(c => c.mappedField).length;

  return (
    <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium text-muted-foreground">Маппинг колонок</span>
          <Badge variant="secondary" className="text-xs">
            {mappedCount} из {mappedColumns.length} распознано
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={onApplyMapping}>
          <RefreshCw className="w-3 h-3 mr-1" />
          Пересчитать
        </Button>
      </div>
      
      {/* Header row */}
      <div className="grid grid-cols-[1fr_24px_1fr_20px] gap-2 px-1 text-xs font-medium text-muted-foreground">
        <span>Колонка файла</span>
        <span></span>
        <span>Поле базы данных</span>
        <span></span>
      </div>
      
      <div className="grid grid-cols-1 gap-1.5">
        {mappedColumns.map((col) => (
          <div key={col.columnIndex} className="grid grid-cols-[1fr_24px_1fr_20px] gap-2 items-center">
            <div className="flex items-center">
              <Badge variant="outline" className="text-xs font-normal truncate max-w-full">
                {col.csvHeader || '[пусто]'}
              </Badge>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mx-auto" />
            <Select
              value={col.mappedField || '__none__'}
              onValueChange={(val) => onMappingChange(col.columnIndex, val === '__none__' ? null : val)}
            >
              <SelectTrigger className={`h-7 text-xs ${col.mappedField ? 'border-green-500/50 bg-green-500/5' : ''}`}>
                <SelectValue placeholder="— не выбрано —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— не выбрано —</SelectItem>
                {fieldDefinitions.map((fd) => (
                  <SelectItem
                    key={fd.field}
                    value={fd.field}
                    disabled={usedFields.has(fd.field) && col.mappedField !== fd.field}
                  >
                    {fd.label}
                    {fd.required && <span className="text-destructive ml-1">*</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {col.mappedField ? (
              <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}