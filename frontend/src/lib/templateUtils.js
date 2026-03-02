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
