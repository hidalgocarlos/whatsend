import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { resolveMessage } from '../lib/templateUtils.js';
import { tagChipClass, tagColor } from '../lib/tagColors.js';

const AVG_DELAY_S = 45;

function formatDuration(totalSeconds) {
  if (totalSeconds < 60) return `${totalSeconds} seg`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m < 60) return s > 0 ? `${m} min ${s} seg` : `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h} h ${rm} min` : `${h} h`;
}

function formatLocalDatetime(date) {
  return date.toLocaleString('es-CO', {
    weekday: 'short', year: 'numeric', month: 'short',
    day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function minDatetimeLocal() {
  const d = new Date(Date.now() + 2 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewCampaignPage() {
  const [templates, setTemplates]           = useState([]);
  const [lists, setLists]                   = useState([]);
  const [templateId, setTemplateId]         = useState('');
  const [contactListId, setContactListId]   = useState('');
  const [scheduledAt, setScheduledAt]       = useState('');
  const [availableTags, setAvailableTags]   = useState([]);   // tags de la lista seleccionada
  const [selectedTags, setSelectedTags]     = useState([]);   // tags activos como filtro
  const [allListItems, setAllListItems]     = useState([]);   // todos los items de la lista
  const [preview, setPreview]               = useState(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState(null);
  const [usage24h, setUsage24h]             = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/templates').then((r) => setTemplates(r.data)).catch(console.error);
    api.get('/api/lists').then((r) => setLists(r.data)).catch(console.error);
    api.get('/api/dashboard/usage').then((r) => setUsage24h(r.data)).catch(() => setUsage24h(null));
  }, []);

  // Cuando cambia la lista: cargar items y tags disponibles
  useEffect(() => {
    if (!contactListId) {
      setAvailableTags([]);
      setSelectedTags([]);
      setAllListItems([]);
      return;
    }
    const listId = Number(contactListId);
    Promise.all([
      api.get(`/api/lists/${listId}`),
      api.get(`/api/lists/${listId}/tags`),
    ]).then(([listRes, tagsRes]) => {
      setAllListItems(listRes.data.items || []);
      setAvailableTags(tagsRes.data || []);
      setSelectedTags([]); // resetear filtro al cambiar de lista
    }).catch(console.error);
  }, [contactListId]);

  // Calcular items filtrados por tags seleccionados
  const filteredItems = selectedTags.length > 0
    ? allListItems.filter(item => {
        let itemTags = [];
        try { itemTags = JSON.parse(item.tags || '[]'); } catch (_) {}
        return itemTags.some(t => selectedTags.includes(t));
      })
    : allListItems;

  // Construir preview cuando cambian plantilla, lista o tags seleccionados
  useEffect(() => {
    if (!templateId || !contactListId || filteredItems.length === 0) { setPreview(null); return; }
    const t = templates.find((x) => x.id === Number(templateId));
    if (!t) { setPreview(null); return; }

        const first = filteredItems[0];
        const firstVars = typeof first.variables === 'string'
          ? JSON.parse(first.variables || '{}')
          : first.variables || {};
        const totalSeconds = (filteredItems.length - 1) * AVG_DELAY_S;
        setPreview({
          samples: [{ phone: first.phone, body: resolveMessage(t.body, firstVars) }],
          total: filteredItems.length,
          mediaType: t.mediaType || null,
          mediaName: t.mediaName || null,
          estimatedSeconds: totalSeconds,
          hasSpintax: t.body?.includes('{') && t.body?.includes('|'),
        });
  }, [templateId, contactListId, filteredItems.length, templates]);

  function toggleTag(tag) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  function getEstimatedFinish() {
    if (!preview) return null;
    const base = scheduledAt ? new Date(scheduledAt).getTime() : Date.now();
    return new Date(base + preview.estimatedSeconds * 1000);
  }

  async function submit(e) {
    e.preventDefault();
    if (!templateId || !contactListId) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        templateId: Number(templateId),
        contactListId: Number(contactListId),
      };
      if (scheduledAt)          payload.scheduledAt = new Date(scheduledAt).toISOString();
      if (selectedTags.length)  payload.tagFilter   = selectedTags;
      const { data } = await api.post('/api/campaigns', payload);
      navigate(`/campaigns/${data.campaignId}`);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al crear la campaña';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const remaining       = usage24h?.remaining24h ?? null;
  const overLimit       = preview && remaining != null && preview.total > remaining;
  const estimatedFinish = getEstimatedFinish();
  const isScheduled     = !!scheduledAt;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight mb-8">Nueva campaña</h1>

      {/* Cupo 24 h */}
      {usage24h != null && (
        <div className={`mb-6 p-4 border rounded-2xl text-sm font-medium ${
          usage24h.remaining24h <= 10
            ? 'bg-red-50/90 border-red-100 text-red-700'
            : 'bg-blue-50/80 border-blue-100 text-blue-700'
        }`}>
          <strong>Límite 24 h:</strong> te quedan <strong>{usage24h.remaining24h}</strong> de {usage24h.limit24h} mensajes (ventana móvil de 24 horas).
        </div>
      )}

      <form onSubmit={submit} className="bg-white rounded-2xl shadow-card border border-slate-100 p-8 space-y-5 transition-shadow duration-200 hover:shadow-card-hover">
        {/* Plantilla */}
        <div>
          <label htmlFor="campaign-template" className="block text-sm font-semibold text-slate-700 mb-2">Plantilla</label>
          <select
            id="campaign-template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 transition-shadow"
            required
          >
            <option value="">Selecciona una plantilla</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.mediaType ? ` · 📎 ${t.mediaType}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Lista de contactos */}
        <div>
          <label htmlFor="campaign-list" className="block text-sm font-semibold text-slate-700 mb-2">Lista de contactos</label>
          <select
            id="campaign-list"
            value={contactListId}
            onChange={(e) => setContactListId(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 transition-shadow"
            required
          >
            <option value="">Selecciona una lista</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({(l.itemCount ?? l._count?.items ?? 0)} contactos)
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por tags — solo aparece si la lista tiene tags */}
        {availableTags.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Filtrar por tags{' '}
              <span className="font-normal text-slate-400">
                (opcional — sin selección = todos los {allListItems.length} contactos)
              </span>
            </label>
            <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-xl bg-slate-50/50">
              {availableTags.map(tag => {
                const active = selectedTags.includes(tag);
                const c = tagColor(tag);
                const count = allListItems.filter(it => {
                  try { return JSON.parse(it.tags || '[]').includes(tag); } catch (_) { return false; }
                }).length;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                      active
                        ? `${c.bg} ${c.text} ${c.border} ring-2 ring-offset-1 ${c.dot.replace('bg-', 'ring-')}`
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {tag}
                    <span className={`${active ? 'opacity-70' : 'text-slate-400'} font-normal`}>{count}</span>
                  </button>
                );
              })}
            </div>
            {selectedTags.length > 0 && (
              <p className="mt-1.5 text-xs text-slate-500">
                {filteredItems.length} contacto{filteredItems.length !== 1 ? 's' : ''} con{' '}
                {selectedTags.length === 1 ? `el tag "${selectedTags[0]}"` : `los tags: ${selectedTags.join(', ')}`}
              </p>
            )}
          </div>
        )}

        {/* Programar envío */}
        <div>
          <label htmlFor="campaign-scheduled" className="block text-sm font-semibold text-slate-700 mb-2">
            Programar envío <span className="font-normal text-slate-400">(opcional — déjalo vacío para enviar ahora)</span>
          </label>
          <input
            id="campaign-scheduled"
            type="datetime-local"
            value={scheduledAt}
            min={minDatetimeLocal()}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 transition-shadow"
          />
          {scheduledAt && (
            <p className="mt-1.5 text-xs text-slate-500">
              Los mensajes comenzarán a enviarse el <strong>{formatLocalDatetime(new Date(scheduledAt))}</strong>.
            </p>
          )}
        </div>

        {/* Preview */}
        {preview && (
          <div className={`rounded-2xl border text-sm overflow-hidden ${overLimit ? 'border-red-200 bg-red-50/60' : 'border-slate-200 bg-slate-50/60'}`}>
            <div className="grid grid-cols-3 divide-x divide-slate-100">
              <div className="px-4 py-3 text-center">
                <p className="text-xl font-bold text-slate-800">{preview.total}</p>
                <p className="text-xs text-slate-500 mt-0.5">Mensajes</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-sm font-bold text-slate-800 leading-tight">{formatDuration(preview.estimatedSeconds)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Duración est.</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-sm font-bold text-slate-800 leading-tight">
                  {estimatedFinish ? estimatedFinish.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Fin estimado</p>
              </div>
            </div>

            <div className="border-t border-slate-100 px-5 py-4 space-y-3">
              {preview.mediaType && (
                <div className="flex items-center gap-2 text-slate-600 text-xs">
                  <span>{preview.mediaType === 'image' ? '🖼️' : '🎵'}</span>
                  <span className="font-medium capitalize">{preview.mediaType}</span>
                  {preview.mediaName && <span className="text-slate-400 truncate max-w-xs">· {preview.mediaName}</span>}
                </div>
              )}
              <div className="bg-white rounded-xl border border-slate-100 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vista previa del mensaje</p>
                  {preview.hasSpintax && (
                    <span className="text-xs text-violet-500 font-medium">varía por envío (spintax)</span>
                  )}
                </div>
                <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{preview.samples[0]?.body}</p>
              </div>
              {isScheduled && estimatedFinish && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-blue-800 text-xs font-medium">
                  <span>🗓️</span>
                  <span>Inicio: <strong>{formatLocalDatetime(new Date(scheduledAt))}</strong> · Fin aprox.: <strong>{formatLocalDatetime(estimatedFinish)}</strong></span>
                </div>
              )}
            </div>

            {overLimit && (
              <div className="mx-5 mb-4 px-4 py-3 bg-red-100 border border-red-200 rounded-xl text-red-700 font-semibold text-xs">
                ⚠️ Esta campaña supera tu cupo. Quedan <strong>{remaining}</strong> envíos disponibles en las próximas 24 h.
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50/90 border border-red-100 rounded-2xl text-sm text-red-700 font-medium" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !templateId || !contactListId || overLimit}
          className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl disabled:opacity-50 transition-all duration-200 shadow-card focus:ring-2 focus:ring-primary/30 focus:ring-offset-2"
        >
          {loading
            ? 'Procesando...'
            : overLimit
              ? 'Superas el límite de 24 h'
              : isScheduled
                ? `Programar envío para ${new Date(scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
                : 'Iniciar envío ahora'}
        </button>
      </form>
    </div>
  );
}
