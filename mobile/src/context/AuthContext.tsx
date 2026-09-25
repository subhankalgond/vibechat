import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '../services/api';
import { clearToken, loadToken, saveToken } from '../services/storage';
import { connectSocket, disconnectSocket } from '../services/socket';

export interface User {
  id: number;
  full_name: string;
  username: string;
  email?: string;
  profile_image: string | null;
  bio: string | null;
  is_online: boolean;
  last_seen: string | null;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  initializing: boolean;
  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (payload: {
    full_name: string;
    username: string;
    email: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string; errors?: Record<string, string> | null }>;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadToken();
      if (!stored) {
        setInitializing(false);
        return;
      }
      try {
        const data = await api.get<{ user: User }>('/auth/me', stored);
        if (cancelled) return;
        setUser(data.user);
        setToken(stored);
        connectSocket(stored);
      } catch {
        await clearToken();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    try {
      const data = await api.post<{ token: string; user: User }>('/auth/login', { identifier, password });
      await saveToken(data.token);
      setUser(data.user);
      setToken(data.token);
      connectSocket(data.token);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }, []);

  const register = useCallback(
    async (payload: { full_name: string; username: string; email: string; password: string }) => {
      try {
        const data = await api.post<{ token: string; user: User }>('/auth/register', payload);
        await saveToken(data.token);
        setUser(data.user);
        setToken(data.token);
        connectSocket(data.token);
        return { ok: true };
      } catch (error) {
        const err = error as Error & { errors?: Record<string, string> | null };
        return { ok: false, error: err.message, errors: err.errors || null };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {}, token);
    } catch {
      // token may already be invalid; proceed with local cleanup
    }
    await clearToken();
    disconnectSocket();
    setUser(null);
    setToken(null);
  }, [token]);

  const value = useMemo(
    () => ({ user, token, initializing, login, register, logout, setUser }),
    [user, token, initializing, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
