const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

export function resolveTemplate(body, variables = {}) {
  if (!body) return '';
  return body.replace(VARIABLE_REGEX, (_, key) => variables[key] ?? `{{${key}}}`);
}

export function resolveSpintax(text) {
  if (!text || !text.includes('{')) return text;
  let result = text;
  let prev;
  do {
    prev = result;
    result = result.replace(/\{([^{}]+)\}/g, (_, options) => {
      const parts = options.split('|');
      return parts[Math.floor(Math.random() * parts.length)];
    });
  } while (result !== prev);
  return result;
}

export function resolveMessage(body, variables = {}) {
  return resolveSpintax(resolveTemplate(body, variables));
}

function parseParts(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val || '[]'); } catch (_) { return []; }
  }
  return [];
}

function pickRandom(arr) {
  if (!arr?.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Construye un mensaje al azar desde un objeto plantilla (API).
 * Usa saludos/cuerpos/ctas si existen; en caso contrario usa body (legacy).
 */
export function buildMessageFromTemplate(template, variables = {}) {
  if (!template) return '';
  const saludos = parseParts(template.saludos);
  const cuerpos = parseParts(template.cuerpos);
  const ctas    = parseParts(template.ctas);
  const hasParts = saludos.length > 0 || cuerpos.length > 0 || ctas.length > 0;

  const raw = hasParts
    ? [pickRandom(saludos), pickRandom(cuerpos), pickRandom(ctas)].filter(Boolean).join('\n\n')
    : (template.body || '');
  return resolveMessage(raw, variables);
}

/**
 * Construye mensaje directamente desde arrays de strings (usado en el formulario).
 * first=true → elige el primer elemento (preview estable mientras se escribe).
 * first=false → elige uno al azar (para "otra combinación").
 */
export function buildMessageFromArrays(saludos = [], cuerpos = [], ctas = [], variables = {}, first = true) {
  const pick = first
    ? (arr) => arr.find((v) => String(v).trim() !== '') ?? ''
    : pickRandom;
  const parts = [pick(saludos), pick(cuerpos), pick(ctas)].filter(Boolean);
  return resolveMessage(parts.join('\n\n'), variables);
}

/** Extrae nombres {{variable}} del texto de los 3 bloques */
export function extractVariablesFromArrays(saludos = [], cuerpos = [], ctas = []) {
  const allText = [...saludos, ...cuerpos, ...ctas].filter(Boolean).join('\n');
  const set = new Set();
  const re = new RegExp(VARIABLE_REGEX.source, 'g');
  let m;
  while ((m = re.exec(allText)) !== null) set.add(m[1]);
  return [...set];
}
