import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import api from '../services/api.js';

const COLORS = { SENT: '#22c55e', FAILED: '#ef4444', CANCELLED: '#94a3b8' };

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [distribution, setDistribution] = useState({ SENT: 0, FAILED: 0, CANCELLED: 0 });
  const [recentLogs, setRecentLogs] = useState([]);

  useEffect(() => {
    api.get('/api/dashboard/summary').then((r) => setSummary(r.data)).catch(console.error);
    api.get('/api/dashboard/chart/daily').then((r) => setDaily(r.data)).catch(console.error);
    api.get('/api/dashboard/chart/status-distribution').then((r) => setDistribution(r.data)).catch(console.error);
    api.get('/api/dashboard/recent-logs?limit=20').then((r) => setRecentLogs(r.data)).catch(console.error);
  }, []);

  const pieData = [
    { name: 'Enviados', value: distribution.SENT, color: COLORS.SENT },
    { name: 'Fallidos', value: distribution.FAILED, color: COLORS.FAILED },
    { name: 'Cancelados', value: distribution.CANCELLED, color: COLORS.CANCELLED },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-8">Panel de Control</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mb-10">
        <div className="bg-white rounded-2xl shadow-card p-5 border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Enviados hoy</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{summary?.sentToday ?? '-'}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5 border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fallidos hoy</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{summary?.failedToday ?? '-'}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5 border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tasa de éxito hoy</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{summary?.successRateToday ?? 0}%</p>
        </div>
        <div className="bg-gradient-to-br from-[#25D366] to-emerald-600 rounded-2xl shadow-card p-5 border border-emerald-500/20">
          <p className="text-xs font-semibold text-white/90 uppercase tracking-wider">Envíos totales</p>
          <p className="text-2xl font-bold text-white mt-1">
            {summary?.totalSentAllTime != null
              ? summary.totalSentAllTime.toLocaleString('es')
              : '-'}
          </p>
          <p className="text-xs text-white/80 mt-1">Acumulado histórico</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5 border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">WhatsApp</p>
          <p className="text-lg font-semibold mt-1">
            <span className={summary?.waStatus === 'connected' ? 'text-emerald-600' : 'text-slate-500'}>
              {summary?.waStatus === 'connected' ? 'Conectado' : summary?.waStatus || 'Desconectado'}
            </span>
          </p>
          {summary?.waPhone && <p className="text-sm text-slate-500 mt-0.5">{summary.waPhone}</p>}
        </div>
        {summary?.usage24h != null && (
          <div className="bg-white rounded-2xl shadow-card p-5 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mensajes restantes (24 h)</p>
            <p className="text-2xl font-bold mt-1">
              <span className={summary.usage24h.remaining24h === 0 ? 'text-red-600' : 'text-slate-900'}>
                {summary.usage24h.remaining24h}
              </span>
              <span className="text-slate-400 font-normal"> / {summary.usage24h.limit24h}</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">ventana móvil de 24 horas</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="bg-white rounded-2xl shadow-card p-6 border border-slate-100">
          <h2 className="font-semibold text-slate-900 tracking-tight mb-5">Mensajes por día (últimos 30)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="sent" stroke="#22c55e" name="Enviados" strokeWidth={2} />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" name="Fallidos" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-6 border border-slate-100">
          <h2 className="font-semibold text-slate-900 tracking-tight mb-5">Estado de envíos</h2>
          <div className="h-64 flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={(e) => `${e.name}: ${e.value}`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400">Sin datos aún</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 tracking-tight">Últimos logs</h2>
          <Link to="/logs" className="text-sm font-medium text-[#25D366] hover:text-emerald-600 transition-colors">Ver todos</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                <th className="py-3 px-6">Teléfono</th>
                <th className="py-3 px-6">Estado</th>
                <th className="py-3 px-6">Fecha</th>
                <th className="py-3 px-6">Error</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-slate-400 text-center">Sin registros</td></tr>
              )}
              {recentLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                  <td className="py-3 px-6 font-mono text-slate-800">{log.phone}</td>
                  <td className="py-3 px-6">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${log.status === 'SENT' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-6 text-slate-500 truncate max-w-xs">{log.errorMessage || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
