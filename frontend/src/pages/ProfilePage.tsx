import { useAuth } from '../hooks/useAuth';
import { Header } from '../components/Header';
import { ROLE_ICON, ROLE_LABEL } from '../utils/labels';
import type { UserRole } from '../types';

const TEST_ROLES: UserRole[] = [
  'ADMIN', 'TENDER_DEPARTMENT', 'DIRECTOR', 'PRODUCTION_HEAD',
  'WORKSHOP_WORKER', 'PACKAGING', 'LOADING', 'LOGISTICS',
];

export function ProfilePage() {
  const { user, effectiveRole, isImpersonating, setRoleOverride, logout } = useAuth();
  if (!user || !effectiveRole) return null;
  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="page">
      <Header title="Профиль" showBell={false} />

      {isImpersonating && (
        <div className="alert alert--info" style={{ alignItems: 'center' }}>
          <span aria-hidden>🧪</span>
          <span>
            Тестілеу режимі: <strong>{ROLE_LABEL[effectiveRole]}</strong> ретінде көрсетіліп тұр.
            Барлық құқықтар әлі сізде (ADMIN).
          </span>
        </div>
      )}

      <div className="card profile__card">
        <div className="profile__avatar" aria-hidden>
          <span style={{ position: 'relative', zIndex: 1 }}>
            {user.fullName.slice(0, 1).toUpperCase()}
          </span>
        </div>
        <div className="profile__name">{user.fullName}</div>
        <div className="profile__role-badge">
          <span aria-hidden>{ROLE_ICON[user.role]}</span>
          <span>{ROLE_LABEL[user.role]}</span>
        </div>
        {user.phone && <div className="profile__phone">{user.phone}</div>}
      </div>

      <div className="card">
        <div className="row">
          <span className="row__label">Telegram ID</span>
          <span className="row__value">{user.telegramId}</span>
        </div>
        <div className="row">
          <span className="row__label">Күйі</span>
          <span className="row__value">
            {user.isActive ? (
              <span style={{ color: 'var(--success)' }}>● Белсенді</span>
            ) : (
              <span style={{ color: 'var(--danger)' }}>● Бұғатталған</span>
            )}
          </span>
        </div>
        <div className="row">
          <span className="row__label">Рөл коды</span>
          <span className="row__value muted" style={{ fontSize: 12, fontFamily: 'monospace' }}>
            {user.role}
          </span>
        </div>
      </div>

      {isAdmin && (
        <>
          <h3 className="section-title">🧪 Тестілеу режимі (тек ADMIN)</h3>
          <div className="card">
            <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Әр рөлдің интерфейсін тестілеу үшін рөл таңдаңыз. Backend-те сіз ADMIN
              боласыз — барлық әрекеттерді істей аласыз.
            </div>
            <div className="role-grid">
              {TEST_ROLES.map((r) => {
                const active = effectiveRole === r;
                return (
                  <button
                    key={r}
                    className="role-grid__item"
                    onClick={() => setRoleOverride(r === 'ADMIN' ? null : r)}
                    style={active ? {
                      borderColor: 'var(--brand-500)',
                      boxShadow: '0 0 0 2px rgba(36,129,204,0.18)',
                    } : undefined}
                  >
                    <span className="role-grid__icon" aria-hidden>{ROLE_ICON[r]}</span>
                    <span className="role-grid__label">{ROLE_LABEL[r]}</span>
                    <span className="role-grid__code">
                      {active ? '● ҚАЗІР' : r}
                    </span>
                  </button>
                );
              })}
            </div>
            {isImpersonating && (
              <button
                className="btn btn--ghost btn--block mt-md"
                onClick={() => setRoleOverride(null)}
              >
                ↺ ADMIN-ге қайту
              </button>
            )}
          </div>
        </>
      )}

      <button className="btn btn--ghost btn--lg btn--block" onClick={logout}>
        <span aria-hidden>↩</span>
        <span>Шығу</span>
      </button>
    </div>
  );
}
