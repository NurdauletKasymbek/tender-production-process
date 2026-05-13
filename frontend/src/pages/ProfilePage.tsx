import { FormEvent, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Header } from '../components/Header';
import { ROLE_ICON, ROLE_LABEL } from '../utils/labels';
import { usersApi, authApi } from '../api/endpoints';
import { hapticNotify } from '../utils/telegram';
import type { UserRole } from '../types';

const TEST_ROLES: UserRole[] = [
  'ADMIN', 'TENDER_DEPARTMENT', 'DIRECTOR', 'PRODUCTION_HEAD',
  'WORKSHOP_WORKER', 'PACKAGING', 'LOADING', 'LOGISTICS',
];

export function ProfilePage() {
  const { user, effectiveRole, isImpersonating, setRoleOverride, logout } = useAuth();
  const [linkMode, setLinkMode] = useState(false);
  const [tgInput, setTgInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkedId, setLinkedId] = useState<string | null>(null);

  if (!user || !effectiveRole) return null;
  const isAdmin = user.role === 'ADMIN';
  const currentTelegramId = linkedId ?? user.telegramId;

  const linkTelegram = async (e: FormEvent) => {
    e.preventDefault();
    const id = tgInput.trim();
    if (!id || !/^[0-9]+$/.test(id)) {
      setLinkError('Telegram ID тек сандардан тұруы керек');
      return;
    }
    setLinking(true);
    setLinkError(null);
    try {
      const res = await usersApi.linkMyTelegram(id);
      setLinkedId(res.telegramId);
      hapticNotify('success');
      setLinkMode(false);
      setTgInput('');
      // user объектісі де жаңартылсын — me() қайта шақырамыз
      try { await authApi.me(); } catch { /* ignore */ }
    } catch (err: any) {
      setLinkError(err?.response?.data?.message || err?.message || 'Қате');
      hapticNotify('error');
    } finally {
      setLinking(false);
    }
  };

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
          <span className="row__label">Логин</span>
          <span className="row__value" style={{ fontFamily: 'monospace' }}>
            {user.username || <span className="muted">жоқ</span>}
          </span>
        </div>
        <div className="row">
          <span className="row__label">Telegram ID</span>
          <span className="row__value">
            {currentTelegramId ? (
              <span style={{ fontFamily: 'monospace' }}>{currentTelegramId}</span>
            ) : (
              <span className="muted">байланыспаған</span>
            )}
          </span>
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

      {/* Telegram байланысы — хабарлама алу үшін */}
      <div className="card">
        <div className="card__title">📲 Telegram-нан хабарлама</div>
        {currentTelegramId && !linkMode ? (
          <>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              ✓ Telegram байланысы орнатылған. Жаңа тапсырыс пен кезең ауысқанда
              <strong> @GOSCONTROL_bot</strong>-та хабарлама келеді.
            </div>
            <button
              className="btn btn--ghost"
              onClick={() => { setLinkMode(true); setTgInput(''); setLinkError(null); }}
            >
              ✏️ Telegram ID-ні өзгерту
            </button>
          </>
        ) : !currentTelegramId && !linkMode ? (
          <>
            <div className="muted" style={{ fontSize: 13, marginBottom: 10, lineHeight: 1.5 }}>
              Хабарлама Telegram-ға келу үшін:
              <ol style={{ margin: '6px 0', paddingLeft: 22 }}>
                <li><strong>@GOSCONTROL_bot</strong>-ты Telegram-да ашыңыз</li>
                <li><code>/myid</code> командасын жіберіңіз</li>
                <li>Бот қайтарған санды мұнда жабыстырыңыз</li>
              </ol>
            </div>
            <button
              className="btn btn--primary btn--block"
              onClick={() => { setLinkMode(true); setLinkError(null); }}
            >
              + Telegram ID қою
            </button>
          </>
        ) : (
          <form className="form" onSubmit={linkTelegram}>
            <label className="field">
              <span className="field__label">Telegram ID (бот /myid-дан алынған сан)</span>
              <input
                className="input"
                inputMode="numeric"
                pattern="[0-9]+"
                placeholder="мысалы: 8467447289"
                value={tgInput}
                onChange={(e) => setTgInput(e.target.value)}
                autoFocus
                required
              />
            </label>
            {linkError && (
              <div className="alert alert--error">
                <span>⚠️</span><span>{linkError}</span>
              </div>
            )}
            <div className="flex gap-sm">
              <button type="submit" className="btn btn--primary" disabled={linking} style={{ flex: 1 }}>
                {linking ? '...' : 'Сақтау'}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => { setLinkMode(false); setLinkError(null); }}
                disabled={linking}
              >
                Бас тарту
              </button>
            </div>
          </form>
        )}
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
