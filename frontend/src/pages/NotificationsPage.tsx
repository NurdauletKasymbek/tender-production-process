import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { notificationsApi } from '../api/endpoints';
import type { Notification } from '../types';
import { formatDateTime } from '../utils/labels';

const TYPE_ICON: Record<string, { icon: string; cls: string }> = {
  STATUS_CHANGE: { icon: '🔄', cls: 'notif__icon--status' },
  TASK_ASSIGNED: { icon: '🎯', cls: 'notif__icon--task' },
  DEADLINE_WARNING: { icon: '⏰', cls: 'notif__icon--deadline' },
  DELAY: { icon: '🚨', cls: 'notif__icon--delay' },
  COMPLETED: { icon: '✓', cls: 'notif__icon--completed' },
  NEW_ORDER: { icon: '🆕', cls: 'notif__icon--new' },
};

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

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <div className="page">
      <Header title="Хабарламалар" showBell={false} />

      {unreadCount > 0 && (
        <div className="info-banner">
          <strong>{unreadCount}</strong> оқылмаған хабарлама
        </div>
      )}

      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon="🔕"
          title="Жаңа хабарлама жоқ"
          description="Тапсырыс күйі өзгергенде немесе сізге тапсырма берілгенде осында көрсетіледі."
        />
      ) : (
        <div className="list">
          {items.map((n) => {
            const t = TYPE_ICON[n.type] || { icon: '📨', cls: 'notif__icon--status' };
            const inner = (
              <div className={`notif ${n.isRead ? '' : 'is-unread'}`} onClick={() => void markRead(n)}>
                <div className="notif__layout">
                  <span className={`notif__icon ${t.cls}`} aria-hidden>{t.icon}</span>
                  <div className="notif__body">
                    <div className="notif__row">
                      <span className="notif__title">{n.title}</span>
                      {!n.isRead && <span className="notif__dot" />}
                    </div>
                    <div className="notif__msg">{n.message}</div>
                    <div className="notif__time">{formatDateTime(n.createdAt)}</div>
                  </div>
                </div>
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
