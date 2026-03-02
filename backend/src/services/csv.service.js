import { parse } from 'csv-parse/sync';

const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;
const MAX_ROWS = 100;

function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const cleaned = phone.replace(/\s|-|\./g, '').trim();
  if (cleaned.startsWith('0')) return null;
  const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  return PHONE_REGEX.test(withPlus) ? withPlus : null;
}

export function parseCSV(buffer, options = {}) {
  const rows = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    ...options,
  });
  return rows;
}

export function validateAndNormalizeRows(rows, requiredPhoneColumn = 'telefono') {
  const errors = [];
  const valid = [];
  const columns = rows[0] ? Object.keys(rows[0]) : [];

  if (!columns.map(c => c.toLowerCase()).includes(requiredPhoneColumn.toLowerCase())) {
    const phoneCol = columns.find(c => /phone|tel|numero|number/i.test(c)) || columns[0];
    if (!phoneCol) {
      return { valid: [], errors: [{ row: 0, message: 'No se encontró columna de teléfono (telefono, phone, etc.)' }] };
    }
  }

  const phoneCol = columns.find(c => c.toLowerCase() === requiredPhoneColumn.toLowerCase())
    || columns.find(c => /phone|tel|numero|number/i.test(c))
    || columns[0];

  if (rows.length > MAX_ROWS) {
    errors.push({ row: 0, message: `Máximo ${MAX_ROWS} filas permitidas. Tienes ${rows.length}.` });
    return { valid: [], errors };
  }

  // Detectar columna de tags (nombre exacto "tags" o "etiquetas")
  const tagsCol = columns.find(c => /^tags$|^etiquetas$/i.test(c.trim()));

  rows.forEach((row, i) => {
    const rawPhone = row[phoneCol] ?? row[Object.keys(row)[0]];
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      errors.push({ row: i + 1, value: rawPhone, message: 'Teléfono inválido o vacío' });
      return;
    }
    const variables = { ...row };
    delete variables[phoneCol];

    // Extraer tags de la columna dedicada (coma como separador)
    let tags = [];
    if (tagsCol && variables[tagsCol] != null) {
      tags = String(variables[tagsCol])
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);
      delete variables[tagsCol];
    }

    valid.push({ phone, variables, tags });
  });

  return { valid, errors };
}

export function processCSVBuffer(buffer) {
  const rows = parseCSV(buffer);
  return validateAndNormalizeRows(rows);
}
