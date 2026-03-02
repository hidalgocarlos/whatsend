// Genera un color Tailwind consistente para cada tag basado en un hash del string.
// El mismo tag siempre obtendrá el mismo color en toda la app.

const PALETTES = [
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500'    },
  { bg: 'bg-violet-100',  text: 'text-violet-700',  border: 'border-violet-200',  dot: 'bg-violet-500'  },
  { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
  { bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500'    },
  { bg: 'bg-cyan-100',    text: 'text-cyan-700',    border: 'border-cyan-200',    dot: 'bg-cyan-500'    },
  { bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-500'  },
  { bg: 'bg-pink-100',    text: 'text-pink-700',    border: 'border-pink-200',    dot: 'bg-pink-500'    },
  { bg: 'bg-teal-100',    text: 'text-teal-700',    border: 'border-teal-200',    dot: 'bg-teal-500'    },
  { bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-200',  dot: 'bg-indigo-500'  },
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function tagColor(tag) {
  return PALETTES[hashString(tag) % PALETTES.length];
}

// Componente-función: retorna clases CSS para un chip de tag
export function tagChipClass(tag) {
  const c = tagColor(tag);
  return `${c.bg} ${c.text} ${c.border} border text-xs font-medium px-2 py-0.5 rounded-full`;
}
