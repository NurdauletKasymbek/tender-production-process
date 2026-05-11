import { FormEvent, useCallback, useEffect, useState } from 'react';
import { messagesApi } from '../api/endpoints';
import type { OrderFile, OrderMessage } from '../types';
import { ROLE_LABEL, STATUS_LABEL } from '../utils/labels';
import { useAuth } from '../hooks/useAuth';
import { hapticImpact, hapticNotify } from '../utils/telegram';

interface Props {
  orderId: string;
  /** Тапсырыс файлдары — хабарламаға тіркеу үшін таңдау тізімі */
  files?: OrderFile[];
}

function fmtTime(s: string) {
  const d = new Date(s);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString('kk-KZ', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleString('kk-KZ', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Тапсырыс бойынша кезеңаралық чат.
 * Әр кезеңде кез келген жауапты мәтін + (қажет болса) бар файлдың сілтемесін
 * қалдыра алады. Хабарлама барлық қатысушыларға Telegram-ға келеді.
 */
export function OrderMessages({ orderId, files = [] }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<OrderMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [attachedFileId, setAttachedFileId] = useState<string | ''>('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await messagesApi.list(orderId));
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Жүктеу қатесі');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      hapticImpact('light');
      await messagesApi.create(orderId, {
        text: text.trim(),
        fileId: attachedFileId || undefined,
      });
      hapticNotify('success');
      setText('');
      setAttachedFileId('');
      await load();
    } catch (e: any) {
      hapticNotify('error');
      setError(e?.response?.data?.message || e?.message || 'Жіберу қатесі');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="msg-box">
      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}

      {loading ? (
        <div className="muted" style={{ padding: 12 }}>Жүктелуде...</div>
      ) : items.length === 0 ? (
        <div className="muted" style={{ padding: 12, textAlign: 'center' }}>
          Әзірге хабарлама жоқ. Алғашқысын сіз қалдырыңыз.
        </div>
      ) : (
        <div className="msg-list">
          {items.map((m) => {
            const own = m.author.id === user?.id;
            return (
              <div
                key={m.id}
                className={`msg-row ${own ? 'msg-row--own' : ''}`}
              >
                <div className="msg-bubble">
                  <div className="msg-bubble__head">
                    <strong>{m.author.fullName}</strong>
                    <span className="muted"> · {ROLE_LABEL[m.author.role]}</span>
                  </div>
                  <div className="msg-bubble__body">{m.text}</div>
                  {m.file && (
                    <div className="msg-bubble__file">
                      📎 {m.file.fileName}
                    </div>
                  )}
                  <div className="msg-bubble__meta">
                    {STATUS_LABEL[m.stage]} кезеңі · {fmtTime(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form className="msg-form" onSubmit={submit}>
        {files.length > 0 && (
          <label className="field" style={{ marginBottom: 8 }}>
            <span className="field__label">📎 Файл тіркеу (қажет болса)</span>
            <select
              className="input"
              value={attachedFileId}
              onChange={(e) => setAttachedFileId(e.target.value)}
            >
              <option value="">— тіркемеу —</option>
              {files.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.fileName}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="msg-form__row">
          <textarea
            className="input"
            rows={2}
            placeholder="Хабарлама жазу..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            maxLength={2000}
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={busy || !text.trim()}
          >
            {busy ? '...' : 'Жіберу'}
          </button>
        </div>
      </form>
    </div>
  );
}
