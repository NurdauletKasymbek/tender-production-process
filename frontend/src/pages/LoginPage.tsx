import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { isTelegramApp } from '../utils/telegram';
import type { UserRole } from '../types';
import { ROLE_LABEL } from '../utils/labels';
import { Spinner } from '../components/Spinner';

const DEMO_ROLES: UserRole[] = [
  'ADMIN', 'TENDER_DEPARTMENT', 'DIRECTOR', 'PRODUCTION_HEAD',
  'WORKSHOP_WORKER', 'PACKAGING', 'LOADING', 'LOGISTICS',
];

export function LoginPage() {
  const { loginTelegram, loginAsDemo, loading, error } = useAuth();

  useEffect(() => {
    if (isTelegramApp()) {
      void loginTelegram();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Spinner label="Жүйеге кіру..." />;

  return (
    <div className="login">
      <div className="login__hero">
        <div className="login__logo">📦</div>
        <h1 className="login__title">Тендер · Өндіріс</h1>
        <p className="login__subtitle">
          Goszakup тендерлерін және өндіріс циклін бір жерден басқарыңыз.
        </p>
      </div>

      {isTelegramApp() ? (
        <button className="btn btn--primary btn--lg" onClick={() => void loginTelegram()}>
          Telegram арқылы кіру
        </button>
      ) : (
        <>
          <div className="login__hint">
            Қолданбаны Telegram-нан ашыңыз. Демо режимінде рөл таңдап көріңіз:
          </div>
          <div className="role-grid">
            {DEMO_ROLES.map((role) => (
              <button
                key={role}
                className="role-grid__item"
                onClick={() => void loginAsDemo(role)}
              >
                <span className="role-grid__label">{ROLE_LABEL[role]}</span>
                <span className="role-grid__code">{role}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {error && <div className="alert alert--error">{error}</div>}
    </div>
  );
}
