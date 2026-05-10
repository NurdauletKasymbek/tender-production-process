import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { notificationsApi } from '../api/endpoints';

const KZ_DAYS_SHORT = ['Жс', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб'];
const KZ_MONTHS = [
  'қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым',
  'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан',
];

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatKzDate(d: Date) {
  return `${KZ_DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${KZ_MONTHS[d.getMonth()]}`;
}
function formatTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function initialsOf(name?: string) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || '?';
}

/**
 * Қызметкердің басты бетінің жоғарғы блогы:
 *   аватар (инициалдар) + үлкен сағат/күні + 3 дөңгелек әрекет батырмасы.
 * Telegram bot стилінде.
 */
export function DashboardHeader() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [now, setNow] = useState(new Date());
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    notificationsApi.list(true)
      .then((list) => setUnread(list.length))
      .catch(() => {});
  }, []);

  return (
    <div className="dash-header">
      <div className="dash-header__avatar" aria-hidden>
        <span>{initialsOf(user?.fullName)}</span>
      </div>

      <div className="dash-header__clock">
        <div className="dash-header__time">{formatTime(now)}</div>
        <div className="dash-header__date">{formatKzDate(now)}</div>
      </div>

      <div className="dash-header__actions">
        <Link
          to="/notifications"
          className="dash-circle"
          aria-label="Хабарламалар"
        >
          <BellIcon />
          {unread > 0 && <span className="dash-circle__dot" />}
        </Link>
        <button
          type="button"
          className="dash-circle"
          aria-label="Тапсырыстар"
          onClick={() => nav('/orders')}
        >
          <ChartIcon />
        </button>
        <button
          type="button"
          className="dash-circle"
          aria-label="Профиль"
          onClick={() => nav('/profile')}
        >
          <SettingsIcon />
        </button>
      </div>
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 22a2.5 2.5 0 0 0 2.45-2H9.55A2.5 2.5 0 0 0 12 22Zm7-5v-5a7 7 0 0 0-5.5-6.84V4a1.5 1.5 0 1 0-3 0v1.16A7 7 0 0 0 5 12v5l-2 2v1h18v-1l-2-2Z"
        fill="currentColor"/>
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M5 21V10h3v11H5Zm5.5 0V3h3v18h-3ZM16 21v-7h3v7h-3Z" fill="currentColor"/>
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9.4 4 1.7 1.4-1.6 2.7-2.1-.5a8.6 8.6 0 0 1-1.6 1l-.4 2.2h-3.2l-.4-2.2a8.6 8.6 0 0 1-1.6-1l-2.1.5-1.6-2.7L8.6 12l-1.7-1.4 1.6-2.7 2.1.5c.5-.4 1-.7 1.6-1l.4-2.2h3.2l.4 2.2c.6.3 1.1.6 1.6 1l2.1-.5 1.6 2.7L21.4 12Z"
        fill="currentColor"
      />
    </svg>
  );
}
