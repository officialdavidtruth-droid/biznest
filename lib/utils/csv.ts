/**
 * Small dependency-free CSV helpers. Good enough for the product
 * import/export use case (quoted fields, embedded commas/newlines/quotes)
 * without pulling in a parsing library for one feature.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Normalize line endings up front so \r\n inside/outside quotes behaves consistently.
  const input = text.replace(/\r\n/g, "\n");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  // Flush the last field/row (files don't always end with a trailing newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

// Spreadsheet apps treat a cell starting with one of these as a formula.
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Text cells that could be read as a formula get a leading apostrophe so Excel
 * and Sheets show them as text (CSV injection). Numbers are left alone so
 * negative values stay numeric. Reverse with unescapeFormulaCell on import.
 */
export function escapeFormulaCell(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

export function unescapeFormulaCell(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

function escapeCsvField(value: string | number | boolean | null | undefined): string {
  let str = value == null ? "" : typeof value === "string" ? escapeFormulaCell(value) : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  return lines.join("\n");
}

/** Parses CSV text into an array of header-keyed row objects. */
export function csvToRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = (row[i] ?? "").trim();
    });
    return record;
  });
}
