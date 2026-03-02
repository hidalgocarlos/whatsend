import { useState, useEffect, useRef } from 'react';
import api from '../services/api.js';
import { resolveSpintax } from '../lib/templateUtils.js';

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

function countVariants(text) {
  if (!text || !text.includes('{')) return 1;
  let count = 1;
  const regex = /\{([^{}]+)\}/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    count *= m[1].split('|').length;
  }
  return count;
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

export default function TemplatesPage() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', body: '' });
  const [mediaFile, setMediaFile] = useState(null);
  const [clearMedia, setClearMedia] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [spintaxPreview, setSpintaxPreview] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    api.get('/api/templates').then((r) => setList(r.data)).catch(console.error);
  }, []);

  function startEdit(t) {
    setEditing(t);
    setForm({ name: t.name, body: t.body });
    setSpintaxPreview(resolveSpintax(t.body));
    setMediaFile(null);
    setClearMedia(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ name: '', body: '' });
    setSpintaxPreview('');
    setMediaFile(null);
    setClearMedia(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleBodyChange(e) {
    const val = e.target.value;
    setForm(f => ({ ...f, body: val }));
    setSpintaxPreview(resolveSpintax(val));
  }

  // Inserta un snippet de spintax en la posición del cursor
  function insertSpintax(snippet) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = form.body.slice(0, start);
    const after = form.body.slice(end);
    const newBody = before + snippet + after;
    setForm(f => ({ ...f, body: newBody }));
    setSpintaxPreview(resolveSpintax(newBody));
    // Restaurar foco y cursor
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + snippet.length;
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

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.body.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('body', form.body.trim());
      if (mediaFile) {
        fd.append('media', mediaFile);
      } else if (clearMedia) {
        fd.append('clearMedia', 'true');
      }

      if (editing) {
        const { data } = await api.put(`/api/templates/${editing.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setList((prev) => prev.map((t) => (t.id === editing.id ? data : t)));
      } else {
        const { data } = await api.post('/api/templates', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
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

          <div className="space-y-3">
            <label htmlFor="template-body" className="block text-sm font-semibold text-slate-700">
              Texto del mensaje
            </label>

            {/* Ayuda amigable */}
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-2.5 text-sm">
              <p className="font-semibold text-blue-800">💡 Dos trucos para personalizar el mensaje:</p>
              <div className="space-y-2">
                <div className="flex gap-2.5">
                  <span className="text-blue-500 font-bold text-base leading-tight mt-0.5">1.</span>
                  <div>
                    <p className="text-blue-800 font-medium">Nombre del destinatario</p>
                    <p className="text-blue-600 text-xs mt-0.5">
                      Escribe <code className="bg-white border border-blue-200 px-1.5 py-0.5 rounded font-mono text-blue-700">{'{{nombre}}'}</code> y se reemplaza automáticamente con el nombre de cada persona.
                    </p>
                    <p className="text-blue-500 text-xs mt-1 italic">Ej: "Hola {'{{nombre}}'}, tenemos algo para ti."</p>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <span className="text-blue-500 font-bold text-base leading-tight mt-0.5">2.</span>
                  <div>
                    <p className="text-blue-800 font-medium">Palabras que cambian en cada mensaje</p>
                    <p className="text-blue-600 text-xs mt-0.5">
                      Usa el botón <strong>"Agregar palabras alternativas"</strong> de abajo para que el sistema use una frase diferente en cada envío. Así ningún mensaje es idéntico.
                    </p>
                    <p className="text-blue-500 text-xs mt-1 italic">Ej: "Hola / Buenos días / Buenas tardes" → cada persona recibe uno diferente.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Asistente de alternativas */}
            <VariationHelper onInsert={insertSpintax} />

            {/* Textarea */}
            <textarea
              id="template-body"
              ref={textareaRef}
              value={form.body}
              onChange={handleBodyChange}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl h-36 focus:ring-2 focus:ring-green-500/25 focus:border-green-500 transition-shadow text-sm leading-relaxed"
              placeholder={'Hola {{nombre}}, te escribimos de nuestra empresa.\n¡Tenemos algo especial para ti!'}
              required
            />

            {/* Preview en vivo */}
            {form.body && (
              <div className="p-4 bg-[#E7FEDD] border border-[#C5F0A4] rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                    <span>📱</span> Así se verá el mensaje al enviarse
                  </p>
                  {countVariants(form.body) > 1 && (
                    <button
                      type="button"
                      onClick={() => setSpintaxPreview(resolveSpintax(form.body))}
                      className="text-xs text-emerald-700 underline hover:no-underline font-medium"
                    >
                      Ver otra versión →
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {spintaxPreview || resolveSpintax(form.body)}
                </p>
                {countVariants(form.body) > 1 && (
                  <p className="mt-2 text-xs text-emerald-600">
                    ✅ Este mensaje tiene <strong>{countVariants(form.body)}</strong> versiones distintas — cada persona recibirá una diferente.
                  </p>
                )}
              </div>
            )}
          </div>

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
                <td className="p-4 text-slate-600 text-sm truncate max-w-sm">{t.body}</td>
                <td className="p-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(t)}
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
            <p className="text-slate-600 border-t border-slate-100 pt-2">{previewTemplate.body || '—'}</p>
            {previewTemplate.body && previewTemplate.body.includes('{') && (
              <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                Ejemplo variaciones: {resolveSpintax(previewTemplate.body)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
