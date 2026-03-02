import { useState, useEffect, useRef } from 'react';
import api from '../services/api.js';
import { resolveMessage, buildMessageFromTemplate } from '../lib/templateUtils.js';

const ACCEPT = 'image/jpeg,image/png,image/webp,audio/mpeg,audio/ogg,audio/mp4';
const API_BASE = import.meta.env.VITE_API_URL || '';

function mediaUrl(filename) {
  if (!filename) return null;
  const name = filename.split(/[\\/]/).pop();
  return `${API_BASE}/api/templates/media/${encodeURIComponent(name)}`;
}

function MediaIcon({ type }) {
  if (type === 'image') return <span className="ml-1 text-blue-500 text-xs">🖼 img</span>;
  if (type === 'audio') return <span className="ml-1 text-purple-500 text-xs">🎵 audio</span>;
  return null;
}

function MediaPreview({ mediaType, mediaPath, localFile }) {
  const src = localFile ? URL.createObjectURL(localFile) : mediaUrl(mediaPath);
  if (!src) return null;

  if (mediaType === 'image') {
    return (
      <img
        src={src}
        alt="Preview"
        className="mt-2 max-h-40 rounded-xl border border-slate-100 object-contain shadow-card"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }
  if (mediaType === 'audio') {
    return (
      <audio
        key={src}
        controls
        src={src}
        className="mt-2 w-full"
      />
    );
  }
  return null;
}

// ---------- Asistente de palabras alternativas ----------
function VariationHelper({ onInsert }) {
  const [open, setOpen]       = useState(false);
  const [options, setOptions] = useState('');

  function apply() {
    const parts = options.split('/').map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) return;
    onInsert(`{${parts.join('|')}}`);
    setOptions('');
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors font-medium"
      >
        <span className="text-base">✨</span> Agregar palabras alternativas
      </button>
    );
  }

  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
      <p className="text-sm font-semibold text-amber-800">Palabras alternativas</p>
      <p className="text-xs text-amber-700 leading-relaxed">
        Escribe varias opciones separadas por <strong>/</strong> y el sistema elegirá una diferente para cada persona que reciba el mensaje.
      </p>
      <div className="flex gap-2">
        <input
          autoFocus
          value={options}
          onChange={e => setOptions(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
          placeholder="Ej: Hola / Buenos días / Buenas tardes"
          className="flex-1 px-3 py-2 text-sm border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 bg-white"
        />
        <button
          type="button"
          onClick={apply}
          disabled={options.split('/').filter(s => s.trim()).length < 2}
          className="px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 disabled:opacity-40 transition-colors"
        >
          Insertar
        </button>
        <button type="button" onClick={() => { setOpen(false); setOptions(''); }} className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm">
          Cancelar
        </button>
      </div>
      {options.split('/').filter(s => s.trim()).length >= 2 && (
        <p className="text-xs text-amber-600">
          Vista previa: <strong>{options.split('/').map(s => s.trim()).filter(Boolean).join(' · ')}</strong>
        </p>
      )}
    </div>
  );
}

const emptyForm = () => ({
  name: '',
  saludos: [''],
  cuerpos: [''],
  ctas: [''],
});

