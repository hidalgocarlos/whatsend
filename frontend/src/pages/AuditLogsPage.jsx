import { useState, useEffect } from 'react';
import api from '../services/api.js';

export default function AuditLogsPage() {
  const [items, setItems] = useState([]);
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ limit: 100 });
    if (action) params.set('action', action);
    if (userId) params.set('userId', userId);
    api.get(`/api/logs/audit?${params}`).then((r) => setItems(r.data.items || [])).catch(console.error);
  }, [action, userId]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight mb-8">Auditoría</h1>

      <div className="flex gap-3 mb-6">
        <input placeholder="Filtrar por acción" value={action} onChange={(e) => setAction(e.target.value)} className="px-4 py-2.5 border border-slate-200 rounded-xl w-48 focus:ring-2 focus:ring-green-500/25 focus:border-green-500 text-slate-800" />
        <input placeholder="ID usuario" type="number" value={userId} onChange={(e) => setUserId(e.target.value)} className="px-4 py-2.5 border border-slate-200 rounded-xl w-28 focus:ring-2 focus:ring-green-500/25 focus:border-green-500 text-slate-800" />
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden transition-shadow duration-200 hover:shadow-card-hover">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Fecha</th>
                <th className="p-4">Usuario</th>
                <th className="p-4">Acción</th>
                <th className="p-4">Recurso</th>
                <th className="p-4">IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                  <td className="p-4 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="p-4 text-slate-800">{log.user?.name ?? log.userId}</td>
                  <td className="p-4 font-medium text-slate-800">{log.action}</td>
                  <td className="p-4 text-slate-700">{log.resource}{log.resourceId ? ` #${log.resourceId}` : ''}</td>
                  <td className="p-4 text-slate-500">{log.ip || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
