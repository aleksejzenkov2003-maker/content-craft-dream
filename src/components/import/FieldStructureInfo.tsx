import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FieldDefinition } from './importConfigs';
import { Info } from 'lucide-react';

interface FieldStructureInfoProps {
  fieldDefinitions: FieldDefinition[];
}

export function FieldStructureInfo({ fieldDefinitions }: FieldStructureInfoProps) {
  if (!fieldDefinitions.length) return null;

  return (
    <div className="mt-6 border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 text-sm font-medium text-muted-foreground">
        <Info className="w-4 h-4" />
        Ожидаемые поля
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="text-xs py-2">Поле</TableHead>
            <TableHead className="text-xs py-2">Допустимые заголовки CSV</TableHead>
            <TableHead className="text-xs py-2 w-24 text-center">Обяз.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fieldDefinitions.map((fd) => (
            <TableRow key={fd.field}>
              <TableCell className="py-1.5 text-sm font-medium">{fd.label}</TableCell>
              <TableCell className="py-1.5">
                <div className="flex flex-wrap gap-1">
                  {fd.aliases.slice(0, 4).map((a, i) => (
                    <Badge key={i} variant="outline" className="text-xs font-normal">
                      {a}
                    </Badge>
                  ))}
                  {fd.aliases.length > 4 && (
                    <span className="text-xs text-muted-foreground">+{fd.aliases.length - 4}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-1.5 text-center">
                {fd.required && (
                  <Badge variant="destructive" className="text-xs">да</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
