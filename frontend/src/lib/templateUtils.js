const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

export function resolveTemplate(body, variables = {}) {
  if (!body) return '';
  return body.replace(VARIABLE_REGEX, (_, key) => variables[key] ?? `{{${key}}}`);
}

/**
 * Resuelve spintax: {opción1|opción2|opción3} → elige una al azar.
 * Soporta anidamiento: {Hola {amigo|colega}|Buenos días}.
 */
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

/** Aplica variables y spintax en orden correcto */
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
 * Construye el mensaje desde plantilla con 3 bloques (Saludo, Cuerpo, CTA) o body legacy.
 * Si hay al menos un elemento en saludos/cuerpos/ctas, elige uno al azar de cada bloque,
 * concatena con doble salto de línea y aplica variables + spintax.
 */
export function buildMessageFromTemplate(template, variables = {}) {
  const saludos = parseParts(template?.saludos);
  const cuerpos = parseParts(template?.cuerpos);
  const ctas = parseParts(template?.ctas);
  const hasParts = saludos.length > 0 || cuerpos.length > 0 || ctas.length > 0;

  if (hasParts) {
    const parts = [
      pickRandom(saludos),
      pickRandom(cuerpos),
      pickRandom(ctas),
    ].filter(Boolean);
    const raw = parts.join('\n\n');
    return resolveMessage(raw, variables);
  }
  return resolveMessage(template?.body ?? '', variables);
}