export default function TemplatesPage() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [mediaFile, setMediaFile] = useState(null);
  const [clearMedia, setClearMedia] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewSample, setPreviewSample] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewModalSample, setPreviewModalSample] = useState('');
  const fileInputRef = useRef(null);
  const focusedInputRef = useRef(null);

  useEffect(() => {
    api.get('/api/templates').then((r) => setList(r.data)).catch(console.error);
  }, []);

  function startEdit(t) {
    setEditing(t);
    const saludos = Array.isArray(t.saludos) && t.saludos.length > 0 ? t.saludos : [];
    const cuerpos = Array.isArray(t.cuerpos) && t.cuerpos.length > 0 ? t.cuerpos : [];
    const ctas = Array.isArray(t.ctas) && t.ctas.length > 0 ? t.ctas : [];
    if (saludos.length || cuerpos.length || ctas.length) {
      setForm({
        name: t.name,
        saludos: saludos.length ? saludos : [''],
        cuerpos: cuerpos.length ? cuerpos : [''],
        ctas: ctas.length ? ctas : [''],
      });
    } else {
      setForm({
        name: t.name,
        saludos: [''],
        cuerpos: [t.body || ''],
        ctas: [''],
      });
    }
    setPreviewSample(null);
    setMediaFile(null);
    setClearMedia(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function cancelEdit() {
    setEditing(null);
    setForm(emptyForm());
    setPreviewSample(null);
    setMediaFile(null);
    setClearMedia(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function updatePart(section, index, value) {
    setForm((f) => ({
      ...f,
      [section]: f[section].map((v, i) => (i === index ? value : v)),
    }));
  }

  function addPart(section) {
    setForm((f) => ({ ...f, [section]: [...f[section], ''] }));
  }

  function removePart(section, index) {
    setForm((f) => ({
      ...f,
      [section]: f[section].filter((_, i) => i !== index).length ? f[section].filter((_, i) => i !== index) : [''],
    }));
  }

  function registerFocus(section, index, setValue, el) {
    focusedInputRef.current = { section, index, setValue, el };
  }

  function insertSpintax(snippet) {
    const cur = focusedInputRef.current;
    if (!cur?.el) return;
    const start = cur.el.selectionStart;
    const end = cur.el.selectionEnd;
    const val = cur.el.value ?? '';
    const newVal = val.slice(0, start) + snippet + val.slice(end);
    cur.setValue(newVal);
    requestAnimationFrame(() => {
      cur.el.focus();
      cur.el.selectionStart = cur.el.selectionEnd = start + snippet.length;
    });
  }

  function handleFileChange(e) {
    const file = e.target.files[0] || null;
    setMediaFile(file);
    setClearMedia(false);
  }

  function handleClearMedia() {
    setMediaFile(null);
    setClearMedia(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Detecta si el archivo local (o el del template) es imagen o audio
  function resolvedMediaType() {
    if (mediaFile) {
      if (mediaFile.type.startsWith('image/')) return 'image';
      if (mediaFile.type.startsWith('audio/') || mediaFile.type === 'video/mp4') return 'audio';
    }
    if (!clearMedia && editing?.mediaType) return editing.mediaType;
    return null;
  }

  function resolvedMediaPath() {
    if (mediaFile) return null; // se usa localFile
    if (!clearMedia && editing?.mediaPath) return editing.mediaPath;
    return null;
  }

  const hasContent = () => {
    const hasSaludo = form.saludos.some((s) => String(s).trim() !== '');
    const hasCuerpo = form.cuerpos.some((c) => String(c).trim() !== '');
    return hasSaludo && hasCuerpo;
  };

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !hasContent()) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('saludos', JSON.stringify(form.saludos));
      fd.append('cuerpos', JSON.stringify(form.cuerpos));
      fd.append('ctas', JSON.stringify(form.ctas));
      fd.append('body', '');
      if (mediaFile) fd.append('media', mediaFile);
      else if (clearMedia) fd.append('clearMedia', 'true');

      if (editing) {
        const { data } = await api.put(`/api/templates/${editing.id}`, fd);
        setList((prev) => prev.map((t) => (t.id === editing.id ? data : t)));
      } else {
        const { data } = await api.post('/api/templates', fd);
        setList((prev) => [data, ...prev]);
      }
      cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    try {
      await api.delete(`/api/templates/${id}`);
      setList((prev) => prev.filter((t) => t.id !== id));
      if (editing?.id === id) cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al eliminar');
    }
  }

  const currentMediaType = resolvedMediaType();
  const currentMediaPath = resolvedMediaPath();
  const hasCurrentMedia = currentMediaType !== null;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight mb-8">Plantillas</h1>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 mb-8 transition-shadow duration-200 hover:shadow-card-hover">
        <h2 className="font-semibold text-slate-900 tracking-tight mb-5">{editing ? 'Editar' : 'Nueva'} plantilla</h2>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="template-name" className="block text-sm font-semibold text-slate-700 mb-2">Nombre</label>
            <input
              id="template-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 transition-shadow"
              placeholder="Ej: Bienvenida"
              required
            />
          </div>

          {/* Ayuda */}
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-2.5 text-sm">
            <p className="font-semibold text-blue-800">💡 Mensaje en 3 partes: Saludo → Cuerpo → CTA. Puedes añadir varias opciones en cada parte; el sistema elegirá una al azar por envío.</p>
            <p className="text-blue-600 text-xs">
              Usa <code className="bg-white border border-blue-200 px-1 py-0.5 rounded font-mono text-blue-700">{'{{nombre}}'}</code> para el nombre. Botón <strong>«Agregar palabras alternativas»</strong> para variaciones en cada parte.
            </p>
          </div>

          <VariationHelper onInsert={insertSpintax} />

          {/* Saludos */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Saludo</label>
            {form.saludos.map((val, i) => (
              <div key={`s-${i}`} className="flex gap-2 items-start">
                <input
                  value={val}
                  onChange={(e) => updatePart('saludos', i, e.target.value)}
                  onFocus={(e) => registerFocus('saludos', i, (v) => updatePart('saludos', i, v), e.target)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 text-sm"
                  placeholder="Ej: Hola {{nombre}}"
                />
                <button type="button" onClick={() => removePart('saludos', i)} disabled={form.saludos.length <= 1} className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-40" title="Quitar">×</button>
              </div>
            ))}
            <button type="button" onClick={() => addPart('saludos')} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">+ Agregar otro saludo</button>
          </div>

          {/* Cuerpos */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Cuerpo</label>
            {form.cuerpos.map((val, i) => (
              <div key={`c-${i}`} className="flex gap-2 items-start">
                <textarea
                  value={val}
                  onChange={(e) => updatePart('cuerpos', i, e.target.value)}
                  onFocus={(e) => registerFocus('cuerpos', i, (v) => updatePart('cuerpos', i, v), e.target)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 text-sm min-h-[80px]"
                  placeholder="Texto principal del mensaje..."
                />
                <button type="button" onClick={() => removePart('cuerpos', i)} disabled={form.cuerpos.length <= 1} className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-40 mt-1" title="Quitar">×</button>
              </div>
            ))}
            <button type="button" onClick={() => addPart('cuerpos')} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">+ Agregar otro cuerpo</button>
          </div>

          {/* CTAs */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">CTA (llamado a la acción) <span className="font-normal text-slate-400">opcional</span></label>
            {form.ctas.map((val, i) => (
              <div key={`a-${i}`} className="flex gap-2 items-start">
                <input
                  value={val}
                  onChange={(e) => updatePart('ctas', i, e.target.value)}
                  onFocus={(e) => registerFocus('ctas', i, (v) => updatePart('ctas', i, v), e.target)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 text-sm"
                  placeholder="Ej: Escríbenos al 3001234567"
                />
                <button type="button" onClick={() => removePart('ctas', i)} disabled={form.ctas.length <= 1} className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-40" title="Quitar">×</button>
              </div>
            ))}
            <button type="button" onClick={() => addPart('ctas')} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">+ Agregar otro CTA</button>
          </div>

          {/* Preview en vivo */}
          {hasContent() && (
            <div className="p-4 bg-[#E7FEDD] border border-[#C5F0A4] rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">📱 Vista previa</p>
                <button type="button" onClick={() => setPreviewSample(buildMessageFromTemplate(form, {}))} className="text-xs text-emerald-700 underline hover:no-underline font-medium">Ver otra combinación →</button>
              </div>
              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                {previewSample != null ? previewSample : resolveMessage([form.saludos[0], form.cuerpos[0], form.ctas[0]].filter(Boolean).join('\n\n'), {})}
              </p>
              {(form.saludos.length > 1 || form.cuerpos.length > 1 || form.ctas.length > 1) && (
                <p className="mt-2 text-xs text-emerald-600">✅ Variantes por bloque: el sistema elegirá una opción al azar en cada envío.</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Imagen o audio adjunto{' '}
              <span className="text-slate-400 font-normal">(opcional — JPG, PNG, WEBP, MP3, OGG · máx 20 MB)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#25D366]/10 file:text-[#25D366] hover:file:bg-[#25D366]/20"
            />

            {/* Preview del archivo actual o nuevo */}
            {hasCurrentMedia && (
              <div className="mt-2">
                <MediaPreview
                  mediaType={currentMediaType}
                  mediaPath={currentMediaPath}
                  localFile={mediaFile}
                />
                <button
                  type="button"
                  onClick={handleClearMedia}
                  className="mt-2 text-xs text-red-500 hover:text-red-700"
                >
                  Quitar archivo
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50/90 border border-red-100 rounded-2xl text-sm text-red-700 font-medium" role="alert">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl disabled:opacity-50 shadow-card transition-all duration-200"
            >
              {loading ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear plantilla'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-5 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden transition-shadow duration-200 hover:shadow-card-hover">
        <table className="w-full">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="p-4">Nombre</th>
              <th className="p-4">Cuerpo (preview)</th>
              <th className="p-4 w-44">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-400">No hay plantillas aún</td>
              </tr>
            )}
            {list.map((t) => (
              <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                <td className="p-4 font-medium text-slate-800">
                  {t.name}
                  <MediaIcon type={t.mediaType} />
                </td>
                <td className="p-4 text-slate-600 text-sm truncate max-w-sm">
                  {(() => {
                    const saludos = Array.isArray(t.saludos) ? t.saludos : [];
                    const cuerpos = Array.isArray(t.cuerpos) ? t.cuerpos : [];
                    const ctas = Array.isArray(t.ctas) ? t.ctas : [];
                    const hasParts = saludos.length > 0 || cuerpos.length > 0 || ctas.length > 0;
                    if (hasParts) {
                      const first = [saludos[0], cuerpos[0], ctas[0]].filter(Boolean).join(' · ');
                      const n = saludos.length + cuerpos.length + ctas.length;
                      return n > 3 ? `${(first || '').slice(0, 60)}… (${n} variantes)` : (first || '').slice(0, 80);
                    }
                    return (t.body || '').slice(0, 80);
                  })()}
                </td>
                <td className="p-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => { setPreviewTemplate(t); setPreviewModalSample(buildMessageFromTemplate(t, {})); }}
                    className="font-medium text-slate-600 hover:text-slate-800 mr-3 text-sm transition-colors"
                  >
                    Previsualizar
                  </button>
                  <button type="button" onClick={() => startEdit(t)} className="font-medium text-[#25D366] hover:text-emerald-600 mr-3 text-sm transition-colors">
                    Editar
                  </button>
                  <button type="button" onClick={() => remove(t.id)} className="font-medium text-red-600 hover:text-red-700 text-sm transition-colors">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal previsualizar mensaje */}
      {previewTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setPreviewTemplate(null)}
        >
          <div
            className="max-w-md max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl p-4 text-sm text-slate-700 whitespace-pre-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-slate-800">{previewTemplate.name}</p>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-slate-600 border-t border-slate-100 pt-2 whitespace-pre-wrap">
              {previewModalSample || '—'}
            </p>
            <button type="button" onClick={() => setPreviewModalSample(buildMessageFromTemplate(previewTemplate, {}))} className="mt-2 text-xs text-emerald-600 hover:underline">
              Ver otra combinación
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
