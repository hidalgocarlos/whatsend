import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Solo persistimos el objeto `user` (no sensible) para que el nombre/email
// aparezca instantáneamente al recargar mientras el token se renueva en background.
// El accessToken NUNCA se guarda en localStorage — vive solo en memoria (api.js).
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'whatsend-auth',
      partialize: (state) => ({ user: state.user }), // solo persiste `user`, nunca tokens
    }
  )
);
