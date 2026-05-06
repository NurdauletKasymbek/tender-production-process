import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User, UserRole } from '../types';
import { authApi } from '../api/endpoints';
import { tokenStorage } from '../api/client';
import { getInitData, isTelegramApp } from '../utils/telegram';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  error: string | null;
  loginTelegram: () => Promise<void>;
  loginAsDemo: (role: UserRole) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

const DEMO_USER_KEY = 'tender_app_demo_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDemoUser = useCallback((): User | null => {
    try {
      const raw = localStorage.getItem(DEMO_USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch { return null; }
  }, []);

  const loginTelegram = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const initData = getInitData();
      if (!initData) throw new Error('Telegram initData жоқ. Қолданбаны Telegram-нан ашыңыз.');
      const res = await authApi.loginWithTelegram(initData);
      tokenStorage.set(res.accessToken);
      setUser(res.user);
    } catch (e: any) {
      setError(e.message || 'Кіру кезінде қате');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Браузерде дамуға арналған жалған кіру (бэкенд тыс) */
  const loginAsDemo = useCallback(async (role: UserRole) => {
    const demo: User = {
      id: `demo-${role}`,
      telegramId: '0',
      fullName: `Демо ${role}`,
      role,
      isActive: true,
    };
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demo));
    tokenStorage.set('demo-token');
    setUser(demo);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    localStorage.removeItem(DEMO_USER_KEY);
    setUser(null);
  }, []);

  // Авто-кіру
  useEffect(() => {
    const token = tokenStorage.get();
    if (token === 'demo-token') {
      const demo = loadDemoUser();
      if (demo) { setUser(demo); return; }
    }
    if (isTelegramApp() && !user && !loading) {
      void loginTelegram();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ user, loading, error, loginTelegram, loginAsDemo, logout }),
    [user, loading, error, loginTelegram, loginAsDemo, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
