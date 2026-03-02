import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true, // envía la cookie httpOnly refreshToken automáticamente
  headers: { 'Content-Type': 'application/json' },
});

// Token guardado en memoria del módulo — no persiste en localStorage ni sessionStorage
// Esto protege contra ataques XSS: ningún script puede leerlo
let _accessToken = null;
let _refreshPromise = null; // evita múltiples refresh simultáneos

export function setAccessToken(token) {
  _accessToken = token;
}

export function clearAccessToken() {
  _accessToken = null;
}

export function getAccessToken() {
  return _accessToken;
}

// Adjuntar token en cada request
api.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// Auto-refresh transparente cuando el token expira (401)
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const isRefreshRoute = original?.url?.includes('/auth/refresh');
    const isLoginRoute = original?.url?.includes('/auth/login');

    if (err.response?.status === 401 && !original._retry && !isRefreshRoute && !isLoginRoute) {
      original._retry = true;

      // Si ya hay un refresh en vuelo, esperar ese mismo en lugar de lanzar otro
      if (!_refreshPromise) {
        _refreshPromise = api.post('/api/auth/refresh')
          .then(({ data }) => {
            setAccessToken(data.accessToken);
            if (data.user) {
              import('../store/authStore.js').then(({ useAuthStore }) => {
                useAuthStore.getState().setUser(data.user);
              });
            }
            return data.accessToken;
          })
          .catch((refreshErr) => {
            clearAccessToken();
            import('../store/authStore.js').then(({ useAuthStore }) => {
              useAuthStore.getState().logout();
            });
            window.location.href = '/login';
            throw refreshErr;
          })
          .finally(() => {
            _refreshPromise = null;
          });
      }

      try {
        const newToken = await _refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (_) {
        return Promise.reject(err);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
