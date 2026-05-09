import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { usersApi, type AdminUser } from '../api/endpoints';
import type { UserRole } from '../types';
import { ROLE_ICON, ROLE_LABEL } from '../utils/labels';
import { hapticNotify, showConfirm } from '../utils/telegram';

const ALL_ROLES: UserRole[] = [
  'ADMIN',
  'TENDER_DEPARTMENT',
  'DIRECTOR',
  'PRODUCTION_HEAD',
  'WORKSHOP_WORKER',
  'PACKAGING',
  'LOADING',
  'LOGISTICS',
];

interface FormState {
  id?: string;
  fullName: string;
  role: UserRole;
  username: string;
  password: string;
  telegramId: string;
  telegramUsername: string;
  phone: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  fullName: '',
  role: 'TENDER_DEPARTMENT',
  username: '',
  password: '',
  telegramId: '',
  telegramUsername: '',
  phone: '',
  isActive: true,
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await usersApi.list();
      setUsers(list);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Қате');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startNew = () => setEditing({ ...EMPTY_FORM });
  const startEdit = (u: AdminUser) =>
    setEditing({
      id: u.id,
      fullName: u.fullName,
      role: u.role,
      username: u.username || '',
      password: '',
      telegramId: u.telegramId || '',
      telegramUsername: u.telegramUsername || '',
      phone: u.phone || '',
      isActive: u.isActive,
    });

  const toggleActive = async (u: AdminUser) => {
    const ok = await showConfirm(
      u.isActive
        ? `«${u.fullName}» тіркелгісін тоқтатамыз ба? (Кіре алмайды)`
        : `«${u.fullName}» тіркелгісін қайта белсендіреміз бе?`,
    );
    if (!ok) return;
    try {
      await usersApi.setActive(u.id, !u.isActive);
      hapticNotify('success');
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Қате');
      hapticNotify('error');
    }
  };

  return (
    <div className="page">
      <Header title="Қызметкерлер" showBell={false} />

      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}

      <button className="btn btn--primary btn--lg btn--block" onClick={startNew}>
        <span aria-hidden>+</span><span>Жаңа қызметкер</span>
      </button>

      {editing && (
        <UserForm
          initial={editing}
          onCancel={() => setEditing(null)}
          onDone={() => { setEditing(null); void load(); }}
        />
      )}

