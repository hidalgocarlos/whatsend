import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore.js';
import api from '../services/api.js';

function useWhatsAppStatus() {
  const [status, setStatus] = useState('unknown');
  useEffect(() => {
    let cancelled = false;
    function fetchStatus() {
      api.get('/api/whatsapp/status')
        .then((r) => { if (!cancelled) setStatus(r.data.status); })
        .catch(() => { if (!cancelled) setStatus('unknown'); });
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);
  return status;
}

function useUsage24h() {
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    let cancelled = false;
    function fetchUsage() {
      api.get('/api/dashboard/usage')
        .then((r) => { if (!cancelled) setUsage(r.data); })
        .catch(() => { if (!cancelled) setUsage(null); });
    }
    fetchUsage();
    const interval = setInterval(fetchUsage, 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);
  return usage;
}

function useLiveClock() {
  const [time, setTime] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const cityRaw = tz.split('/').pop().replace(/_/g, ' ');
    const cityMap = {
      'Bogota': 'Bogotá', 'Mexico City': 'Ciudad de México',
      'Lima': 'Lima', 'Santiago': 'Santiago', 'Buenos Aires': 'Buenos Aires',
      'Caracas': 'Caracas', 'Guayaquil': 'Guayaquil', 'Montevideo': 'Montevideo',
      'Asuncion': 'Asunción', 'La Paz': 'La Paz', 'Managua': 'Managua',
      'New York': 'Nueva York', 'Los Angeles': 'Los Ángeles', 'Chicago': 'Chicago',
      'Miami': 'Miami', 'Madrid': 'Madrid', 'London': 'Londres',
    };
    setCity(cityMap[cityRaw] || cityRaw);

    const timeFmt = new Intl.DateTimeFormat('es', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    const weekdayFmt = new Intl.DateTimeFormat('es', { timeZone: tz, weekday: 'long' });
    const dayFmt = new Intl.DateTimeFormat('es', { timeZone: tz, day: 'numeric' });
    const monthFmt = new Intl.DateTimeFormat('es', { timeZone: tz, month: 'short' });
    const yearFmt = new Intl.DateTimeFormat('es', { timeZone: tz, year: 'numeric' });

    const tick = () => {
      const now = new Date();
      setTime(timeFmt.format(now));
      const weekday = weekdayFmt.format(now);
      const day = dayFmt.format(now);
      const monthShort = monthFmt.format(now);
      const month3 = monthShort.toUpperCase().replace('.', '').slice(0, 3);
      const year = yearFmt.format(now);
      const w = weekday.charAt(0).toUpperCase() + weekday.slice(1);
      setDateStr(`${w}, ${day} de ${month3} de ${year}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return { time, dateStr, city };
}

export default function Layout({ children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const waStatus = useWhatsAppStatus();
  const usage24h = useUsage24h();
  const { time, dateStr, city } = useLiveClock();

  const [disconnectedSince, setDisconnectedSince] = useState(null);
  const [showDisconnectionWarning, setShowDisconnectionWarning] = useState(false);

  useEffect(() => {
    if (waStatus === 'disconnected') {
      setDisconnectedSince((prev) => (prev == null ? Date.now() : prev));
    } else {
      setDisconnectedSince(null);
      setShowDisconnectionWarning(false);
    }
  }, [waStatus]);

  useEffect(() => {
    if (disconnectedSince == null) return;
    const t = setInterval(() => {
      if (Date.now() - disconnectedSince >= 60_000) {
        setShowDisconnectionWarning(true);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [disconnectedSince]);

  async function handleLogout() {
    try {
      await api.post('/api/auth/logout');
    } catch (_) {}
    logout();
    navigate('/login');
  }

  const statusDot = {
    connected:    { color: 'bg-green-400 animate-pulse',  label: 'Conectado' },
    initializing: { color: 'bg-amber-400 animate-pulse', label: 'Conectando...' },
    authenticated:{ color: 'bg-amber-400 animate-pulse', label: 'Autenticando...' },
    disconnected: { color: 'bg-red-500 animate-pulse',  label: 'Desconectado' },
    auth_failure: { color: 'bg-red-400',    label: 'Error de auth' },
    unknown:      { color: 'bg-slate-600',  label: 'WhatsApp' },
  }[waStatus] ?? { color: 'bg-slate-600', label: waStatus };

  return (
    <div className="min-h-screen bg-slate-100/80 flex">
      <aside className="w-60 bg-slate-900 text-white flex flex-col shadow-card-hover">
        <div className="px-4 pt-5 pb-3">
          <Link
            to="/whatsapp"
            className="flex items-center justify-center w-full py-3 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-95 shadow-md"
            style={{ backgroundColor: '#25D366' }}
          >
            Conectar WhatsApp
          </Link>
        </div>
        <div className="px-4 pt-4 pb-4 border-b border-slate-700/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-lg tracking-tight" style={{ color: '#25D366' }}>WhatSend</span>
            <Link
              to="/whatsapp"
              title={statusDot.label}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors rounded-lg px-2 py-1.5"
            >
              <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${statusDot.color}`} />
              <span className="truncate max-w-[72px]">{statusDot.label}</span>
            </Link>
          </div>
          {usage24h != null && (
            <div className="text-center pt-3 border-t border-slate-700/80">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Mensajes (24 h)</p>
              <p className="text-sm font-semibold text-white mt-0.5">
                <span className={usage24h.remaining24h === 0 ? 'text-red-400' : 'text-emerald-400'}>
                  {usage24h.remaining24h}
                </span>
                <span className="text-slate-500 font-normal"> / {usage24h.limit24h}</span>
              </p>
            </div>
          )}
        </div>
        <nav className="p-3 flex-1 space-y-0.5">
          <Link to="/" className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors">Panel de Control</Link>
          <Link to="/whatsapp" className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors">WhatsApp</Link>
          <Link to="/templates" className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors">Plantillas</Link>
          <Link to="/lists" className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors">Listas</Link>
          <Link to="/campaigns/new" className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors">Nueva campaña</Link>
          <Link to="/campaigns" className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors">Historial</Link>
          <Link to="/logs" className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors">Logs</Link>
          {user?.role === 'ADMIN' && (
            <>
              <Link to="/users" className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors">Usuarios</Link>
              <Link to="/audit" className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors">Auditoría</Link>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-slate-700/80">
          <p className="text-left text-lg font-bold tracking-tight mb-2" aria-hidden="true">
            {'hidalgotech'.split('').map((char, i) => (
              <span key={i} style={{ color: i % 2 === 0 ? '#25D366' : '#eab308' }}>{char}</span>
            ))}
          </p>
          <p className="text-sm text-slate-400 truncate font-medium">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-2 text-sm text-slate-500 hover:text-white transition-colors focus:ring-0 focus:ring-offset-0"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto flex flex-col bg-slate-50/50">
        {showDisconnectionWarning && (
          <Link
            to="/whatsapp"
            className="flex items-center justify-center gap-2 py-3 px-4 bg-amber-500/95 text-amber-950 font-semibold text-sm animate-pulse hover:bg-amber-400 transition-colors shadow-card"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-amber-900 animate-pulse" />
            WhatsApp desconectado hace más de 1 minuto — Reconecta aquí
          </Link>
        )}
        {(time || dateStr) && (
          <div className="flex justify-end items-center gap-4 px-6 py-3 bg-white/90 border-b border-slate-200/80 shrink-0 flex-wrap shadow-card">
            {dateStr && <span className="text-slate-600 text-sm">{dateStr.replace(/\bDe\b/g, 'de').replace(/^./, (c) => c.toUpperCase())}</span>}
            {time && <span className="text-lg font-semibold text-slate-800 tracking-tight">{time}</span>}
            {city && <span className="text-sm text-slate-500">{city}</span>}
          </div>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
