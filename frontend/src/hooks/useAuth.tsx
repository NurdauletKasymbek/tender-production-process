import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User, UserRole } from '../types';
import { authApi } from '../api/endpoints';
import { tokenStorage } from '../api/client';
import { getInitData, isTelegramApp } from '../utils/telegram';

interface AuthCtx {
  user: User | null;
  /** UI-да қолданылатын рөл — ADMIN override қойса соған ауысады */
  effectiveRole: UserRole | null;
  /** ADMIN басқа рөл болып тестілеп жатыр ма */
  isImpersonating: boolean;
  loading: boolean;
  error: string | null;
  loginTelegram: () => Promise<void>;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  loginAsDemo: (role: UserRole) => Promise<void>;
  setRoleOverride: (role: UserRole | null) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

const DEMO_USER_KEY = 'tender_app_demo_user';
const ROLE_OVERRIDE_KEY = 'tender_app_role_override';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleOverride, setRoleOverrideState] = useState<UserRole | null>(() => {
    try {
      const v = localStorage.getItem(ROLE_OVERRIDE_KEY);
      return v ? (v as UserRole) : null;
    } catch { return null; }
  });

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

  const loginWithPassword = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.loginWithPassword(username, password);
      tokenStorage.set(res.accessToken);
      setUser(res.user);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Кіру кезінде қате';
      setError(typeof msg === 'string' ? msg : 'Кіру кезінде қате');
      throw e;
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
    localStorage.removeItem(ROLE_OVERRIDE_KEY);
    setRoleOverrideState(null);
    setUser(null);
  }, []);

  /** ADMIN басқа рөл ретінде тестілеу — UI-да ғана. Backend бәрібір ADMIN құқықтарын қолданады. */
  const setRoleOverride = useCallback((role: UserRole | null) => {
    if (role) localStorage.setItem(ROLE_OVERRIDE_KEY, role);
    else localStorage.removeItem(ROLE_OVERRIDE_KEY);
    setRoleOverrideState(role);
  }, []);

  // Авто-кіру
  useEffect(() => {
    const token = tokenStorage.get();

    // Демо режимі — Telegram-сыз браузерден тестілеу
    if (token === 'demo-token') {
      const demo = loadDemoUser();
      if (demo) { setUser(demo); return; }
    }

    // Токен бар болса — нақты қолданушыны API-ден жаңарту (Telegram немесе бұрынғы сессия)
    if (token && token !== 'demo-token') {
      setLoading(true);
      authApi.me()
        .then((u) => setUser(u))
        .catch(() => {
          // Токен жарамсыз — тазарту
          tokenStorage.clear();
          setUser(null);
          // Telegram болса — қайта кіруге тырысу
          if (isTelegramApp()) void loginTelegram();
        })
        .finally(() => setLoading(false));
      return;
    }

    // Токен жоқ + Telegram → авто-кіру
    if (isTelegramApp() && !user && !loading) {
      void loginTelegram();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveRole = useMemo<UserRole | null>(() => {
    if (!user) return null;
    if (user.role === 'ADMIN' && roleOverride) return roleOverride;
    return user.role;
  }, [user, roleOverride]);

  const isImpersonating = !!(user?.role === 'ADMIN' && roleOverride && roleOverride !== 'ADMIN');

  const value = useMemo<AuthCtx>(
    () => ({
      user, effectiveRole, isImpersonating,
      loading, error,
      loginTelegram, loginWithPassword, loginAsDemo, setRoleOverride, logout,
    }),
    [user, effectiveRole, isImpersonating, loading, error, loginTelegram, loginWithPassword, loginAsDemo, setRoleOverride, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
