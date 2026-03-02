import { useState, useEffect, useRef } from 'react';
import api from '../services/api.js';
import { tagChipClass } from '../lib/tagColors.js';

// ---------- Editor de tags inline por contacto ----------
function TagEditor({ listId, item, onUpdated }) {
  const [tags, setTags]     = useState(() => {
    const t = item.tags;
    if (Array.isArray(t)) return t;
    try { return JSON.parse(t || '[]'); } catch (_) { return []; }
  });
  const [input, setInput]   = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef            = useRef(null);

  function addTag(raw) {
    const t = raw.trim().toLowerCase();
    if (!t || tags.includes(t)) { setInput(''); return; }
    const next = [...tags, t];
    setTags(next);
    setInput('');
    save(next);
  }

  function removeTag(t) {
    const next = tags.filter(x => x !== t);
    setTags(next);
    save(next);
  }

  async function save(next) {
    setSaving(true);
    try {
      await api.patch(`/api/lists/${listId}/items/${item.id}/tags`, { tags: next });
      onUpdated(item.id, next);
    } catch (_) {
      // revertir en caso de error
      setTags(tags);
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 items-center min-h-[2rem] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map(t => (
        <span key={t} className={`${tagChipClass(t)} flex items-center gap-1`}>
          {t}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(t); }}
            className="ml-0.5 opacity-60 hover:opacity-100 leading-none"
            aria-label={`Quitar tag ${t}`}
          >×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length ? '' : 'Agregar tag…'}
        className="outline-none text-xs text-slate-600 placeholder-slate-300 bg-transparent min-w-[6rem] flex-1"
        disabled={saving}
      />
      {saving && <span className="text-xs text-slate-400 animate-pulse">guardando…</span>}
    </div>
  );
}

// ---------- Formulario de agregar contacto manual ----------
const EMPTY_FIELDS = [{ key: '', value: '' }, { key: '', value: '' }, { key: '', value: '' }];

