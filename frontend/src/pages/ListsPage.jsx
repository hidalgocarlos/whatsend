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

// ---------- Formulario agregar 1 a 3 contactos (nombre, teléfono, correo; solo teléfono obligatorio) ----------
const EMPTY_ROW = { name: '', phone: '', email: '' };

function AddContactForm({ listId, onAdded }) {
  const [rows, setRows] = useState([{ ...EMPTY_ROW }]); // 1 a 3 filas
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function setRow(idx, field, value) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  function addRow() {
    if (rows.length >= 3) return;
    setRows(prev => [...prev, { ...EMPTY_ROW }]);
  }

  function removeRow(idx) {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== idx));
  }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const tagArr = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    const toAdd = rows
      .map(r => ({ name: r.name.trim(), phone: r.phone.trim(), email: r.email.trim() }))
      .filter(r => r.phone);
    if (!toAdd.length) {
      setErr('Indica al menos un teléfono.');
      return;
    }
    if (toAdd.length > 3) {
      setErr('Máximo 3 contactos por envío.');
      return;
    }
    setSaving(true);
    try {
      for (const contact of toAdd) {
        const { data } = await api.post(`/api/lists/${listId}/items`, {
          phone: contact.phone,
          name: contact.name || undefined,
          email: contact.email || undefined,
          tags: tagArr,
        });
        onAdded(data);
      }
      setRows([{ ...EMPTY_ROW }]);
      setTags('');
    } catch (error) {
      setErr(error.response?.data?.error || error.message || 'Error al agregar contacto(s)');
    } finally {
      setSaving(false);
    }
  }

  const hasAnyPhone = rows.some(r => r.phone.trim());

  return (
    <form onSubmit={submit} className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Agregar contactos</p>
        <span className="text-xs text-slate-400">Máx. 3 a la vez · solo teléfono obligatorio</span>
      </div>

      {rows.map((row, idx) => (
        <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
          <div className="sm:col-span-3">
            <label className="block text-xs text-slate-500 mb-1">Nombre</label>
            <input
              value={row.name}
              onChange={e => setRow(idx, 'name', e.target.value)}
              placeholder="Opcional"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 bg-white"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="block text-xs text-slate-500 mb-1">Teléfono *</label>
            <input
              value={row.phone}
              onChange={e => setRow(idx, 'phone', e.target.value)}
              placeholder="+573001234567"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 bg-white"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="block text-xs text-slate-500 mb-1">Correo</label>
            <input
              type="email"
              value={row.email}
              onChange={e => setRow(idx, 'email', e.target.value)}
              placeholder="Opcional"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 bg-white"
            />
          </div>
          <div className="sm:col-span-1 flex gap-1 justify-end">
            {rows.length > 1 && (
              <button type="button" onClick={() => removeRow(idx)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg" title="Quitar fila">−</button>
            )}
            {idx === rows.length - 1 && rows.length < 3 && (
              <button type="button" onClick={addRow} className="p-2 text-slate-400 hover:text-[#25D366] rounded-lg" title="Añadir otra fila">+</button>
            )}
          </div>
        </div>
      ))}

      <div>
        <label className="block text-xs text-slate-500 mb-1">Tags <span className="text-slate-400">(opcional, separados por coma)</span></label>
        <input
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="cliente, vip, origen-web"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 bg-white"
        />
      </div>

      <button
        type="submit"
        disabled={saving || !hasAnyPhone}
        className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-all duration-200 shadow-card"
      >
        {saving ? 'Agregando…' : `+ Agregar ${rows.filter(r => r.phone.trim()).length || 1} contacto(s)`}
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

// ---------- Menú completo de tags: ver, filtrar, renombrar, eliminar ----------
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

  return (
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-800">Gestión de tags</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Agrupa e identifica contactos por origen o tipo. Asigna tags al agregar contactos o en cada fila debajo.
        </p>
        {allTags.length > 0 && (
          <p className="text-xs text-slate-500 mt-1">
            <strong>{allTags.length}</strong> tag{allTags.length !== 1 ? 's' : ''} en esta lista
          </p>
        )}
      </div>

      {/* Renombrar tag */}
      {renaming && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center gap-3">
          <span className="text-sm text-amber-800">Renombrar <strong>{renaming.oldTag}</strong> a:</span>
          <input
            autoFocus
            value={renaming.newName}
            onChange={e => setRenaming(r => ({ ...r, newName: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(null); }}
            placeholder="nuevo nombre"
            className="flex-1 min-w-[120px] px-3 py-2 text-sm border border-amber-200 rounded-lg bg-white"
          />
          <div className="flex gap-2">
            <button type="button" onClick={handleRename} disabled={busy} className="px-3 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50">Guardar</button>
            <button type="button" onClick={() => setRenaming(null)} className="px-3 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
          </div>
        </div>
      )}

      {/* Confirmar eliminar tag */}
      {deleting && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-wrap items-center gap-3">
          <span className="text-sm text-red-800">¿Quitar el tag <strong>{deleting}</strong> de todos los contactos que lo tengan?</span>
          <div className="flex gap-2">
            <button type="button" onClick={handleDelete} disabled={busy} className="px-3 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50">Sí, quitar</button>
            <button type="button" onClick={() => setDeleting(null)} className="px-3 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
          </div>
        </div>
      )}

      {error && <p className="mb-3 text-xs text-red-600 font-medium" role="alert">{error}</p>}

      {allTags.length === 0 ? (
        <div className="py-6 px-4 rounded-xl border border-dashed border-slate-200 bg-white text-center">
          <p className="text-sm text-slate-500">Aún no hay tags en esta lista.</p>
          <p className="text-xs text-slate-400 mt-1">Asigna tags al agregar contactos (campo Tags) o hazlo en cada contacto más abajo.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {allTags.map(tag => {
            const count = countContactsWithTag(items, tag);
            const active = filterTag === tag;
            return (
              <div
                key={tag}
                className={`flex flex-wrap items-center justify-between gap-3 py-3 px-4 rounded-xl border transition-colors ${
                  active ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 ${tagChipClass(tag)}`}>{tag}</span>
                  <span className="text-xs text-slate-500">{count} contacto{count !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFilterTag(active ? '' : tag)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                      active
                        ? 'text-slate-700 bg-slate-200 hover:bg-slate-300'
                        : 'text-[#25D366] bg-emerald-100 hover:bg-emerald-200 border border-emerald-200'
                    }`}
                  >
                    {active ? 'Ver todos' : 'Ver contactos'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenaming({ oldTag: tag, newName: tag })}
                    className="text-xs px-3 py-1.5 text-slate-700 bg-slate-100 font-semibold hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors"
                  >
                    Renombrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(tag)}
                    className="text-xs px-3 py-1.5 text-red-700 bg-red-50 font-semibold hover:bg-red-100 rounded-lg border border-red-100 transition-colors"
                  >
                    Eliminar tag
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
              {visible.map(item => {
                let vars = {};
                try { vars = typeof item.variables === 'string' ? JSON.parse(item.variables || '{}') : (item.variables || {}); } catch (_) {}
                const nombre = vars.nombre || vars.name || '';
                const correo = vars.correo || vars.email || '';
                return (
                  <div key={item.id} className="px-6 py-3 hover:bg-slate-50/50 transition-colors group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="min-w-0">
                        <p className="text-sm font-mono text-slate-700">{item.phone}</p>
                        {(nombre || correo) && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {nombre}{nombre && correo ? ' · ' : ''}{correo}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteContact(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-700 transition-all shrink-0"
                        title="Eliminar contacto"
                      >
                        Eliminar
                      </button>
                    </div>
                    <TagEditor listId={listId} item={item} onUpdated={onTagUpdated} />
                  </div>
                );
              })}
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
      <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight mb-8">Listas de contactos</h1>

      {/* Subir CSV */}
      <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 mb-8 transition-shadow duration-200 hover:shadow-card-hover">
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
          <button type="submit" disabled={uploading} className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl disabled:opacity-50 shadow-card transition-all duration-200">
            Subir
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600 font-medium" role="alert">{error}</p>}
      </div>

      {/* Tabla de listas */}
      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden transition-shadow duration-200 hover:shadow-card-hover">
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
