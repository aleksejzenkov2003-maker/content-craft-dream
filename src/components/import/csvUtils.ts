// CSV Parsing Utilities

// Remove BOM and normalize line endings
function normalizeContent(content: string): string {
  // Remove UTF-8 BOM if present
  let normalized = content.replace(/^\uFEFF/, '');
  // Normalize line endings to \n
  normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized;
}

export function detectDelimiter(content: string): string {
  const normalized = normalizeContent(content);
  const firstLine = normalized.split('\n')[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  
  if (tabCount > semicolonCount && tabCount > commaCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

export function parseCSVLine(line: string, delimiter = ','): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/^[≡⊙⚙#⌘◉△▽□○●◆◇★☆♦♣♠♥a\s]+/gi, '') // Remove leading special chars and 'A' prefix
    .replace(/[^a-zA-Z0-9а-яёА-ЯЁ\s_()-]/gi, '') // Keep letters, numbers, spaces, underscores, hyphens, parens
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

export interface ParsedRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  isValid: boolean;
}

export interface ColumnMappingInfo {
  csvHeader: string;
  mappedField: string | null;
  columnIndex: number;
}

export interface ParseResult {
  headers: string[];
  mappedColumns: ColumnMappingInfo[];
  unmappedColumns: string[];
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  detectedDelimiter: string;
}

// Split CSV content into logical rows, respecting quoted multiline values
function splitCSVIntoRows(content: string): string[] {
  // First normalize the content (remove BOM, normalize line endings)
  const normalized = normalizeContent(content);
  
  const rows: string[] = [];
  let currentRow = '';
  let inQuotes = false;
  
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    
    if (char === '"') {
      // Handle escaped quotes ""
      if (inQuotes && i + 1 < normalized.length && normalized[i + 1] === '"') {
        currentRow += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        currentRow += char;
      }
    } else if (char === '\n' && !inQuotes) {
      // End of logical row (only if not inside quotes)
      if (currentRow.trim()) {
        rows.push(currentRow);
      }
      currentRow = '';
    } else {
      currentRow += char;
    }
  }
  
  // Don't forget the last row
  if (currentRow.trim()) {
    rows.push(currentRow);
  }
  
  return rows;
}

export function parseCSV(
  content: string,
  columnMapping: Record<string, string>,
  requiredFields?: string[]
): ParseResult {
  const delimiter = detectDelimiter(content);
  const lines = splitCSVIntoRows(content);
  
  if (lines.length === 0) {
    return { 
      headers: [], 
      mappedColumns: [],
      unmappedColumns: [],
      rows: [], 
      totalRows: 0, 
      validRows: 0, 
      errorRows: 0,
      detectedDelimiter: delimiter
    };
  }
  
  const headerLine = lines[0];
  const rawHeaders = parseCSVLine(headerLine, delimiter);
  const normalizedHeaders = rawHeaders.map(normalizeHeader);
  
  // Map headers to field names and track mapping info
  const headerToField: Record<number, string> = {};
  const mappedColumns: ColumnMappingInfo[] = [];
  const unmappedColumns: string[] = [];
  
  rawHeaders.forEach((rawHeader, index) => {
    const normalizedHeader = normalizedHeaders[index];
    let mappedField: string | null = null;
    
    for (const [csvHeader, fieldName] of Object.entries(columnMapping)) {
      if (normalizeHeader(csvHeader) === normalizedHeader) {
        headerToField[index] = fieldName;
        mappedField = fieldName;
        break;
      }
    }
    
    mappedColumns.push({
      csvHeader: rawHeader,
      mappedField,
      columnIndex: index
    });
    
    if (!mappedField && rawHeader.trim()) {
      unmappedColumns.push(rawHeader);
    }
  });
  
  const rows: ParsedRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = parseCSVLine(line, delimiter);
    const data: Record<string, string> = {};
    const errors: string[] = [];
    
    values.forEach((value, index) => {
      const fieldName = headerToField[index];
      if (fieldName) {
        data[fieldName] = value;
      }
    });
    
    // Check required fields
    if (requiredFields) {
      for (const field of requiredFields) {
        if (!data[field] || !data[field].trim()) {
          errors.push(`Отсутствует обязательное поле: ${field}`);
        }
      }
    }
    
    rows.push({
      rowIndex: i,
      data,
      errors,
      isValid: errors.length === 0,
    });
  }
  
  const validRows = rows.filter(r => r.isValid).length;
  const errorRows = rows.filter(r => !r.isValid).length;
  
  return {
    headers: Object.values(headerToField),
    mappedColumns,
    unmappedColumns,
    rows,
    totalRows: rows.length,
    validRows,
    errorRows,
    detectedDelimiter: delimiter
  };
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