      {loading ? (
        <Spinner />
      ) : users.length === 0 ? (
        <EmptyState icon="👥" title="Қызметкер жоқ" />
      ) : (
        <div className="list">
          {users.map((u) => (
            <div key={u.id} className="card">
              <div className="card__row">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span aria-hidden>{ROLE_ICON[u.role]}</span>
                    <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.fullName}
                    </strong>
                    {!u.isActive && (
                      <span className="status-badge status-badge--sm" style={{
                        background: 'var(--danger-bg)',
                        color: 'var(--danger)',
                      }}>тоқтаған</span>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {ROLE_LABEL[u.role]}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                    <div>
                      🔑 {u.username
                        ? <strong>{u.username}</strong>
                        : <span className="muted">логин жоқ</span>}
                      {' · '}
                      {u.hasPassword
                        ? <span style={{ color: 'var(--success)' }}>пароль қойылған</span>
                        : <span style={{ color: 'var(--danger)' }}>пароль жоқ</span>}
                    </div>
                    <div className="muted">
                      📲 {u.telegramId ? `ID ${u.telegramId}` : 'Telegram ID жоқ (хабарламасыз)'}
                      {u.telegramUsername && ` · @${u.telegramUsername}`}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-sm" style={{ marginTop: 8 }}>
                <button className="btn btn--soft" onClick={() => startEdit(u)}>
                  ✏️ Өңдеу
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={() => void toggleActive(u)}
                  style={{ color: u.isActive ? 'var(--danger)' : 'var(--success)' }}
                >
                  {u.isActive ? 'Тоқтату' : 'Қайта қосу'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserForm({
  initial, onCancel, onDone,
}: {
  initial: FormState;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [f, setF] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const isEdit = !!f.id;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.fullName.trim()) { setError('Аты-жөні міндетті'); return; }
    if (!isEdit && !f.username.trim()) { setError('Логин міндетті'); return; }
    if (!isEdit && f.password.length < 6) {
      setError('Пароль 6 таңбадан көп болуы керек');
      return;
    }
    if (isEdit && f.password && f.password.length < 6) {
      setError('Жаңа пароль 6 таңбадан көп болуы керек');
      return;
    }

    setBusy(true); setError(null);
    try {
      const body = {
        fullName: f.fullName.trim(),
        role: f.role,
        username: f.username.trim() || undefined,
        ...(f.password ? { password: f.password } : {}),
        telegramId: f.telegramId.trim() || (isEdit ? null : undefined) as any,
        telegramUsername: f.telegramUsername.trim() || (isEdit ? null : undefined) as any,
        phone: f.phone.trim() || (isEdit ? null : undefined) as any,
        ...(isEdit ? { isActive: f.isActive } : {}),
      };
      if (isEdit) {
        await usersApi.update(f.id!, body);
      } else {
        await usersApi.create(body);
      }
      hapticNotify('success');
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Қате');
      hapticNotify('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="card form"
      style={{ borderColor: 'var(--brand-500)', borderWidth: 1, borderStyle: 'solid' }}
    >
      <div className="card__title">{isEdit ? '✏️ Өңдеу' : '+ Жаңа қызметкер'}</div>

      <label className="field">
        <span className="field__label">Аты-жөні *</span>
        <input
          className="input"
          value={f.fullName}
          onChange={(e) => setF({ ...f, fullName: e.target.value })}
          required
        />
      </label>

      <label className="field">
        <span className="field__label">Рөлі *</span>
        <select
          className="input"
          value={f.role}
          onChange={(e) => setF({ ...f, role: e.target.value as UserRole })}
        >
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_ICON[r]} {ROLE_LABEL[r]}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Логин (username)</span>
        <input
          className="input"
          value={f.username}
          onChange={(e) => setF({ ...f, username: e.target.value })}
          placeholder="мысалы: production"
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>

      <label className="field">
        <span className="field__label">
          {isEdit ? 'Жаңа пароль (бос қалдыру = өзгертпеу)' : 'Пароль *'}
        </span>
        <div style={{ position: 'relative' }}>
          <input
            className="input"
            type={showPwd ? 'text' : 'password'}
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            minLength={isEdit && !f.password ? undefined : 6}
            style={{ paddingRight: 64 }}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              padding: '4px 8px',
            }}
          >
            {showPwd ? 'жасыру' : 'көрсету'}
          </button>
        </div>
      </label>

      <div className="grid-2">
        <label className="field">
          <span className="field__label">Telegram ID</span>
          <input
            className="input"
            value={f.telegramId}
            onChange={(e) => setF({ ...f, telegramId: e.target.value })}
            placeholder="мыс: 123456789"
            inputMode="numeric"
          />
        </label>
        <label className="field">
          <span className="field__label">Telegram @username</span>
          <input
            className="input"
            value={f.telegramUsername}
            onChange={(e) => setF({ ...f, telegramUsername: e.target.value })}
            placeholder="@жоқ"
            autoCapitalize="none"
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Телефон</span>
        <input
          className="input"
          value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })}
          placeholder="+7 ..."
          inputMode="tel"
        />
      </label>

      <div className="info-banner" style={{ fontSize: 12 }}>
        💡 <strong>Telegram ID</strong> — қызметкер @GOSCONTROL_bot-та <code>/myid</code> басып алады.
        Болмаса хабарлама келмейді, бірақ қалғаны жұмыс істей береді.
      </div>

      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}

      <div className="flex gap-sm">
        <button type="submit" className="btn btn--primary" disabled={busy} style={{ flex: 1 }}>
          {busy ? 'Сақталуда...' : 'Сақтау'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          Бас тарту
        </button>
      </div>
    </form>
  );
}
