import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { apiError, getToken, setToken } from '../services/api';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (!getToken()) {
        setInitializing(false);
        return;
      }
      try {
        const response = await api.get('/auth/me');
        if (!cancelled) setUser(response.data.data.user);
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the socket connection in sync with auth state.
  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return undefined;
    }
    const socket = connectSocket();
    if (!socket) return undefined;

    const onPresence = (payload) => {
      setUser((prev) =>
        prev && prev.id === payload.user_id ? { ...prev, is_online: payload.is_online } : prev
      );
    };
    socket.on('user:presence', onPresence);
    return () => {
      socket.off('user:presence', onPresence);
    };
  }, [user]);

  const register = useCallback(async (payload) => {
    try {
      const response = await api.post('/auth/register', payload);
      const { token, user: newUser } = response.data.data;
      setToken(token);
      setUser(newUser);
      return { success: true };
    } catch (error) {
      const wrapped = apiError(error);
      return { success: false, ...wrapped };
    }
  }, []);

  const login = useCallback(async (payload) => {
    try {
      const response = await api.post('/auth/login', payload);
      const { token, user: loggedIn } = response.data.data;
      setToken(token);
      setUser(loggedIn);
      return { success: true };
    } catch (error) {
      const wrapped = apiError(error);
      return { success: false, ...wrapped };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // token already invalid; proceed with local cleanup
    }
    setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (payload) => {
    try {
      const response = await api.put('/users/profile', payload);
      setUser(response.data.data.user);
      setToken(response.data.data.token);
      return { success: true, user: response.data.data.user };
    } catch (error) {
      const wrapped = apiError(error);
      return { success: false, ...wrapped };
    }
  }, []);

  const updateAvatar = useCallback(async (file) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.put('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(response.data.data.user);
      return { success: true, user: response.data.data.user };
    } catch (error) {
      const wrapped = apiError(error);
      return { success: false, ...wrapped };
    }
  }, []);

  const value = useMemo(
    () => ({ user, setUser, initializing, register, login, logout, updateProfile, updateAvatar }),
    [user, initializing, register, login, logout, updateProfile, updateAvatar]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
