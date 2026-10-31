'use client';

import { Role } from '@courier/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api, unwrap } from './api';

export interface UserInfoProfile {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  companyName: string | null;
  gstin: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  userInfo?: UserInfoProfile | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(unwrap<SessionUser>(data));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    setUser(unwrap<SessionUser>(data));
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
