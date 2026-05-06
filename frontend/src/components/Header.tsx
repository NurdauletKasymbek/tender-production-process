import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROLE_LABEL } from '../utils/labels';

export function Header({ title, showBell = true }: { title: string; showBell?: boolean }) {
  const { user } = useAuth();
  const nav = useNavigate();
  return (
    <header className="header">
      <div>
        <div className="header__title">{title}</div>
        {user && <div className="header__subtitle">{user.fullName} · {ROLE_LABEL[user.role]}</div>}
      </div>
      {showBell && (
        <button className="icon-btn" aria-label="Хабарламалар" onClick={() => nav('/notifications')}>
          <BellIcon />
        </button>
      )}
    </header>
  );
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 22a2.5 2.5 0 0 0 2.45-2H9.55A2.5 2.5 0 0 0 12 22Zm7-5v-5a7 7 0 0 0-5.5-6.84V4a1.5 1.5 0 1 0-3 0v1.16A7 7 0 0 0 5 12v5l-2 2v1h18v-1l-2-2Z"
        fill="currentColor"/>
    </svg>
  );
}
