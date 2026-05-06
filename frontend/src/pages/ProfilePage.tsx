import { useAuth } from '../hooks/useAuth';
import { Header } from '../components/Header';
import { ROLE_ICON, ROLE_LABEL } from '../utils/labels';

export function ProfilePage() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="page">
      <Header title="Профиль" showBell={false} />
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

      <button className="btn btn--ghost btn--lg btn--block" onClick={logout}>
        <span aria-hidden>↩</span>
        <span>Шығу</span>
      </button>
    </div>
  );
}