function AddContactForm({ listId, onAdded }) {
  const [phone, setPhone]   = useState('');
  const [tags, setTags]     = useState('');
  const [fields, setFields] = useState(EMPTY_FIELDS); // máx 3 campos
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  function setField(idx, prop, val) {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, [prop]: val } : f));
  }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const tagArr = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      // Solo incluir campos que tengan clave Y valor
      const variables = {};
      fields.forEach(({ key, value }) => {
        const k = key.trim().toLowerCase().replace(/\s+/g, '_');
        if (k && value.trim()) variables[k] = value.trim();
      });
      const { data } = await api.post(`/api/lists/${listId}/items`, {
        phone: phone.trim(),
        variables,
        tags: tagArr,
      });
      onAdded(data);
      setPhone('');
      setTags('');
      setFields(EMPTY_FIELDS);
    } catch (error) {
      setErr(error.response?.data?.error || error.message || 'Error al agregar contacto');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Agregar contacto</p>

      {/* Teléfono */}
      <div>
        <label className="block text-xs text-slate-500 mb-1">Teléfono *</label>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+573001234567"
          required
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 bg-white"
        />
      </div>

      {/* Hasta 3 campos personalizados */}
      <div>
        <label className="block text-xs text-slate-500 mb-1.5">
          Datos del contacto <span className="text-slate-400 font-normal">(máx. 3 — para más usa CSV)</span>
        </label>
        <div className="space-y-1.5">
          {fields.map((f, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                value={f.key}
                onChange={e => setField(i, 'key', e.target.value)}
                placeholder={['nombre', 'empresa', 'ciudad'][i]}
                className="w-28 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-400 bg-white text-slate-600 placeholder-slate-300"
              />
              <span className="text-slate-300 self-center text-sm">→</span>
              <input
                value={f.value}
                onChange={e => setField(i, 'value', e.target.value)}
                placeholder={['Ej: María', 'Ej: Acme S.A.', 'Ej: Bogotá'][i]}
                className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-400 bg-white text-slate-700 placeholder-slate-300"
              />
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          El nombre del campo debe coincidir con el usado en la plantilla. Ej: si la plantilla dice <code className="bg-slate-100 px-1 rounded">{'{{nombre}}'}</code>, escribe <strong>nombre</strong> como campo.
        </p>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs text-slate-500 mb-1">
          Tags <span className="text-slate-400 font-normal">(separados por coma)</span>
        </label>
        <input
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="cliente, vip, bogota"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 bg-white"
        />
      </div>

      <button
        type="submit"
        disabled={saving || !phone.trim()}
        className="w-full py-2.5 bg-[#25D366] text-white text-sm font-semibold rounded-xl hover:opacity-95 disabled:opacity-50 transition-all shadow-sm"
      >
        {saving ? 'Agregando…' : '+ Agregar contacto'}
      </button>

      {err && <p className="text-xs text-red-600 font-medium">{err}</p>}
    </form>
  );
}

// Cuenta contactos que tienen un tag
function countContactsWithTag(items, tag) {
  return items.filter(it => {
    try { return JSON.parse(it.tags || '[]').includes(tag); } catch (_) { return false; }
  }).length;
}

// ---------- Panel de gestión de tags ----------
function ManageTagsPanel({ listId, items, allTags, filterTag, setFilterTag, onTagsChanged }) {
  const [renaming, setRenaming]   = useState(null);  // { oldTag, newName }
  const [deleting, setDeleting]  = useState(null);
  const [busy, setBusy]          = useState(false);
  const [error, setError]        = useState('');

  async function handleRename() {
    if (!renaming?.oldTag || !renaming.newName?.trim()) return;
    const newVal = renaming.newName.trim().toLowerCase();
    if (newVal === renaming.oldTag) { setRenaming(null); return; }
    setError('');
    setBusy(true);
    try {
      await api.patch(`/api/lists/${listId}/tags`, { oldTag: renaming.oldTag, newTag: newVal });
      onTagsChanged();
      setFilterTag(prev => prev === renaming.oldTag ? newVal : prev);
      setRenaming(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al renombrar');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setError('');
    setBusy(true);
    try {
      await api.delete(`/api/lists/${listId}/tags`, { data: { tag: deleting } });
      onTagsChanged();
      if (filterTag === deleting) setFilterTag('');
      setDeleting(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar');
    } finally {
      setBusy(false);
    }
  }

  if (allTags.length === 0) return null;

  return (
    <div className="px-6 py-4 border-b border-slate-100 bg-emerald-50/40">
      <div className="mb-3">
        <p className="text-sm font-bold text-slate-800">Etiquetas (tags)</p>
        <p className="text-xs text-slate-500">Elige un grupo para ver, cambiar nombre o borrar.</p>
      </div>

      {/* Renombrar inline */}
      {renaming && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center gap-2">
          <span className="text-sm text-amber-800">Nuevo nombre para <strong>{renaming.oldTag}</strong>:</span>
          <input
            autoFocus
            value={renaming.newName}
            onChange={e => setRenaming(r => ({ ...r, newName: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(null); }}
            placeholder="escribe aqui"
            className="flex-1 min-w-[100px] px-2.5 py-1.5 text-sm border border-amber-200 rounded-lg"
          />
          <button type="button" onClick={handleRename} disabled={busy} className="px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50">Guardar</button>
          <button type="button" onClick={() => setRenaming(null)} className="text-slate-500 text-sm">Cancelar</button>
        </div>
      )}

      {/* Confirmar eliminar */}
      {deleting && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex flex-wrap items-center gap-2">
          <span className="text-sm text-red-800">¿Quitar el tag <strong>{deleting}</strong> de todos los contactos?</span>
          <button type="button" onClick={handleDelete} disabled={busy} className="px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50">Sí, quitar</button>
          <button type="button" onClick={() => setDeleting(null)} className="text-slate-600 text-sm">Cancelar</button>
        </div>
      )}

      {error && <p className="mb-2 text-xs text-red-600 font-medium">{error}</p>}

      <div className="space-y-2">
        {allTags.map(tag => {
          const count = countContactsWithTag(items, tag);
          const active = filterTag === tag;
          return (
            <div
              key={tag}
              className={`flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl border transition-colors ${
                active ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`shrink-0 ${tagChipClass(tag)}`}>{tag}</span>
                <span className="text-xs text-slate-500">{count} contacto{count !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterTag(active ? '' : tag)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-semibold ${
                    active
                      ? 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                      : 'text-[#25D366] bg-emerald-50 hover:bg-emerald-100'
                  }`}
                >
                  {active ? 'Ver todos' : 'Ver solo este'}
                </button>
                <button
                  type="button"
                  onClick={() => setRenaming({ oldTag: tag, newName: tag })}
                  className="text-xs px-2.5 py-1 text-slate-700 bg-slate-100 font-semibold hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cambiar nombre
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(tag)}
                  className="text-xs px-2.5 py-1 text-red-700 bg-red-50 font-semibold hover:bg-red-100 rounded-lg transition-colors"
                >
                  Borrar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Panel lateral de contactos de una lista ----------
function ContactsPanel({ listId, listName, onClose }) {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filterTag, setFilterTag] = useState('');
  const [allTags, setAllTags]     = useState([]);

  function loadList() {
    setLoading(true);
    Promise.all([
      api.get(`/api/lists/${listId}`),
      api.get(`/api/lists/${listId}/tags`),
    ]).then(([listRes, tagsRes]) => {
      setItems(listRes.data.items || []);
      setAllTags(tagsRes.data || []);
    }).catch((err) => console.error('[ContactsPanel] loadList', err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadList();
  }, [listId]);

  function onTagUpdated(itemId, newTags) {
    setItems(prev => prev.map(it => it.id === itemId
      ? { ...it, tags: JSON.stringify(newTags) }
      : it
    ));
    setAllTags(prev => {
      const s = new Set(prev);
      newTags.forEach(t => s.add(t));
      return [...s].sort();
    });
  }

  function onContactAdded(newItem) {
    // Normalizar: el backend devuelve tags como array; guardamos como string para consistencia con getOne
    const tagsStr = Array.isArray(newItem.tags) ? JSON.stringify(newItem.tags) : (newItem.tags || '[]');
    setItems(prev => [...prev, { ...newItem, tags: tagsStr }]);
    const newTags = Array.isArray(newItem.tags) ? newItem.tags : [];
    setAllTags(prev => {
      const s = new Set(prev);
      newTags.forEach(t => s.add(t));
      return [...s].sort();
    });
  }

  async function deleteContact(itemId) {
    if (!confirm('¿Eliminar este contacto de la lista?')) return;
    try {
      await api.delete(`/api/lists/${listId}/items/${itemId}`);
      setItems(prev => prev.filter(it => it.id !== itemId));
    } catch (_) {}
  }

  const visible = filterTag
    ? items.filter(it => {
        try { return JSON.parse(it.tags || '[]').includes(filterTag); } catch (_) { return false; }
      })
    : items;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col h-full overflow-hidden m-4 max-h-[calc(100vh-2rem)]">
        {/* Header fijo */}
        <div className="shrink-0 sticky top-0 z-10 px-6 py-4 border-b border-slate-200 bg-white/95 backdrop-blur-sm flex items-center justify-between shadow-sm rounded-t-xl">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{listName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{items.length} contactos</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none" aria-label="Cerrar">×</button>
        </div>

        {/* Una sola zona de scroll: form + tags + filtro + lista */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AddContactForm listId={listId} onAdded={onContactAdded} />

          <ManageTagsPanel
            listId={listId}
            items={items}
            allTags={allTags}
            filterTag={filterTag}
            setFilterTag={setFilterTag}
            onTagsChanged={loadList}
          />

          {allTags.length > 0 && (
            <div className="px-6 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                {filterTag ? <>Mostrando solo: <strong>{filterTag}</strong></> : 'Mostrando: todos los contactos'}
              </p>
              {filterTag && (
                <button
                  type="button"
                  onClick={() => setFilterTag('')}
                  className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-100"
                >
                  Quitar filtro
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Cargando...</div>
          ) : visible.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Sin contactos{filterTag ? ` con tag "${filterTag}"` : ''}. Usa el formulario de arriba para agregar.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visible.map(item => (
                <div key={item.id} className="px-6 py-3 hover:bg-slate-50/50 transition-colors group">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-mono text-slate-700">{item.phone}</p>
                    <button
                      type="button"
                      onClick={() => deleteContact(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-700 transition-all"
                      title="Eliminar contacto"
                    >
                      Eliminar
                    </button>
                  </div>
                  <TagEditor listId={listId} item={item} onUpdated={onTagUpdated} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-3 border-t border-slate-200 bg-slate-50/80 text-xs text-slate-500 rounded-b-xl">
          Tags: escribe y presiona <kbd className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">Enter</kbd> o <kbd className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">,</kbd> para agregar
        </div>
      </div>
    </div>
  );
}

// ---------- Página principal ----------
export default function ListsPage() {
  const [list, setList]           = useState([]);
  const [uploadName, setUploadName] = useState('');
  const [file, setFile]           = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');
  const [openPanel, setOpenPanel] = useState(null); // { id, name }

  useEffect(() => {
    api.get('/api/lists').then((r) => setList(r.data)).catch(console.error);
  }, []);

  async function upload(e) {
    e.preventDefault();
    if (!file) { setError('Selecciona un CSV'); return; }
    setError('');
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('name', uploadName || file.name.replace(/\.csv$/i, ''));
    try {
      const { data } = await api.post('/api/lists/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setList((prev) => [data, ...prev]);
      setUploadName('');
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir');
    } finally {
      setUploading(false);
    }
  }

  async function remove(id) {
    if (!confirm('¿Eliminar esta lista?')) return;
    try {
      await api.delete(`/api/lists/${id}`);
      setList((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al eliminar');
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-8">Listas de contactos</h1>

      {/* Subir CSV */}
      <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 mb-8">
        <h2 className="font-semibold text-slate-900 tracking-tight mb-1">Subir CSV</h2>
        <p className="text-sm text-slate-500 mb-4">
          Columnas: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">telefono</code> y opcionales (ej: nombre, empresa).
          Agrega una columna <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">tags</code> con valores separados por coma para etiquetar cada contacto. Máx. 100 filas.
        </p>
        <form onSubmit={upload} className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="list-name" className="block text-sm font-semibold text-slate-700 mb-2">Nombre de la lista</label>
            <input
              id="list-name"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl w-48 focus:ring-2 focus:ring-green-500/25 focus:border-green-500"
              placeholder="Ej: Clientes 2025"
            />
          </div>
          <div>
            <label htmlFor="list-csv" className="block text-sm font-semibold text-slate-700 mb-2">Archivo CSV</label>
            <input id="list-csv" type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0])} className="block text-sm" />
          </div>
          <button type="submit" disabled={uploading} className="px-5 py-2.5 bg-[#25D366] text-white font-semibold rounded-xl hover:opacity-95 disabled:opacity-50 shadow-md transition-all">
            Subir
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600 font-medium" role="alert">{error}</p>}
      </div>

      {/* Tabla de listas */}
      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="p-4">Nombre</th>
              <th className="p-4">Contactos</th>
              <th className="p-4 w-28">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-400 text-sm">No hay listas aún. Sube un CSV para comenzar.</td>
              </tr>
            )}
            {list.map((l) => (
              <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                <td className="p-4">
                  <button
                    type="button"
                    onClick={() => setOpenPanel({ id: l.id, name: l.name })}
                    className="font-medium text-slate-800 hover:text-[#25D366] transition-colors text-left"
                  >
                    {l.name}
                  </button>
                </td>
                <td className="p-4 text-slate-700">{l.itemCount ?? l._count?.items ?? '-'}</td>
                <td className="p-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenPanel({ id: l.id, name: l.name })}
                    className="text-[#25D366] font-medium hover:text-emerald-600 transition-colors text-sm"
                  >
                    Tags
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(l.id)}
                    className="text-red-600 font-medium hover:text-red-700 transition-colors text-sm"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Panel lateral de contactos */}
      {openPanel && (
        <ContactsPanel
          listId={openPanel.id}
          listName={openPanel.name}
          onClose={() => setOpenPanel(null)}
        />
      )}
    </div>
  );
}
