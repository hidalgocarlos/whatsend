/**
 * Resuelve spintax: {opción1|opción2|opción3} → elige una al azar.
 * Soporta anidamiento: {Hola {amigo|colega}|Buenos días {señor|señora}}.
 *
 * Orden recomendado de uso:
 *   1. resolveTemplate(body, vars)   ← reemplaza {{variable}}
 *   2. resolveSpintax(body)          ← elige aleatoriamente entre opciones {a|b|c}
 */
export function resolveSpintax(text) {
  if (!text || !text.includes('{')) return text;

  let result = text;
  let prev;
  // Iteramos desde las llaves más internas hacia afuera
  do {
    prev = result;
    result = result.replace(/\{([^{}]+)\}/g, (_, options) => {
      const parts = options.split('|');
      return parts[Math.floor(Math.random() * parts.length)];
    });
  } while (result !== prev);

  return result;
}
