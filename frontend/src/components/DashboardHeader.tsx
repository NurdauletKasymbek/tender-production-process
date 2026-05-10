import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { notificationsApi } from '../api/endpoints';
import { api, tokenStorage } from '../api/client';

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
 *   аватар (Telegram фотосы немесе инициалдар) + сағат/күні +
 *   3 дөңгелек: хабарлама / тапсырыстар / тақырып ауыстырғыш.
 */
export function DashboardHeader() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const [now, setNow] = useState(new Date());
  const [unread, setUnread] = useState(0);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    notificationsApi.list(true)
      .then((list) => setUnread(list.length))
      .catch(() => {});
  }, []);

  // Telegram фотосының URL-і — JWT-ні query string-те жібереміз
  const photoUrl = user
    ? (() => {
        const base = (api.defaults.baseURL || '/api').replace(/\/$/, '');
        const t = tokenStorage.get();
        return `${base}/users/${user.id}/photo${t ? `?token=${encodeURIComponent(t)}` : ''}`;
      })()
    : null;

  const showInitials = !photoUrl || photoFailed;

  return (
    <div className="dash-header">
      <div className="dash-header__avatar" aria-hidden>
        {showInitials ? (
          <span>{initialsOf(user?.fullName)}</span>
        ) : (
          <img
            src={photoUrl!}
            alt={user?.fullName || ''}
            onError={() => setPhotoFailed(true)}
          />
        )}
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
          aria-label={theme === 'dark' ? 'Жарық тема' : 'Қараңғы тема'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
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
function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" fill="currentColor"/>
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" fill="currentColor"/>
      <path
        d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07-1.42 1.42M6.34 17.66l-1.41 1.41m12.73 0-1.41-1.41M6.34 6.34 4.93 4.93"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
