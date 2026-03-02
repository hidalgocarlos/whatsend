import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { getAccessToken } from '../services/api.js';
import { downloadCampaignExport } from '../lib/download.js';

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, pending: 0, total: 0, status: '' });
  const eventSourceRef = useRef(null);
  const refreshTimerRef = useRef(null);

  function loadCampaign() {
    setLoadError(false);
    return api.get(`/api/campaigns/${id}`).then((r) => {
      setCampaign(r.data);
      setRecipients(r.data.recipients || []);
      setProgress({
        sent: r.data.sentCount,
        failed: r.data.failedCount,
        pending: r.data.totalRecipients - r.data.sentCount - r.data.failedCount,
        total: r.data.totalRecipients,
        status: r.data.status,
      });
    }).catch(() => { setCampaign(null); setLoadError(true); });
  }

  useEffect(() => {
    loadCampaign();
  }, [id]);

  useEffect(() => {
    if (!id || campaign?.status === 'COMPLETED' || campaign?.status === 'CANCELLED' || campaign?.status === 'FAILED') return;
    const token = getAccessToken();
    const base = import.meta.env.VITE_API_URL || '';
    const url = `${base}/api/campaigns/${id}/events${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        setProgress(data);
        // Refrescar destinatarios con debounce para ver errores actualizados
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          api.get(`/api/campaigns/${id}`).then((r) => {
            setRecipients(r.data.recipients || []);
          }).catch(() => {});
        }, 1500);
      } catch (_) {}
    });
    es.onerror = () => es.close();
    return () => {
      es.close();
      clearTimeout(refreshTimerRef.current);
    };
  }, [id, campaign?.status]);

  async function cancel() {
    if (!confirm('¿Cancelar esta campaña?')) return;
    try {
      await api.delete(`/api/campaigns/${id}`);
      setProgress((p) => ({ ...p, status: 'CANCELLED' }));
    } catch (err) {
      console.error('[campaign cancel]', err);
    }
  }

  if (!campaign && !loadError) return <div className="p-8 text-slate-500 font-medium">Cargando...</div>;
  if (loadError) return <div className="p-8 text-red-600 font-medium">No se pudo cargar la campaña. <button onClick={loadCampaign} className="underline text-[#25D366] hover:text-emerald-600">Reintentar</button></div>;

  const sentPct   = progress.total ? Math.round((progress.sent   / progress.total) * 100) : 0;
  const failedPct = progress.total ? Math.round((progress.failed / progress.total) * 100) : 0;
  const isScheduled = progress.status === 'SCHEDULED';

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Campaña #{campaign.id}</h1>
        <Link to="/campaigns" className="font-medium text-[#25D366] hover:text-emerald-600 transition-colors">Ver historial</Link>
      </div>

      {/* Banner de campaña programada */}
      {isScheduled && campaign.scheduledAt && (
        <div className="mb-6 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 text-blue-800">
          <span className="text-2xl">🗓️</span>
          <div>
            <p className="font-semibold text-sm">Campaña programada</p>
            <p className="text-xs mt-0.5">
              Los mensajes comenzarán a enviarse el{' '}
              <strong>{new Date(campaign.scheduledAt).toLocaleString()}</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 mb-8">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <p className="text-2xl font-bold text-emerald-700">{progress.sent}</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Enviados</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-2xl border border-red-100">
            <p className="text-2xl font-bold text-red-700">{progress.failed}</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Fallidos</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-2xl font-bold text-slate-700">{progress.pending}</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Pendientes</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-2xl font-bold text-slate-900">{progress.total}</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Total</p>
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
          <div className="bg-emerald-500 h-3 transition-all rounded-l-full" style={{ width: `${sentPct}%` }} />
          <div className="bg-red-400 h-3 transition-all rounded-r-full" style={{ width: `${failedPct}%` }} />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-600">
          Estado:{' '}
          <span className={
            progress.status === 'COMPLETED' ? 'text-emerald-600' :
            progress.status === 'FAILED' || progress.status === 'CANCELLED' ? 'text-red-600' :
            progress.status === 'SCHEDULED' ? 'text-blue-600' :
            'text-amber-600'
          }>
            {progress.status === 'SCHEDULED' ? '🗓️ Programada' :
             progress.status === 'COMPLETED' ? 'Completada' :
             progress.status === 'RUNNING'   ? 'En curso' :
             progress.status === 'FAILED'    ? 'Fallida' :
             progress.status === 'CANCELLED' ? 'Cancelada' :
             progress.status}
          </span>
        </p>
        {(progress.status === 'RUNNING' || progress.status === 'PENDING' || progress.status === 'SCHEDULED') && (
          <button onClick={cancel} className="mt-4 px-5 py-2.5 border-2 border-red-200 text-red-600 font-semibold rounded-xl hover:bg-red-50 transition-colors">
            Cancelar campaña
          </button>
        )}
        {(progress.status === 'COMPLETED' || progress.status === 'CANCELLED') && (
          <button onClick={() => downloadCampaignExport(id)} className="mt-4 px-5 py-2.5 bg-slate-100 text-slate-800 font-semibold rounded-xl hover:bg-slate-200 transition-colors">
            Exportar CSV
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
        <h2 className="px-6 py-4 font-semibold text-slate-900 border-b border-slate-100">Destinatarios</h2>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 sticky top-0">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Teléfono</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Error</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                  <td className="p-4 font-mono text-slate-800">{r.phone}</td>
                  <td className="p-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${r.status === 'SENT' ? 'bg-emerald-50 text-emerald-700' : r.status === 'FAILED' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500 text-xs max-w-xs truncate">{r.errorMsg || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
