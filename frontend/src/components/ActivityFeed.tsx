import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ordersApi } from '../api/endpoints';
import type { ActivityItem } from '../types';
import { ROLE_LABEL, STATUS_LABEL } from '../utils/labels';

function fmt(s: string) {
  const d = new Date(s);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return 'қазір';
  if (diffMin < 60) return `${diffMin} мин`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} сағ`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} күн`;
  return d.toLocaleDateString('kk-KZ', { day: '2-digit', month: '2-digit' });
}

function renderItem(item: ActivityItem) {
  const actor = (
    <>
      <strong>{item.actor.fullName}</strong>
      <span className="muted"> · {ROLE_LABEL[item.actor.role]}</span>
    </>
  );

  if (item.kind === 'STATUS') {
    return (
      <>
        {actor}{' '}
        {item.fromStatus ? (
          <>
            <span className="muted">кезеңді ауыстырды:</span>{' '}
            <strong>
              {STATUS_LABEL[item.fromStatus]} → {item.toStatus ? STATUS_LABEL[item.toStatus] : '?'}
            </strong>
          </>
        ) : (
          <>
            <span className="muted">кезеңін бекітті:</span>{' '}
            <strong>{item.toStatus ? STATUS_LABEL[item.toStatus] : '?'}</strong>
          </>
        )}
        {item.comment && (
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            «{item.comment}»
          </div>
        )}
      </>
    );
  }
  if (item.kind === 'FILE') {
    return (
      <>
        {actor} <span className="muted">файл жүктеді:</span>{' '}
        <span>📎 {item.fileName}</span>
      </>
    );
  }
  return (
    <>
      {actor} <span className="muted">жазды:</span>{' '}
      «{item.text}»
      {item.hasFile && <span className="muted"> · 📎 файл</span>}
    </>
  );
}

/** Соңғы әрекеттер лентасы — ADMIN/DIRECTOR көреді. */
export function ActivityFeed({ limit = 15 }: { limit?: number }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ordersApi.activity(limit)
      .then(setItems)
      .catch((e) => setError(e?.message || 'Қате'))
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading) return <div className="muted" style={{ padding: 8 }}>Жүктелуде...</div>;
  if (error) return <div className="alert alert--error">{error}</div>;
  if (items.length === 0) {
    return <div className="muted" style={{ padding: 8 }}>Әрекет жоқ</div>;
  }

  return (
    <div className="activity">
      {items.map((it) => (
        <Link
          key={it.id}
          to={`/orders/${it.order.id}`}
          className="activity__item"
        >
          <div className="activity__icon" aria-hidden>
            {it.kind === 'STATUS' && '🔄'}
            {it.kind === 'FILE' && '📎'}
            {it.kind === 'MESSAGE' && '💬'}
          </div>
          <div className="activity__body">
            <div className="activity__line">{renderItem(it)}</div>
            <div className="activity__meta">
              <span className="muted">№{it.order.tenderNumber}</span>
              <span className="muted"> · {fmt(it.when)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
