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
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

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

  return (
    <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-muted-foreground">Маппинг колонок</span>
        <Button variant="outline" size="sm" onClick={onApplyMapping}>
          <RefreshCw className="w-3 h-3 mr-1" />
          Пересчитать
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {mappedColumns.map((col) => (
          <div key={col.columnIndex} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground truncate min-w-[100px] max-w-[140px]" title={col.csvHeader}>
              {col.csvHeader || '[пусто]'}
            </span>
            <span className="text-muted-foreground">→</span>
            <Select
              value={col.mappedField || '__none__'}
              onValueChange={(val) => onMappingChange(col.columnIndex, val === '__none__' ? null : val)}
            >
              <SelectTrigger className={`h-7 text-xs ${col.mappedField ? 'border-green-500/50 bg-green-500/5' : ''}`}>
                <SelectValue placeholder="—" />
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="text-xs">
          {mappedColumns.filter(c => c.mappedField).length} из {mappedColumns.length} распознано
        </Badge>
      </div>
    </div>
  );
}
