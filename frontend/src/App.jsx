import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import api, { setAccessToken } from './services/api.js';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import WhatsAppPage from './pages/WhatsAppPage.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';
import ListsPage from './pages/ListsPage.jsx';
import NewCampaignPage from './pages/NewCampaignPage.jsx';
import CampaignDetailPage from './pages/CampaignDetailPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import SendLogsPage from './pages/SendLogsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import AuditLogsPage from './pages/AuditLogsPage.jsx';

function PrivateRoute({ children }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  // Al cargar la app, intentamos renovar silenciosamente la sesión usando
  // la cookie httpOnly refreshToken. Si no hay sesión activa, el usuario
  // va al login. El operador no percibe ninguna interrupción.
  const [ready, setReady] = useState(false);
  const { setUser, logout } = useAuthStore();

  useEffect(() => {
    api.post('/api/auth/refresh')
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        setUser(data.user);
      })
      .catch(() => {
        // No hay sesión activa — limpiar y mostrar login
        logout();
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-[3px] border-primary-light border-t-primary rounded-full animate-spin" aria-hidden="true" />
          <span className="font-display font-semibold text-slate-500 text-sm tracking-tight">WhatSend</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/whatsapp" element={<PrivateRoute><WhatsAppPage /></PrivateRoute>} />
        <Route path="/templates" element={<PrivateRoute><TemplatesPage /></PrivateRoute>} />
        <Route path="/lists" element={<PrivateRoute><ListsPage /></PrivateRoute>} />
        <Route path="/campaigns/new" element={<PrivateRoute><NewCampaignPage /></PrivateRoute>} />
        <Route path="/campaigns" element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
        <Route path="/campaigns/:id" element={<PrivateRoute><CampaignDetailPage /></PrivateRoute>} />
        <Route path="/logs" element={<PrivateRoute><SendLogsPage /></PrivateRoute>} />
        <Route path="/users" element={<PrivateRoute><UsersPage /></PrivateRoute>} />
        <Route path="/audit" element={<PrivateRoute><AuditLogsPage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
