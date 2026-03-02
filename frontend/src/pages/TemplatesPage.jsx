import { useState, useEffect, useRef } from 'react';
import api from '../services/api.js';
import { resolveMessage, buildMessageFromTemplate } from '../lib/templateUtils.js';

const ACCEPT = 'image/jpeg,image/png,image/webp,audio/mpeg,audio/ogg,audio/mp4';
const API_BASE = import.meta.env.VITE_API_URL || '';

function mediaUrl(filename) {
  if (!filename) return null;
  const name = String(filename).split(/[\\/]/).pop();
  return `${API_BASE}/api/templates/media/${encodeURIComponent(name)}`;
}

function MediaIcon({ type }) {
  if (type === 'image') return <span className="ml-1.5 text-blue-500 text-xs font-medium">🖼</span>;
  if (type === 'audio') return <span className="ml-1.5 text-violet-500 text-xs font-medium">🎵</span>;
  return null;
}

function MediaPreview({ mediaType, mediaPath, localFile }) {
  const src = localFile ? URL.createObjectURL(localFile) : mediaUrl(mediaPath);
  if (!src) return null;
  if (mediaType === 'image') {
    return (
      <img
        src={src}
        alt="Adjunto"
        className="mt-2 max-h-36 rounded-xl border border-slate-200 object-contain shadow-sm"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }
  if (mediaType === 'audio') {
    return (
      <audio key={src} controls src={src} className="mt-2 w-full h-10 rounded-lg" />
    );
  }
  return null;
}

const INITIAL_FORM = {
  name: '',
  saludos: [''],
  cuerpos: [''],
  ctas: [''],
};

function ensureNonEmpty(arr) {
  return Array.isArray(arr) && arr.length > 0 ? arr.map(String) : [''];
}

export default function TemplatesPage() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM }));
  const [mediaFile, setMediaFile] = useState(null);
  const [clearMedia, setClearMedia] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewRandom, setPreviewRandom] = useState(null);
  const [previewModalTemplate, setPreviewModalTemplate] = useState(null);
  const [previewModalText, setPreviewModalText] = useState('');
  const fileInputRef = useRef(null);
  const focusedRef = useRef(null);

  useEffect(() => {
    api.get('/api/templates').then((r) => setList(r.data)).catch(console.error);
  }, []);

  function loadTemplate(t) {
    setEditing(t);
    const saludos = ensureNonEmpty(t.saludos);
    const cuerpos = ensureNonEmpty(t.cuerpos);
    const ctas = ensureNonEmpty(t.ctas);
    const hasNewFormat = saludos.some(Boolean) || cuerpos.some(Boolean) || ctas.some(Boolean);
    setForm({
      name: t.name || '',
      saludos: hasNewFormat ? saludos : [''],
      cuerpos: hasNewFormat ? cuerpos : [t.body || ''],
      ctas: hasNewFormat ? ctas : [''],
    });
    setPreviewRandom(null);
    setMediaFile(null);
    setClearMedia(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function resetForm() {
    setEditing(null);
    setForm({ ...INITIAL_FORM });
    setPreviewRandom(null);
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
    setForm((f) => {
      const next = f[section].filter((_, i) => i !== index);
      return { ...f, [section]: next.length ? next : [''] };
    });
  }

  function registerFocus(setter, el) {
    focusedRef.current = { setter, el };
  }

  function insertSpintax(snippet) {
    const cur = focusedRef.current;
    if (!cur?.el) return;
    const start = cur.el.selectionStart ?? 0;
    const end = cur.el.selectionEnd ?? start;
    const val = cur.el.value ?? '';
    const newVal = val.slice(0, start) + snippet + val.slice(end);
    cur.setter(newVal);
    requestAnimationFrame(() => {
      cur.el.focus();
      const pos = start + snippet.length;
      cur.el.setSelectionRange(pos, pos);
    });
  }

  const hasValidForm = () => {
    const nameOk = String(form.name).trim() !== '';
    const hasCuerpo = form.cuerpos.some((c) => String(c).trim() !== '');
    return nameOk && hasCuerpo;
  };

  const getPreviewText = () => {
    if (previewRandom != null) return previewRandom;
    const s = form.saludos[0] ?? '';
    const c = form.cuerpos[0] ?? '';
    const a = form.ctas[0] ?? '';
    return resolveMessage([s, c, a].filter(Boolean).join('\n\n'), {});
  };

  async function submit(e) {
    e.preventDefault();
    if (!hasValidForm()) return;
    setLoading(true);
    setError(null);
    try {
      const name = form.name.trim();
      const saludos = form.saludos.map(String).filter((s) => s.trim() !== '').length ? form.saludos.map(String) : [''];
      const cuerpos = form.cuerpos.map(String).filter((c) => c.trim() !== '');
      const ctas = form.ctas.map(String).filter((a) => a.trim() !== '').length ? form.ctas.map(String) : [''];

      if (!cuerpos.length || !cuerpos.some((c) => c.trim() !== '')) {
        setError('El cuerpo del mensaje debe tener al menos una variante con texto.');
        setLoading(false);
        return;
      }

      if (mediaFile || (editing && (clearMedia || editing.mediaPath))) {
        const fd = new FormData();
        fd.append('name', name);
        fd.append('saludos', JSON.stringify(saludos));
        fd.append('cuerpos', JSON.stringify(cuerpos));
        fd.append('ctas', JSON.stringify(ctas));
        if (mediaFile) fd.append('media', mediaFile);
        if (clearMedia && editing) fd.append('clearMedia', 'true');

        if (editing) {
          const { data } = await api.put(`/api/templates/${editing.id}`, fd);
          setList((prev) => prev.map((t) => (t.id === editing.id ? data : t)));
        } else {
          const { data } = await api.post('/api/templates', fd);
          setList((prev) => [data, ...prev]);
        }
      } else {
        const payload = { name, saludos, cuerpos, ctas };
        if (editing) {
          const { data } = await api.put(`/api/templates/${editing.id}`, payload);
          setList((prev) => prev.map((t) => (t.id === editing.id ? data : t)));
        } else {
          const { data } = await api.post('/api/templates', payload);
          setList((prev) => [data, ...prev]);
        }
      }
      resetForm();
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
      if (editing?.id === id) resetForm();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al eliminar');
    }
  }

  function openPreviewModal(t) {
    setPreviewModalTemplate(t);
    setPreviewModalText(buildMessageFromTemplate(t, {}));
  }

  const currentMediaType = mediaFile
    ? (mediaFile.type.startsWith('image/') ? 'image' : mediaFile.type.startsWith('audio/') || mediaFile.type === 'video/mp4' ? 'audio' : null)
    : clearMedia ? null : editing?.mediaType ?? null;
  const currentMediaPath = !mediaFile && !clearMedia && editing?.mediaPath ? editing.mediaPath : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Plantillas de mensaje</h1>
          <p className="mt-1 text-slate-600 text-sm">
            Crea mensajes en 3 partes: <strong>Saludo</strong> → <strong>Cuerpo</strong> → <strong>CTA</strong>. Varias opciones por parte se eligen al azar en cada envío.
          </p>
        </header>

        {/* Formulario */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-semibold text-slate-800">{editing ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
          </div>
          <form onSubmit={submit} className="p-5 sm:p-6 space-y-6">
            <div>
              <label htmlFor="tpl-name" className="block text-sm font-medium text-slate-700 mb-1.5">Nombre</label>
              <input
                id="tpl-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Bienvenida clientes"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-shadow text-slate-900"
              />
            </div>

            {/* Bloque Saludo */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-700 text-sm font-bold">1</span>
                <label className="text-sm font-medium text-slate-700">Saludo</label>
                <span className="text-xs text-slate-400">(opcional)</span>
              </div>
              {form.saludos.map((val, i) => (
                <div key={`s-${i}`} className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => updatePart('saludos', i, e.target.value)}
                    onFocus={(e) => registerFocus((v) => updatePart('saludos', i, v), e.target)}
                    placeholder="Ej: Hola {{nombre}}"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removePart('saludos', i)}
                    disabled={form.saludos.length <= 1}
                    className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-40 rounded-lg hover:bg-red-50 transition-colors"
                    title="Quitar variante"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addPart('saludos')} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
                + Añadir otra variante de saludo
              </button>
            </div>

            {/* Bloque Cuerpo */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-bold">2</span>
                <label className="text-sm font-medium text-slate-700">Cuerpo del mensaje</label>
                <span className="text-xs text-amber-600 font-medium">obligatorio</span>
              </div>
              {form.cuerpos.map((val, i) => (
                <div key={`c-${i}`} className="flex gap-2 items-start">
                  <textarea
                    value={val}
                    onChange={(e) => updatePart('cuerpos', i, e.target.value)}
                    onFocus={(e) => registerFocus((v) => updatePart('cuerpos', i, v), e.target)}
                    placeholder="Texto principal del mensaje..."
                    rows={3}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-sm resize-y min-h-[72px]"
                  />
                  <button
                    type="button"
                    onClick={() => removePart('cuerpos', i)}
                    disabled={form.cuerpos.length <= 1}
                    className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-40 rounded-lg hover:bg-red-50 transition-colors mt-1"
                    title="Quitar variante"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addPart('cuerpos')} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
                + Añadir otra variante de cuerpo
              </button>
            </div>

            {/* Bloque CTA */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 text-sm font-bold">3</span>
                <label className="text-sm font-medium text-slate-700">CTA (llamado a la acción)</label>
                <span className="text-xs text-slate-400">(opcional)</span>
              </div>
              {form.ctas.map((val, i) => (
                <div key={`a-${i}`} className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => updatePart('ctas', i, e.target.value)}
                    onFocus={(e) => registerFocus((v) => updatePart('ctas', i, v), e.target)}
                    placeholder="Ej: Escríbenos al 300 123 4567"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removePart('ctas', i)}
                    disabled={form.ctas.length <= 1}
                    className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-40 rounded-lg hover:bg-red-50 transition-colors"
                    title="Quitar variante"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addPart('ctas')} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
                + Añadir otra variante de CTA
              </button>
            </div>

            {/* Palabras alternativas */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-sm font-medium text-amber-800 mb-2">Palabras alternativas (spintax)</p>
              <p className="text-xs text-amber-700 mb-2">
                Escribe opciones separadas por <strong>/</strong>, haz clic en Insertar y se añadirá en el campo que tengas seleccionado. Ej: <code className="bg-amber-100 px-1 rounded">Hola / Buenas / Qué tal</code>
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="spintax-input"
                  placeholder="Opción 1 / Opción 2 / Opción 3"
                  className="flex-1 px-3 py-2 rounded-lg border border-amber-200 bg-white text-sm focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const v = e.target.value.trim();
                      const parts = v.split('/').map((s) => s.trim()).filter(Boolean);
                      if (parts.length >= 2) insertSpintax(`{${parts.join('|')}}`);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('spintax-input');
                    if (!el) return;
                    const parts = el.value.split('/').map((s) => s.trim()).filter(Boolean);
                    if (parts.length >= 2) {
                      insertSpintax(`{${parts.join('|')}}`);
                      el.value = '';
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
                >
                  Insertar
                </button>
              </div>
            </div>

            {/* Vista previa */}
            {form.cuerpos.some((c) => String(c).trim() !== '') && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-emerald-800">Vista previa</span>
                  <button
                    type="button"
                    onClick={() => setPreviewRandom(buildMessageFromTemplate(form, {}))}
                    className="text-xs font-medium text-emerald-600 hover:underline"
                  >
                    Otra combinación
                  </button>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-white/80 rounded-lg p-3 border border-emerald-100">
                  {getPreviewText()}
                </p>
                {(form.saludos.length > 1 || form.cuerpos.length > 1 || form.ctas.length > 1) && (
                  <p className="mt-2 text-xs text-emerald-600">El sistema elegirá una variante al azar de cada bloque en cada envío.</p>
                )}
              </div>
            )}

            {/* Adjunto */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Imagen o audio (opcional)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                onChange={(e) => { setMediaFile(e.target.files?.[0] ?? null); setClearMedia(false); }}
                className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-medium file:text-sm hover:file:bg-emerald-100"
              />
              {(currentMediaType || mediaFile) && (
                <div className="mt-2">
                  <MediaPreview mediaType={currentMediaType} mediaPath={currentMediaPath} localFile={mediaFile} />
                  {editing && (
                    <button type="button" onClick={() => setClearMedia(true)} className="mt-2 text-xs text-red-600 hover:underline">
                      Quitar adjunto
                    </button>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 font-medium" role="alert">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || !hasValidForm()}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-sm transition-colors"
              >
                {loading ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear plantilla'}
              </button>
              {editing && (
                <button type="button" onClick={resetForm} className="px-5 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Listado */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-semibold text-slate-800">Tus plantillas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="p-4">Nombre</th>
                  <th className="p-4 max-w-xs">Vista previa</th>
                  <th className="p-4 w-40">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-500 text-sm">Aún no tienes plantillas. Crea una arriba.</td>
                  </tr>
                )}
                {list.map((t) => {
                  const saludos = Array.isArray(t.saludos) ? t.saludos : [];
                  const cuerpos = Array.isArray(t.cuerpos) ? t.cuerpos : [];
                  const ctas = Array.isArray(t.ctas) ? t.ctas : [];
                  const firstLine = [saludos[0], cuerpos[0], ctas[0]].filter(Boolean).join(' · ');
                  const variantCount = saludos.length + cuerpos.length + ctas.length;
                  return (
                    <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-medium text-slate-800">
                        {t.name}
                        <MediaIcon type={t.mediaType} />
                      </td>
                      <td className="p-4 text-slate-600 text-sm max-w-xs truncate" title={firstLine}>
                        {firstLine ? `${firstLine.slice(0, 70)}${firstLine.length > 70 ? '…' : ''}` : '—'}
                        {variantCount > 3 && <span className="text-slate-400 ml-1">({variantCount} variantes)</span>}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => openPreviewModal(t)} className="text-sm font-medium text-slate-600 hover:text-slate-800">
                            Ver
                          </button>
                          <button type="button" onClick={() => loadTemplate(t)} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
                            Editar
                          </button>
                          <button type="button" onClick={() => remove(t.id)} className="text-sm font-medium text-red-600 hover:text-red-700">
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Modal previsualización */}
      {previewModalTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setPreviewModalTemplate(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{previewModalTemplate.name}</h3>
              <button type="button" onClick={() => setPreviewModalTemplate(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                ×
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{previewModalText || '—'}</p>
              <button
                type="button"
                onClick={() => setPreviewModalText(buildMessageFromTemplate(previewModalTemplate, {}))}
                className="mt-3 text-sm font-medium text-emerald-600 hover:underline"
              >
                Otra combinación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
