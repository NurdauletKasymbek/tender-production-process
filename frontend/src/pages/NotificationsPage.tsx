import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { notificationsApi } from '../api/endpoints';
import type { Notification } from '../types';
import { formatDateTime } from '../utils/labels';

export function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await notificationsApi.list());
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Хабарламаларды жүктеу мүмкін болмады');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const markRead = async (n: Notification) => {
    if (n.isRead) return;
    try {
      await notificationsApi.markRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    } catch { /* ignore */ }
  };

  return (
    <div className="page">
      <Header title="Хабарламалар" showBell={false} />
      {error && <div className="alert alert--error">{error}</div>}
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState icon="🔕" title="Жаңа хабарлама жоқ" />
      ) : (
        <div className="list">
          {items.map((n) => {
            const inner = (
              <div className={`notif ${n.isRead ? '' : 'is-unread'}`} onClick={() => void markRead(n)}>
                <div className="notif__row">
                  <span className="notif__title">{n.title}</span>
                  {!n.isRead && <span className="notif__dot" />}
                </div>
                <div className="notif__msg">{n.message}</div>
                <div className="notif__time muted">{formatDateTime(n.createdAt)}</div>
              </div>
            );
            return n.orderId ? (
              <Link key={n.id} to={`/orders/${n.orderId}`} className="notif-link">{inner}</Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
