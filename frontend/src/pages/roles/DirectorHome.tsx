import { useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import { Spinner } from '../../components/Spinner';
import { OrderCard } from '../../components/OrderCard';
import { EmptyState } from '../../components/EmptyState';
import { ordersApi } from '../../api/endpoints';
import type { DashboardStats, Order } from '../../types';
import { STATUS_COLOR, STATUS_LABEL } from '../../utils/labels';

export function DirectorHome() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [confirmation, setConfirmation] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, list] = await Promise.all([
          ordersApi.dashboard(),
          ordersApi.list({ status: 'CONFIRMATION' }),
        ]);
        setStats(s);
        setConfirmation(list);
      } catch (e: any) {
        setError(e.message || 'Деректерді жүктеу қатесі');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="page">
      <Header title="Басшылық дашборды" />

      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}

      {stats && (
        <>
          <div className="hero-stat">
            <div className="hero-stat__label">Белсенді тапсырыстар</div>
            <div className="hero-stat__value">{stats.activeCount}</div>
            <div className="hero-stat__hint">Бизнес-цикл бойындағы барлық тапсырыстар</div>
          </div>

          <div className="stat-grid">
            <div className="stat-card stat-card--danger">
              <div className="stat-card__icon" aria-hidden>⏰</div>
              <div className="stat-card__value">{stats.overdueCount}</div>
              <div className="stat-card__label">Мерзімі өтті</div>
            </div>
            <div className="stat-card stat-card--warning">
              <div className="stat-card__icon" aria-hidden>📥</div>
              <div className="stat-card__value">{confirmation.length}</div>
              <div className="stat-card__label">Растауды күтуде</div>
            </div>
          </div>

          <h3 className="section-title">Кезеңдер бойынша</h3>
          <div className="card">
            {stats.byStatus.length === 0 ? (
              <div className="muted">Деректер жоқ</div>
            ) : (
              stats.byStatus.map((s) => (
                <div key={s.status} className="row">
                  <span className="row__dot" style={{ background: STATUS_COLOR[s.status] }} />
                  <span className="row__label">{STATUS_LABEL[s.status]}</span>
                  <span className="row__value">{s.count}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}

      <h3 className="section-title">Растауды күтуде</h3>
      {confirmation.length === 0 ? (
        <EmptyState
          icon="✅"
          title="Растауды күтетін тапсырыс жоқ"
          description="Тендерлік бөлім тексеруден өткізген соң мұнда көрсетіледі."
        />
      ) : (
        <div className="list">
          {confirmation.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </div>
  );
}
