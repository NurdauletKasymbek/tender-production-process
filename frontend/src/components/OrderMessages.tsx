import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { filesApi, messagesApi } from '../api/endpoints';
import type { OrderMessage } from '../types';
import { ROLE_LABEL, STATUS_LABEL } from '../utils/labels';
import { useAuth } from '../hooks/useAuth';
import { hapticImpact, hapticNotify } from '../utils/telegram';

interface Props {
  orderId: string;
  /** Тапсырыстағы соңғы өзгерістерден кейін parent-ке хабар беру */
  onUpdated?: () => void;
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

const isImage = (mime?: string | null) => !!mime && mime.startsWith('image/');

/**
 * Тапсырыс бойынша Telegram сияқты қарапайым чат.
 *   - 📎 батырмамен файл (фото/PDF) тікелей жүктеу
 *   - Жай мәтін немесе мәтін+файл (немесе тек файл) жіберу
 *   - Сурет — bubble ішінде кішкене thumbnail, басылса жаңа tab-та ашылады
 *   - Хабарлама жіберілгенде бар қатысушылар Telegram-нан ескерту алады
 */
export function OrderMessages({ orderId, onUpdated }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<OrderMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [pendingFile, setPendingFile] = useState<{
    id: string;
    name: string;
    mimeType: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const list = await messagesApi.list(orderId);
      setItems(list);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Жүктеу қатесі');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { void load(); }, [load]);

  // Жаңа хабарлама келсе төменге айналдыру
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items.length]);

  const pickFile = () => fileInputRef.current?.click();

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUploading(true);
    setError(null);
    try {
      hapticImpact('light');
      const uploaded = await filesApi.upload({
        orderId,
        file: f,
        fileType: 'OTHER', // чаттан жүктелген файл — еркін
      });
      setPendingFile({
        id: uploaded.id,
        name: uploaded.fileName,
        mimeType: uploaded.mimeType,
      });
      onUpdated?.(); // parent-ке файл саны өзгергенін айту
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Файл жүктеу қатесі');
      hapticNotify('error');
    } finally {
      setUploading(false);
    }
  };

  const clearPending = () => setPendingFile(null);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t && !pendingFile) return;
    setBusy(true);
    setError(null);
    try {
      hapticImpact('light');
      await messagesApi.create(orderId, {
        text: t,
        fileId: pendingFile?.id,
      });
      hapticNotify('success');
      setText('');
      setPendingFile(null);
      await load();
    } catch (err: any) {
      hapticNotify('error');
      setError(err?.response?.data?.message || err?.message || 'Жіберу қатесі');
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
            const fileUrl = m.file ? filesApi.downloadUrl(m.file.id, true) : null;
            const showImage = m.file && isImage(m.file.mimeType) && fileUrl;
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
                  {m.text && <div className="msg-bubble__body">{m.text}</div>}
                  {m.file && (
                    showImage ? (
                      <a
                        href={fileUrl!}
                        target="_blank"
                        rel="noreferrer"
                        className="msg-bubble__img"
                      >
                        <img src={fileUrl!} alt={m.file.fileName} loading="lazy" />
                      </a>
                    ) : (
                      <a
                        href={fileUrl!}
                        target="_blank"
                        rel="noreferrer"
                        className="msg-bubble__file"
                      >
                        📎 {m.file.fileName}
                      </a>
                    )
                  )}
                  <div className="msg-bubble__meta">
                    {STATUS_LABEL[m.stage]} · {fmtTime(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={listEndRef} />
        </div>
      )}

      {pendingFile && (
        <div className="msg-pending">
          {isImage(pendingFile.mimeType) ? (
            <span aria-hidden>🖼️</span>
          ) : (
            <span aria-hidden>📄</span>
          )}
          <span className="msg-pending__name">{pendingFile.name}</span>
          <button
            type="button"
            className="msg-pending__remove"
            onClick={clearPending}
            aria-label="Файлды алып тастау"
          >
            ×
          </button>
        </div>
      )}

      <form className="msg-form" onSubmit={submit}>
        <div className="msg-form__row">
          <button
            type="button"
            className="msg-attach"
            onClick={pickFile}
            disabled={busy || uploading}
            aria-label="Файл тіркеу"
            title="Фото немесе PDF тіркеу"
          >
            {uploading ? '...' : <ClipIcon />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
            onChange={onPickFile}
          />
          <textarea
            className="input msg-textarea"
            rows={1}
            placeholder="Хабарлама жазу..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            disabled={busy}
            maxLength={2000}
          />
          <button
            type="submit"
            className="msg-send"
            disabled={busy || (!text.trim() && !pendingFile)}
            aria-label="Жіберу"
          >
            {busy ? '...' : <SendIcon />}
          </button>
        </div>
      </form>
    </div>
  );
}

function ClipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l8.57-8.57a4 4 0 1 1 5.66 5.66L9.41 17.41a2 2 0 1 1-2.83-2.83l7.07-7.07"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M2 12 22 2l-7 20-3-9-10-1Z" fill="currentColor"/>
    </svg>
  );
}
