import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { isTelegramApp } from '../utils/telegram';
import { Spinner } from '../components/Spinner';

export function LoginPage() {
  const { loginTelegram, loginWithPassword, loading, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Telegram Mini App-та автоматты түрде Telegram арқылы кіруге тырысамыз.
  useEffect(() => {
    if (isTelegramApp()) {
      void loginTelegram();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSubmitting(true);
    try {
      await loginWithPassword(username.trim(), password);
    } catch {
      // қате useAuth-та сақталды
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && isTelegramApp()) return <Spinner label="Жүйеге кіру..." />;

  return (
    <div className="login">
      <div className="login__hero">
        <div className="login__logo" aria-hidden>
          <span style={{ position: 'relative', zIndex: 1 }}>📦</span>
        </div>
        <h1 className="login__title">Тендер · Өндіріс</h1>
        <p className="login__subtitle">
          Жүйеге кіру үшін логин мен парольді енгізіңіз.
        </p>
      </div>

      <form className="form" onSubmit={submit} autoComplete="on">
        <label className="field">
          <span className="field__label">Логин</span>
          <input
            className="input"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="мысалы: admin"
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field__label">Пароль</span>
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type={showPwd ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ paddingRight: 64 }}
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
                color: 'var(--text-muted, #666)',
                padding: '4px 8px',
              }}
            >
              {showPwd ? 'жасыру' : 'көрсету'}
            </button>
          </div>
        </label>

        {error && (
          <div className="alert alert--error">
            <span aria-hidden>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn btn--primary btn--lg btn--block"
          disabled={submitting || !username.trim() || !password}
        >
          {submitting ? 'Кіру...' : 'Кіру'}
        </button>
      </form>

      {isTelegramApp() && (
        <button
          className="btn btn--ghost btn--block"
          style={{ marginTop: 12, fontSize: 13 }}
          onClick={() => void loginTelegram()}
          disabled={loading}
        >
          Telegram арқылы кіру
        </button>
      )}

      <div className="login__hint" style={{ marginTop: 16, fontSize: 12 }}>
        Логиніңізді ұмыттыңыз ба? Әкімшіге хабарласыңыз.
      </div>
    </div>
  );
}
