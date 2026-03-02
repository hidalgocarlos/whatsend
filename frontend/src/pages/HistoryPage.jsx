import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import { downloadCampaignExport } from '../lib/download.js';

export default function HistoryPage() {
  const [data, setData] = useState({ items: [], total: 0, page: 1, limit: 10 });
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get(`/api/campaigns?page=${page}&limit=10`).then((r) => setData(r.data)).catch(console.error);
  }, [page]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-8">Historial de campañas</h1>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="p-4">ID</th>
              <th className="p-4">Plantilla</th>
              <th className="p-4">Lista</th>
              <th className="p-4">Enviados / Fallidos</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Programada</th>
              <th className="p-4">Creada</th>
              <th className="p-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                <td className="p-4 font-mono text-slate-800">{c.id}</td>
                <td className="p-4 text-slate-800">{c.template?.name}</td>
                <td className="p-4 text-slate-800">{c.contactList?.name}</td>
                <td className="p-4 text-slate-700">{c.sentCount} / {c.failedCount}</td>
                <td className="p-4">
                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    c.status === 'COMPLETED'  ? 'bg-emerald-50 text-emerald-700' :
                    c.status === 'RUNNING'    ? 'bg-amber-50 text-amber-700' :
                    c.status === 'SCHEDULED'  ? 'bg-blue-50 text-blue-700' :
                    c.status === 'FAILED'     ? 'bg-red-50 text-red-700' :
                    c.status === 'CANCELLED'  ? 'bg-slate-100 text-slate-500' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {c.status === 'SCHEDULED'  ? '🗓️ Programada' :
                     c.status === 'COMPLETED'  ? 'Completada' :
                     c.status === 'RUNNING'    ? 'En curso' :
                     c.status === 'FAILED'     ? 'Fallida' :
                     c.status === 'CANCELLED'  ? 'Cancelada' :
                     c.status}
                  </span>
                </td>
                <td className="p-4 text-slate-500 text-sm">
                  {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : <span className="text-slate-300">—</span>}
                </td>
                <td className="p-4 text-slate-500 text-sm">{new Date(c.createdAt).toLocaleString()}</td>
                <td className="p-4">
                  <Link to={`/campaigns/${c.id}`} className="font-medium text-[#25D366] hover:text-emerald-600 transition-colors">Ver</Link>
                  {' · '}
                  <button type="button" onClick={() => downloadCampaignExport(c.id)} className="font-medium text-[#25D366] hover:text-emerald-600 transition-colors">CSV</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/30">
          <span className="text-sm font-medium text-slate-500">Total: {data.total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">Anterior</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * data.limit >= data.total} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
}
