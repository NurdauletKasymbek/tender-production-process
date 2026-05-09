import { useEffect, useState } from 'react';
import { goszakupApi } from '../api/endpoints';
import { hapticImpact, hapticNotify, showConfirm } from '../utils/telegram';

interface SyncResult {
  ok: boolean;
  configured?: boolean;
  fetched?: number;
  created?: number;
  skipped?: number;
  silent?: boolean;
  message?: string;
}

interface CleanupResult {
  ok: boolean;
  fetched?: number;
  closedDoneIds?: number;
  closed?: number;
  message?: string;
}

export function GoszakupSync({ onSynced }: { onSynced?: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<'sync' | 'bulk' | 'cleanup' | null>(null);
  const [last, setLast] = useState<SyncResult | null>(null);
  const [cleanup, setCleanup] = useState<CleanupResult | null>(null);

  useEffect(() => {
    goszakupApi.status()
      .then((s) => setConfigured(s.configured))
      .catch(() => setConfigured(false));
  }, []);

  const run = async (silent: boolean) => {
    if (silent) {
      const ok = await showConfirm(
        'Бастапқы импорт: барлық бар келісімшарттар жасалады, бірақ Telegram хабарламасы жіберілмейді. ' +
          'Мұны бір рет жасайсыз. Жалғастырамыз ба?',
      );
      if (!ok) return;
    }
    setBusy(silent ? 'bulk' : 'sync');
    try {
      hapticImpact('light');
      const res = await goszakupApi.sync(silent);
      setLast(res);
      hapticNotify(res.ok ? 'success' : 'error');
      if (res.ok && res.created && res.created > 0) onSynced?.();
    } catch (e: any) {
      setLast({ ok: false, message: e.message || 'Қате' });
      hapticNotify('error');
    } finally {
      setBusy(null);
    }
  };

  const runCleanup = async () => {
    const ok = await showConfirm(
      'Goszakup-та "Утвержден" актісі бар тапсырыстар CLOSED күйіне ауыстырылады. ' +
        'Бұл деректерді өзгертеді — жалғастырамыз ба?',
    );
    if (!ok) return;
    setBusy('cleanup');
    try {
      hapticImpact('light');
      const res = await goszakupApi.cleanupApproved();
      setCleanup(res);
      hapticNotify(res.ok ? 'success' : 'error');
      if (res.ok && res.closed && res.closed > 0) onSynced?.();
    } catch (e: any) {
      setCleanup({ ok: false, message: e.message || 'Қате' });
      hapticNotify('error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card">
      <div className="card__row">
        <div>
          <div className="card__title">Goszakup интеграциясы</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Жеңіске жеткен тендерлерді автоматты алу
          </div>
        </div>
        <span className="status-badge status-badge--sm" style={{
          background: configured ? 'var(--success-bg)' : 'var(--warning-bg)',
          color: configured ? 'var(--success)' : 'var(--warning)',
        }}>
          <span className="status-badge__dot" style={{
            background: configured ? 'var(--success)' : 'var(--warning)',
          }} />
          {configured === null ? '...' : configured ? 'Қосылған' : 'Бапталмаған'}
        </span>
      </div>

      {configured === false && (
        <div className="info-banner" style={{ fontSize: 12 }}>
          <strong>GOSZAKUP_API_TOKEN</strong> және <strong>GOSZAKUP_BIN</strong> орнатылмаған.
          Vercel/backend env-те қосыңыз.
        </div>
      )}

      <button
        className="btn btn--soft btn--block"
        onClick={() => void run(false)}
        disabled={!!busy || !configured}
      >
        {busy === 'sync' ? 'Сұрау орындалуда...' : (
          <>
            <span aria-hidden>🔄</span>
            <span>Қазір синхрондау</span>
          </>
        )}
      </button>

      <button
        className="btn btn--ghost btn--block"
        onClick={() => void run(true)}
        disabled={!!busy || !configured}
        style={{ fontSize: 13 }}
      >
        {busy === 'bulk' ? 'Импорт орындалуда...' : (
          <>
            <span aria-hidden>📥</span>
            <span>Бастапқы импорт (хабарламасыз)</span>
          </>
        )}
      </button>

      {last && (
        <div
          className={`alert ${last.ok ? 'alert--success' : 'alert--error'}`}
          style={{ fontSize: 12.5 }}
        >
          {last.ok ? (
            <>
              <span>✓</span>
              <span>
                Алынды: <strong>{last.fetched ?? 0}</strong>,
                жаңа: <strong>{last.created ?? 0}</strong>,
                бұрыннан бар: <strong>{last.skipped ?? 0}</strong>
                {last.silent && <> · хабарламасыз</>}
              </span>
            </>
          ) : (
            <>
              <span>⚠️</span>
              <span>{last.message || 'Синхрондау сәтсіз'}</span>
            </>
          )}
        </div>
      )}

      <button
        className="btn btn--ghost btn--block"
        onClick={() => void runCleanup()}
        disabled={!!busy || !configured}
        style={{ fontSize: 13 }}
      >
        {busy === 'cleanup' ? 'Тазарту орындалуда...' : (
          <>
            <span aria-hidden>🧹</span>
            <span>Бітіп қойғандарды тазарту</span>
          </>
        )}
      </button>

      {cleanup && (
        <div
          className={`alert ${cleanup.ok ? 'alert--success' : 'alert--error'}`}
          style={{ fontSize: 12.5 }}
        >
          {cleanup.ok ? (
            <>
              <span>✓</span>
              <span>
                Goszakup-та бітіп қойған: <strong>{cleanup.closedDoneIds ?? 0}</strong>,
                CLOSED-ке көшті: <strong>{cleanup.closed ?? 0}</strong>
              </span>
            </>
          ) : (
            <>
              <span>⚠️</span>
              <span>{cleanup.message || 'Тазарту сәтсіз'}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
