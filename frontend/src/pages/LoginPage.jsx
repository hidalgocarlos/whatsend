import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setAccessToken } from '../services/api.js';
import { useAuthStore } from '../store/authStore.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      setAccessToken(data.accessToken);
      setUser(data.user);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al iniciar sesión';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md p-10 bg-white rounded-2xl shadow-card-hover border border-slate-100">
        <div className="flex justify-center mb-8">
          <h1
            className="text-4xl font-bold tracking-tight text-[#25D366] antialiased"
            style={{
              textShadow: [
                '0 1px 0 rgba(0,60,30,0.4)',
                '0 -1px 0 rgba(0,60,30,0.4)',
                '1px 0 0 rgba(0,60,30,0.4)',
                '-1px 0 0 rgba(0,60,30,0.4)',
                '1px 1px 0 rgba(0,60,30,0.4)',
                '1px -1px 0 rgba(0,60,30,0.4)',
                '-1px 1px 0 rgba(0,60,30,0.4)',
                '-1px -1px 0 rgba(0,60,30,0.4)',
              ].join(', '),
            }}
          >
            WhatSend
          </h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="login-email" className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-green-500/25 focus:border-green-500 transition-shadow"
              required
              autoComplete="email"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700 mb-2">Contraseña</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-green-500/25 focus:border-green-500 transition-shadow"
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-red-700 bg-red-50/90 px-4 py-3 rounded-xl border border-red-100" role="alert">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#25D366] text-white font-semibold rounded-xl hover:opacity-95 disabled:opacity-50 transition-all shadow-md focus:ring-2 focus:ring-green-500/30 focus:ring-offset-2"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
