'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: { id?: string; email?: string; name?: string } | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'secure-sheets-auth',
    },
  ),
);
