import { useEffect, useState } from 'react';
import { goszakupApi } from '../api/endpoints';
import { hapticImpact, hapticNotify } from '../utils/telegram';

interface SyncResult {
  ok: boolean;
  configured?: boolean;
  fetched?: number;
  created?: number;
  skipped?: number;
  message?: string;
}

export function GoszakupSync({ onSynced }: { onSynced?: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SyncResult | null>(null);

  useEffect(() => {
    goszakupApi.status()
      .then((s) => setConfigured(s.configured))
      .catch(() => setConfigured(false));
  }, []);

  const sync = async () => {
    setBusy(true);
    try {
      hapticImpact('light');
      const res = await goszakupApi.sync();
      setLast(res);
      hapticNotify(res.ok ? 'success' : 'error');
      if (res.ok && res.created && res.created > 0) onSynced?.();
    } catch (e: any) {
      setLast({ ok: false, message: e.message || 'Қате' });
      hapticNotify('error');
    } finally {
      setBusy(false);
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
        <span className={`status-badge status-badge--sm`} style={{
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
        onClick={() => void sync()}
        disabled={busy || !configured}
      >
        {busy ? 'Сұрау орындалуда...' : (
          <>
            <span aria-hidden>🔄</span>
            <span>Қазір синхрондау</span>
          </>
        )}
      </button>

      {last && (
        <div className={`alert ${last.ok ? 'alert--success' : 'alert--error'}`}
             style={{ fontSize: 12.5 }}>
          {last.ok ? (
            <>
              <span>✓</span>
              <span>
                Алынды: <strong>{last.fetched ?? 0}</strong>,
                жаңа: <strong>{last.created ?? 0}</strong>,
                бұрыннан бар: <strong>{last.skipped ?? 0}</strong>
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
    </div>
  );
}
