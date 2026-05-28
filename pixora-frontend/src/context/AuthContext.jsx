import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('pixora_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('pixora_token');
    if (token && !user) {
      authAPI.getMe()
        .then(({ data }) => {
          setUser(data);
          localStorage.setItem('pixora_user', JSON.stringify(data));
        })
        .catch(() => {
          localStorage.removeItem('pixora_token');
          localStorage.removeItem('pixora_user');
        });
    }
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data } = await authAPI.login({ email, password });
      localStorage.setItem('pixora_token', data.token);
      localStorage.setItem('pixora_user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (username, email, password) => {
    setLoading(true);
    try {
      const { data } = await authAPI.signup({ username, email, password });
      localStorage.setItem('pixora_token', data.token);
      localStorage.setItem('pixora_user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Signup failed' };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('pixora_token');
    localStorage.removeItem('pixora_user');
    setUser(null);
  }, []);

  const setSession = useCallback((nextUser, token) => {
    if (token) {
      localStorage.setItem('pixora_token', token);
    }
    if (nextUser) {
      localStorage.setItem('pixora_user', JSON.stringify(nextUser));
    }
    setUser(nextUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
