import { useState, useEffect } from 'react';
import api from '../services/api.js';

export default function SendLogsPage() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [campaignId, setCampaignId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ page, limit: 30 });
    if (status) params.set('status', status);
    if (campaignId) params.set('campaignId', campaignId);
    api.get(`/api/logs/send?${params}`).then((r) => setData(r.data)).catch(console.error);
  }, [page, status, campaignId]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-8">Logs de envío</h1>

      <div className="flex gap-3 mb-6">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 text-slate-800">
          <option value="">Todos los estados</option>
          <option value="SENT">Enviados</option>
          <option value="FAILED">Fallidos</option>
          <option value="CANCELLED">Cancelados</option>
        </select>
        <input
          type="number"
          placeholder="ID campaña"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl w-32 focus:ring-2 focus:ring-green-500/25 focus:border-green-500"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Teléfono</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Campaña</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">Error</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                  <td className="p-4 font-mono text-slate-800">{log.phone}</td>
                  <td className="p-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${log.status === 'SENT' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="p-4 text-slate-800">{log.campaignId}</td>
                  <td className="p-4 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="p-4 text-slate-500 max-w-xs truncate">{log.errorMessage || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/30">
          <span className="text-sm font-medium text-slate-500">Total: {data.total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">Anterior</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 30 >= data.total} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
}
