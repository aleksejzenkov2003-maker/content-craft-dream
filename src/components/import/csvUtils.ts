// CSV Parsing Utilities

export function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0] || '';
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
    .replace(/[^a-zA-Z0-9а-яё\s_-]/gi, '') // Keep letters, numbers, spaces, underscores, hyphens
    .replace(/\s+/g, ' '); // Normalize spaces
}

export interface ParsedRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  isValid: boolean;
}

export interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  errorRows: number;
}

export function parseCSV(
  content: string,
  columnMapping: Record<string, string>,
  requiredFields?: string[]
): ParseResult {
  const delimiter = detectDelimiter(content);
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0, validRows: 0, errorRows: 0 };
  }
  
  const headerLine = lines[0];
  const rawHeaders = parseCSVLine(headerLine, delimiter);
  const normalizedHeaders = rawHeaders.map(normalizeHeader);
  
  // Map headers to field names
  const headerToField: Record<number, string> = {};
  normalizedHeaders.forEach((normalizedHeader, index) => {
    for (const [csvHeader, fieldName] of Object.entries(columnMapping)) {
      if (normalizeHeader(csvHeader) === normalizedHeader) {
        headerToField[index] = fieldName;
        break;
      }
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
    rows,
    totalRows: rows.length,
    validRows,
    errorRows,
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
