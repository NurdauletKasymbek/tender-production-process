import { useAuth } from '../hooks/useAuth';
import { Header } from '../components/Header';
import { ROLE_LABEL } from '../utils/labels';

export function ProfilePage() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="page">
      <Header title="Профиль" showBell={false} />
      <div className="card">
        <div className="profile__avatar">{user.fullName.slice(0, 1).toUpperCase()}</div>
        <div className="profile__name">{user.fullName}</div>
        <div className="profile__role">{ROLE_LABEL[user.role]}</div>
        {user.phone && <div className="profile__phone">{user.phone}</div>}
      </div>

      <div className="card">
        <div className="row">
          <span className="muted">Telegram ID</span>
          <span>{user.telegramId}</span>
        </div>
        <div className="row">
          <span className="muted">Күйі</span>
          <span>{user.isActive ? 'Белсенді' : 'Бұғатталған'}</span>
        </div>
      </div>

      <button className="btn btn--ghost btn--lg" onClick={logout}>
        Шығу
      </button>
    </div>
  );
}
