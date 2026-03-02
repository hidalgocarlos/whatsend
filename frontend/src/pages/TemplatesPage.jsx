import { useState, useEffect, useRef, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../services/api.js';
import {
  resolveMessage,
  buildMessageFromTemplate,
  buildMessageFromArrays,
  extractVariablesFromArrays,
} from '../lib/templateUtils.js';
import WhatsAppBubble from '../components/WhatsAppBubble.jsx';

const ACCEPT = 'image/jpeg,image/png,image/webp,audio/mpeg,audio/ogg,audio/mp4,video/mp4';
const API_BASE = import.meta.env.VITE_API_URL || '';

function uid() {
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function toIdValue(arr) {
  const a = Array.isArray(arr) ? arr : [];
  if (a.length === 0) return [{ id: uid(), value: '' }];
  return a.map((v) => ({ id: uid(), value: String(v) }));
}

function mediaUrl(filename) {
  if (!filename) return null;
  const name = String(filename).split(/[\\/]/).pop();
  return `${API_BASE}/api/templates/media/${encodeURIComponent(name)}`;
}

// ─── Drag handle icon ──────────────────────────────────────────────────────────
function DragHandle(props) {
  return (
    <button
      type="button"
      title="Arrastrar para reordenar"
      className="flex-shrink-0 mt-2.5 p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing transition-colors touch-none"
      {...props}
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
        <circle cx="2.5" cy="2.5" r="1.5" />
        <circle cx="7.5" cy="2.5" r="1.5" />
        <circle cx="2.5" cy="8"   r="1.5" />
        <circle cx="7.5" cy="8"   r="1.5" />
        <circle cx="2.5" cy="13.5" r="1.5" />
        <circle cx="7.5" cy="13.5" r="1.5" />
      </svg>
    </button>
  );
}

// ─── Sortable variant row ──────────────────────────────────────────────────────
function SortableVariant({ id, value, onChange, onRemove, canRemove, onFocus, multiline, placeholder }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const inputCls = 'flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-sm bg-white transition-shadow';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-1.5 items-start ${isDragging ? 'opacity-50 z-50 relative' : ''}`}
    >
      <DragHandle {...attributes} {...listeners} />
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => onFocus && onFocus(e.target)}
          placeholder={placeholder}
          rows={3}
          className={`${inputCls} resize-y min-h-[72px]`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => onFocus && onFocus(e.target)}
          placeholder={placeholder}
          className={inputCls}
        />
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        title="Quitar variante"
        className="flex-shrink-0 mt-2.5 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M1 1l10 10M11 1L1 11" />
        </svg>
      </button>
    </div>
  );
}

// ─── Section block ──────────────────────────────────────────────────────────────
function SectionBlock({ number, color, title, badge, children, onAdd, addLabel }) {
  const colors = {
    amber:   { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   ring: 'ring-amber-200'   },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-200' },
    slate:   { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200',   ring: 'ring-slate-200'   },
  };
  const c = colors[color] ?? colors.slate;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className={`flex items-center justify-center w-7 h-7 rounded-lg text-sm font-bold ${c.bg} ${c.text}`}>
          {number}
        </span>
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        {badge && (
          <span className="ml-auto text-xs text-slate-400">{badge}</span>
        )}
      </div>
      {children}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M7 1v12M1 7h12" />
        </svg>
        {addLabel}
      </button>
    </div>
  );
}

// ─── Delete confirm modal ───────────────────────────────────────────────────────
function DeleteModal({ name, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg width="18" height-="18" viewBox="0 0 18 18" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
              <path d="M2 4.5h14M6 4.5V3a1 1 0 011-1h4a1 1 0 011 1v1.5M7.5 8v5M10.5 8v5M3.5 4.5l.9 9.1A1.5 1.5 0 006 15h6a1.5 1.5 0 001.5-1.4l.9-9.1" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Eliminar plantilla</p>
            <p className="text-sm text-slate-500 mt-0.5">Esta acción no se puede deshacer.</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-5">
          ¿Eliminar <strong>{name}</strong>?
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Preview modal ─────────────────────────────────────────────────────────────
function PreviewModal({ template, onClose }) {
  const [text, setText] = useState(() => buildMessageFromTemplate(template, {}));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 truncate pr-2">{template.name}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 1l12 12M13 1L1 13"/></svg>
          </button>
        </div>
        <div className="p-4">
          <WhatsAppBubble text={text} mediaType={template.mediaType} mediaSrc={template.mediaPath ? mediaUrl(template.mediaPath) : null} />
        </div>
        <div className="px-5 pb-4 flex justify-between items-center">
          <button
            type="button"
            onClick={() => setText(buildMessageFromTemplate(template, {}))}
            className="text-sm font-medium text-emerald-600 hover:underline"
          >
            Otra combinación
          </button>
          <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
const INITIAL_FORM = () => ({
  name:    '',
  saludos: [{ id: uid(), value: '' }],
  cuerpos: [{ id: uid(), value: '' }],
  ctas:    [{ id: uid(), value: '' }],
});

export default function TemplatesPage() {
  const [list,            setList]            = useState([]);
  const [editing,         setEditing]         = useState(null);
  const [form,            setForm]            = useState(INITIAL_FORM);
  const [mediaFile,       setMediaFile]       = useState(null);
  const [clearMedia,      setClearMedia]      = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);
  const [previewRandom,   setPreviewRandom]   = useState(null);
  const [previewModal,    setPreviewModal]    = useState(null);
  const [deleteTarget,    setDeleteTarget]    = useState(null);
  const fileInputRef  = useRef(null);
  const focusedRef    = useRef(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    api.get('/api/templates').then((r) => setList(r.data)).catch(console.error);
  }, []);

  // ── Form helpers ──────────────────────────────────────────────────────────────
  function loadTemplate(t) {
    setEditing(t);
    const saludos = toIdValue(Array.isArray(t.saludos) && t.saludos.length ? t.saludos : (t.body ? [] : []));
    const cuerpos = toIdValue(Array.isArray(t.cuerpos) && t.cuerpos.length ? t.cuerpos : (t.body ? [t.body] : []));
    const ctas    = toIdValue(Array.isArray(t.ctas)    && t.ctas.length    ? t.ctas    : []);
    setForm({
      name:    t.name || '',
      saludos: saludos.length ? saludos : [{ id: uid(), value: '' }],
      cuerpos: cuerpos.length ? cuerpos : [{ id: uid(), value: '' }],
      ctas:    ctas.length    ? ctas    : [{ id: uid(), value: '' }],
    });
    setPreviewRandom(null);
    setMediaFile(null);
    setClearMedia(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function resetForm() {
    setEditing(null);
    setForm(INITIAL_FORM());
    setPreviewRandom(null);
    setMediaFile(null);
    setClearMedia(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function updatePart(section, id, value) {
    setForm((f) => ({
      ...f,
      [section]: f[section].map((p) => (p.id === id ? { ...p, value } : p)),
    }));
    setPreviewRandom(null);
  }

  function addPart(section) {
    setForm((f) => ({ ...f, [section]: [...f[section], { id: uid(), value: '' }] }));
  }

  function removePart(section, id) {
    setForm((f) => {
      const next = f[section].filter((p) => p.id !== id);
      return { ...f, [section]: next.length ? next : [{ id: uid(), value: '' }] };
    });
    setPreviewRandom(null);
  }

  function handleDragEnd(section, event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setForm((f) => {
      const items = f[section];
      const oldIndex = items.findIndex((p) => p.id === active.id);
      const newIndex  = items.findIndex((p) => p.id === over.id);
      return { ...f, [section]: arrayMove(items, oldIndex, newIndex) };
    });
    setPreviewRandom(null);
  }

  function registerFocus(setter, el) {
    focusedRef.current = { setter, el };
  }

  function insertSpintax(snippet) {
    const cur = focusedRef.current;
    if (!cur?.el) return;
    const start = cur.el.selectionStart ?? 0;
    const end   = cur.el.selectionEnd   ?? start;
    const val   = cur.el.value ?? '';
    const newVal = val.slice(0, start) + snippet + val.slice(end);
    cur.setter(newVal);
    requestAnimationFrame(() => {
      cur.el.focus();
      const pos = start + snippet.length;
      cur.el.setSelectionRange(pos, pos);
    });
  }

  // ── Derived state ─────────────────────────────────────────────────────────────
  const saludosArr = useMemo(() => form.saludos.map((p) => p.value), [form.saludos]);
  const cuerposArr = useMemo(() => form.cuerpos.map((p) => p.value), [form.cuerpos]);
  const ctasArr    = useMemo(() => form.ctas.map((p) => p.value),    [form.ctas]);

  const hasValidForm = String(form.name).trim() !== '' && cuerposArr.some((c) => c.trim() !== '');

  const detectedVars = useMemo(
    () => extractVariablesFromArrays(saludosArr, cuerposArr, ctasArr),
    [saludosArr, cuerposArr, ctasArr],
  );

  const charCount = useMemo(
    () => (form.cuerpos.find((p) => p.value.trim()) ?? form.cuerpos[0])?.value.length ?? 0,
    [form.cuerpos],
  );

  const stablePreview = useMemo(
    () => buildMessageFromArrays(saludosArr, cuerposArr, ctasArr, {}, true),
    [saludosArr, cuerposArr, ctasArr],
  );

  const previewText     = previewRandom ?? stablePreview;
  const previewIsEmpty  = !cuerposArr.some((c) => c.trim() !== '');

  // ── Media helpers ─────────────────────────────────────────────────────────────
  const currentMediaType = mediaFile
    ? (mediaFile.type.startsWith('image/') ? 'image' : 'audio')
    : clearMedia ? null : (editing?.mediaType ?? null);
  const currentMediaSrc = mediaFile
    ? URL.createObjectURL(mediaFile)
    : (!clearMedia && editing?.mediaPath ? mediaUrl(editing.mediaPath) : null);

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function submit(e) {
    e.preventDefault();
    if (!hasValidForm) return;
    setLoading(true);
    setError(null);

    const name    = form.name.trim();
    const saludos = saludosArr.filter((v) => v.trim() !== '');
    const cuerpos = cuerposArr.filter((v) => v.trim() !== '');
    const ctas    = ctasArr.filter((v) => v.trim() !== '');

    try {
      let data;
      if (mediaFile) {
        const fd = new FormData();
        fd.append('name',    name);
        fd.append('saludos', JSON.stringify(saludos.length ? saludos : ['']));
        fd.append('cuerpos', JSON.stringify(cuerpos));
        fd.append('ctas',    JSON.stringify(ctas.length ? ctas : ['']));
        fd.append('media',   mediaFile);
        const res = editing
          ? await api.put(`/api/templates/${editing.id}`, fd)
          : await api.post('/api/templates', fd);
        data = res.data;
      } else {
        const payload = {
          name,
          saludos: saludos.length ? saludos : [''],
          cuerpos,
          ctas:    ctas.length ? ctas : [''],
          ...(clearMedia && editing ? { clearMedia: true } : {}),
        };
        const res = editing
          ? await api.put(`/api/templates/${editing.id}`, payload)
          : await api.post('/api/templates', payload);
        data = res.data;
      }

      setList((prev) =>
        editing
          ? prev.map((t) => (t.id === editing.id ? data : t))
          : [data, ...prev],
      );
      resetForm();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/templates/${deleteTarget.id}`);
      setList((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      if (editing?.id === deleteTarget.id) resetForm();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al eliminar');
    } finally {
      setDeleteTarget(null);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Plantillas</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Estructura tu mensaje en 3 partes: <strong className="text-slate-700">Saludo</strong> → <strong className="text-slate-700">Cuerpo</strong> → <strong className="text-slate-700">CTA</strong>.
            Añade varias opciones por bloque; el sistema elige una al azar en cada envío.
          </p>
        </header>

        {/* ── Form + Preview (two-column) ─────────────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-6 mb-8">

          {/* Left column — form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-slate-50/60 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">{editing ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
              </div>

              <form onSubmit={submit} className="p-5 sm:p-6 space-y-7">

                {/* Nombre */}
                <div>
                  <label htmlFor="tpl-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Nombre de la plantilla
                  </label>
                  <input
                    id="tpl-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: Bienvenida clientes nuevos"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-slate-900 transition-shadow text-sm"
                  />
                </div>

                <hr className="border-slate-100" />

                {/* Bloque 1 — Saludo */}
                <SectionBlock
                  number="1"
                  color="amber"
                  title="Saludo"
                  badge="opcional"
                  onAdd={() => addPart('saludos')}
                  addLabel="Añadir otra variante de saludo"
                >
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd('saludos', e)}>
                    <SortableContext items={form.saludos.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                      {form.saludos.map((part) => (
                        <SortableVariant
                          key={part.id}
                          id={part.id}
                          value={part.value}
                          onChange={(v) => updatePart('saludos', part.id, v)}
                          onRemove={() => removePart('saludos', part.id)}
                          canRemove={form.saludos.length > 1}
                          onFocus={(el) => registerFocus((v) => updatePart('saludos', part.id, v), el)}
                          placeholder="Ej: Hola {{nombre}}"
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </SectionBlock>

                {/* Bloque 2 — Cuerpo */}
                <SectionBlock
                  number="2"
                  color="emerald"
                  title="Cuerpo del mensaje"
                  badge={<span className="text-amber-600 font-medium">obligatorio</span>}
                  onAdd={() => addPart('cuerpos')}
                  addLabel="Añadir otra variante de cuerpo"
                >
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd('cuerpos', e)}>
                    <SortableContext items={form.cuerpos.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                      {form.cuerpos.map((part) => (
                        <SortableVariant
                          key={part.id}
                          id={part.id}
                          value={part.value}
                          multiline
                          onChange={(v) => updatePart('cuerpos', part.id, v)}
                          onRemove={() => removePart('cuerpos', part.id)}
                          canRemove={form.cuerpos.length > 1}
                          onFocus={(el) => registerFocus((v) => updatePart('cuerpos', part.id, v), el)}
                          placeholder="Escribe el cuerpo principal del mensaje..."
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </SectionBlock>

                {/* Bloque 3 — CTA */}
                <SectionBlock
                  number="3"
                  color="slate"
                  title="CTA (llamado a la acción)"
                  badge="opcional"
                  onAdd={() => addPart('ctas')}
                  addLabel="Añadir otra variante de CTA"
                >
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd('ctas', e)}>
                    <SortableContext items={form.ctas.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                      {form.ctas.map((part) => (
                        <SortableVariant
                          key={part.id}
                          id={part.id}
                          value={part.value}
                          onChange={(v) => updatePart('ctas', part.id, v)}
                          onRemove={() => removePart('ctas', part.id)}
                          canRemove={form.ctas.length > 1}
                          onFocus={(el) => registerFocus((v) => updatePart('ctas', part.id, v), el)}
                          placeholder="Ej: Escríbenos al 300 123 4567"
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </SectionBlock>

                <hr className="border-slate-100" />

                {/* Spintax helper */}
                <SpintaxHelper onInsert={insertSpintax} />

                <hr className="border-slate-100" />

                {/* Adjunto */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Imagen o audio adjunto <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT}
                    onChange={(e) => { setMediaFile(e.target.files?.[0] ?? null); setClearMedia(false); }}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-medium hover:file:bg-emerald-100 transition-colors"
                  />
                  {currentMediaSrc && (
                    <div className="mt-2">
                      {currentMediaType === 'image' && (
                        <img src={currentMediaSrc} alt="" className="max-h-36 rounded-xl border border-slate-200 object-contain shadow-sm" onError={(e) => { e.target.style.display = 'none'; }} />
                      )}
                      {currentMediaType === 'audio' && (
                        <audio key={currentMediaSrc} controls src={currentMediaSrc} className="mt-1 w-full h-9 rounded-lg" />
                      )}
                      {editing && !mediaFile && (
                        <button
                          type="button"
                          onClick={() => { setMediaFile(null); setClearMedia(true); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                          className="mt-1.5 text-xs text-red-600 hover:underline"
                        >
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

                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={loading || !hasValidForm}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-sm transition-colors text-sm"
                  >
                    {loading ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear plantilla'}
                  </button>
                  {editing && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-5 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Right column — live preview */}
          <div className="mt-6 lg:mt-0 lg:col-span-1">
            <div className="sticky top-6 space-y-4">

              {/* WhatsApp bubble */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Vista previa</span>
                  {!previewIsEmpty && (
                    <button
                      type="button"
                      onClick={() => setPreviewRandom(buildMessageFromArrays(saludosArr, cuerposArr, ctasArr, {}, false))}
                      className="text-xs font-medium text-emerald-600 hover:underline"
                    >
                      Otra combinación
                    </button>
                  )}
                </div>
                <div className="p-3">
                  <WhatsAppBubble
                    text={previewIsEmpty ? '' : previewText}
                    mediaType={currentMediaType}
                    mediaSrc={currentMediaSrc}
                    empty={previewIsEmpty}
                  />
                </div>
              </div>

              {/* Variables detectadas */}
              {detectedVars.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Variables detectadas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {detectedVars.map((v) => (
                      <span key={v} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-mono">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Contador de caracteres */}
              {charCount > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Caracteres (cuerpo)</span>
                  <span className={`text-sm font-semibold tabular-nums ${charCount > 1000 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {charCount.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Variantes */}
              {(form.saludos.length > 1 || form.cuerpos.length > 1 || form.ctas.length > 1) && (
                <div className="bg-emerald-50 rounded-2xl border border-emerald-100 px-4 py-3">
                  <p className="text-xs text-emerald-700 font-medium">
                    El sistema elegirá <strong>una variante al azar</strong> de cada bloque en cada envío.
                  </p>
                  <div className="flex gap-2 mt-2 text-xs text-emerald-600">
                    {form.saludos.length > 1  && <span>{form.saludos.length} saludos</span>}
                    {form.cuerpos.length > 1  && <span>{form.cuerpos.length} cuerpos</span>}
                    {form.ctas.length > 1     && <span>{form.ctas.length} CTAs</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Templates table ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <h2 className="font-semibold text-slate-800">
              Tus plantillas
              {list.length > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-400">{list.length}</span>
              )}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-5 py-3">Nombre</th>
                  <th className="px-5 py-3 max-w-xs hidden sm:table-cell">Preview</th>
                  <th className="px-5 py-3 w-36">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-slate-400 text-sm">
                      Aún no tienes plantillas. Crea una arriba.
                    </td>
                  </tr>
                )}
                {list.map((t) => {
                  const saludos = Array.isArray(t.saludos) ? t.saludos.filter(Boolean) : [];
                  const cuerpos = Array.isArray(t.cuerpos) ? t.cuerpos.filter(Boolean) : [];
                  const ctas    = Array.isArray(t.ctas)    ? t.ctas.filter(Boolean)    : [];
                  const firstLine = [saludos[0], cuerpos[0], ctas[0]].filter(Boolean).join(' · ');
                  return (
                    <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-800 text-sm">{t.name}</span>
                          {t.mediaType === 'image' && <span className="text-xs text-blue-500 font-medium">🖼</span>}
                          {t.mediaType === 'audio' && <span className="text-xs text-violet-500 font-medium">🎵</span>}
                          <div className="flex gap-1">
                            {saludos.length > 1 && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded">{saludos.length}S</span>}
                            {cuerpos.length > 1 && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded">{cuerpos.length}C</span>}
                            {ctas.length > 1    && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded">{ctas.length}A</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-sm truncate max-w-xs hidden sm:table-cell" title={firstLine}>
                        {firstLine ? `${firstLine.slice(0, 75)}${firstLine.length > 75 ? '…' : ''}` : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setPreviewModal(t)}
                            className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => loadTemplate(t)}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(t)}
                            className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
                          >
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
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      {previewModal  && <PreviewModal template={previewModal} onClose={() => setPreviewModal(null)} />}
      {deleteTarget  && <DeleteModal  name={deleteTarget.name} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}

// ─── Spintax helper (sub-component) ────────────────────────────────────────────
function SpintaxHelper({ onInsert }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  const parts = value.split('/').map((s) => s.trim()).filter(Boolean);
  const canInsert = parts.length >= 2;

  function doInsert() {
    if (!canInsert) return;
    onInsert(`{${parts.join('|')}}`);
    setValue('');
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-slate-700">Palabras alternativas <span className="text-slate-400 font-normal text-xs">(spintax)</span></p>
        <p className="text-xs text-slate-400 mt-0.5">
          Escribe opciones separadas por <strong>/</strong> y haz clic en Insertar. Se añade en el campo donde tengas el cursor.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doInsert(); } }}
          placeholder="Hola / Buenos días / Buenas tardes"
          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-sm bg-white"
        />
        <button
          type="button"
          onClick={doInsert}
          disabled={!canInsert}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex-shrink-0"
        >
          Insertar
        </button>
      </div>
      {canInsert && (
        <p className="text-xs text-amber-600">
          Resultado: <code className="bg-amber-50 border border-amber-200 px-1 rounded font-mono">{`{${parts.join('|')}}`}</code>
        </p>
      )}
    </div>
  );
}
