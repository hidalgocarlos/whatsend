import { useState, useEffect } from 'react';
import api from '../services/api.js';

export default function UsersPage() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'OPERATOR' });
  const [editing, setEditing] = useState(null);
  const [resetPass, setResetPass] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    api.get('/api/users').then((r) => setList(r.data)).catch(console.error);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setFormError('');
    try {
      if (editing) {
        await api.put(`/api/users/${editing.id}`, { name: form.name, role: form.role, isActive: form.isActive });
        setList((prev) => prev.map((u) => (u.id === editing.id ? { ...u, ...form } : u)));
      } else {
        const { data } = await api.post('/api/users', form);
        setList((prev) => [data, ...prev]);
      }
      setEditing(null);
      setForm({ name: '', email: '', password: '', role: 'OPERATOR' });
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || 'Error al guardar usuario');
    } finally {
      setLoading(false);
    }
  }

  async function resetPasswordSubmit(e) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) return;
    setResetError('');
    try {
      await api.post(`/api/users/${resetPass.id}/reset-password`, { newPassword });
      setResetPass(null);
      setNewPassword('');
    } catch (err) {
      setResetError(err.response?.data?.error || err.message || 'Error al cambiar contraseña');
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-8">Usuarios</h1>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 mb-8">
        <h2 className="font-semibold text-slate-900 tracking-tight mb-5">{editing ? 'Editar' : 'Nuevo'} usuario</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="user-name" className="block text-sm font-semibold text-slate-700 mb-2">Nombre</label>
              <input id="user-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500" required />
            </div>
            <div>
              <label htmlFor="user-email" className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
              <input id="user-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500 disabled:bg-slate-50" required disabled={!!editing} />
            </div>
          </div>
          {!editing && (
            <div>
              <label htmlFor="user-password" className="block text-sm font-semibold text-slate-700 mb-2">Contraseña</label>
              <input id="user-password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500" required={!editing} minLength={6} />
            </div>
          )}
          <div className="flex gap-6 items-center">
            <label className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Rol</span>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25">
                <option value="OPERATOR">Operador</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            {editing && (
              <label className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">Activo</span>
                <input type="checkbox" checked={form.isActive !== false} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded border-slate-300" />
              </label>
            )}
          </div>
          {formError && (
            <p className="text-sm text-red-700 bg-red-50/90 px-4 py-3 rounded-xl border border-red-100" role="alert">{formError}</p>
          )}
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="px-5 py-2.5 bg-[#25D366] text-white font-semibold rounded-xl hover:opacity-95 disabled:opacity-50 shadow-md transition-all">Guardar</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm({ name: '', email: '', password: '', role: 'OPERATOR' }); setFormError(''); }} className="px-5 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors">Cancelar</button>}
          </div>
        </form>
      </div>

      {resetPass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-10 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-card-hover border border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-4">Nueva contraseña para {resetPass.email}</h3>
            <form onSubmit={resetPasswordSubmit} className="space-y-4">
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mín. 6 caracteres" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/25 focus:border-green-500" minLength={6} required />
              {resetError && (
                <p className="text-sm text-red-700 bg-red-50/90 px-4 py-3 rounded-xl border border-red-100" role="alert">{resetError}</p>
              )}
              <div className="flex gap-3">
                <button type="submit" className="px-4 py-2.5 bg-[#25D366] text-white font-semibold rounded-xl hover:opacity-95">Guardar</button>
                <button type="button" onClick={() => { setResetPass(null); setNewPassword(''); setResetError(''); }} className="px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50">Cerrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="p-4">Nombre</th>
              <th className="p-4">Email</th>
              <th className="p-4">Rol</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                <td className="p-4 font-medium text-slate-800">{u.name}</td>
                <td className="p-4 text-slate-700">{u.email}</td>
                <td className="p-4 text-slate-700">{u.role}</td>
                <td className="p-4">{u.isActive ? <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700">Activo</span> : <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600">Inactivo</span>}</td>
                <td className="p-4">
                  <button onClick={() => { setEditing(u); setForm({ name: u.name, email: u.email, role: u.role, isActive: u.isActive }); setFormError(''); }} className="font-medium text-[#25D366] hover:text-emerald-600 mr-3 transition-colors">Editar</button>
                  <button onClick={() => { setResetPass(u); setResetError(''); }} className="font-medium text-slate-600 hover:text-slate-800 transition-colors">Contraseña</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
