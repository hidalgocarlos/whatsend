import { useState, useEffect, useRef } from 'react';
import api, { getAccessToken } from '../services/api.js';

export default function WhatsAppPage() {
  const [status, setStatus] = useState({ status: 'disconnected' });
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    api.get('/api/whatsapp/status').then((r) => setStatus(r.data)).catch(() => {});
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  function connect() {
    setConnecting(true);
    setQr(null);
    api.post('/api/whatsapp/connect').then((r) => setStatus(r.data)).catch(() => setConnecting(false));

    const token = getAccessToken();
    const base = import.meta.env.VITE_API_URL || '';
    const url = `${base}/api/whatsapp/qr${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('qr', (e) => {
      try {
        const data = JSON.parse(e.data);
        setQr(data);
      } catch (_) {
        setQr(e.data);
      }
    });
    es.addEventListener('status', (e) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {};
        setStatus((s) => ({ ...s, ...data }));
        if (data.status === 'connected') {
          setConnecting(false);
          setQr(null);
          es.close();
        } else if (data.status === 'disconnected') {
          // La conexión falló (ej. sesión inválida); resetear para que el usuario pueda reintentar
          setConnecting(false);
          setQr(null);
          es.close();
        }
      } catch (_) {}
    });
    es.onerror = () => {
      setConnecting(false);
      es.close();
    };
  }

  async function disconnect() {
    setLoading(true);
    try {
      await api.post('/api/whatsapp/disconnect');
      setStatus({ status: 'disconnected' });
      setQr(null);
    } finally {
      setLoading(false);
    }
  }

  const isConnected = status.status === 'connected';

  return (
    <div className="p-8 max-w-lg mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-8">WhatsApp</h1>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <span
            className={`w-3.5 h-3.5 rounded-full shrink-0 ${
              isConnected ? 'bg-emerald-500' : status.status === 'initializing' ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'
            }`}
            aria-hidden="true"
          />
          <span className="font-semibold text-slate-800">
            {isConnected ? 'Conectado' : status.status === 'initializing' ? 'Conectando...' : 'Desconectado'}
          </span>
          {status.phone && <span className="text-slate-500 text-sm">{status.phone}</span>}
        </div>

        {!isConnected && !connecting && (
          <button
            onClick={connect}
            className="w-full py-3.5 bg-[#25D366] text-white font-semibold rounded-xl hover:opacity-95 transition-all shadow-md focus:ring-2 focus:ring-green-500/30 focus:ring-offset-2"
          >
            Conectar WhatsApp
          </button>
        )}

        {(qr || connecting) && (
          <div className="mt-6 p-6 bg-slate-50/80 rounded-2xl text-center border border-slate-100">
            {qr ? (
              <img src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`} alt="Código QR para vincular WhatsApp" className="mx-auto w-64 h-64 object-contain rounded-xl" />
            ) : (
              <p className="text-slate-500 font-medium">Generando QR...</p>
            )}
            <p className="mt-3 text-sm text-slate-600 font-medium">Escanea con WhatsApp en tu teléfono</p>
          </div>
        )}

        {isConnected && (
          <button
            onClick={disconnect}
            disabled={loading}
            className="mt-6 w-full py-3 border-2 border-red-200 text-red-600 font-semibold rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-red-500/20 focus:ring-offset-2"
          >
            Desconectar
          </button>
        )}
      </div>
    </div>
  );
}
