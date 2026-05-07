import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types';

interface NavItem {
  to: string;
  label: string;
  icon: JSX.Element;
  roles?: UserRole[];
}

const HOME_LABEL: Record<UserRole, string> = {
  ADMIN: 'Басты',
  TENDER_DEPARTMENT: 'Тендерлер',
  DIRECTOR: 'Дашборд',
  PRODUCTION_HEAD: 'Өндіріс',
  WORKSHOP_WORKER: 'Тапсырмалар',
  PACKAGING: 'Қаптау',
  LOADING: 'Тиеу',
  LOGISTICS: 'Жеткізу',
};

/**
 * Тек ADMIN мен DIRECTOR толық бақылау Mini App-ын көреді (4 таб).
 * Қалған рөлдер шектеулі көрініс — тек өздеріне қатысты бөлімдер (3 таб).
 */
const FULL_ACCESS_ROLES: UserRole[] = ['ADMIN', 'DIRECTOR'];

export function BottomNav() {
  const { user, effectiveRole } = useAuth();
  if (!user || !effectiveRole) return null;

  const hasFullAccess = FULL_ACCESS_ROLES.includes(effectiveRole);

  const items: NavItem[] = [
    { to: '/', label: HOME_LABEL[effectiveRole], icon: <HomeIcon /> },
    // Барлық тапсырыстар тізімі — тек ADMIN/DIRECTOR-ге
    ...(hasFullAccess
      ? [{ to: '/orders', label: 'Тапсырыстар', icon: <ListIcon /> }]
      : []),
    { to: '/notifications', label: 'Хабарлама', icon: <BellIcon /> },
    { to: '/profile', label: 'Профиль', icon: <UserIcon /> },
  ];

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `bottom-nav__item ${isActive ? 'is-active' : ''}`}
        >
          <span className="bottom-nav__icon">{item.icon}</span>
          <span className="bottom-nav__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="m12 3 9 8h-3v9h-5v-6h-2v6H6v-9H3l9-8Z" fill="currentColor"/>
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" fill="currentColor"/>
    </svg>
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
function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.3 0-8 1.7-8 5v3h16v-3c0-3.3-4.7-5-8-5Z"
        fill="currentColor"/>
    </svg>
  );
}
