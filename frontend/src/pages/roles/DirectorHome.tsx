import { useEffect, useState } from 'react';
import { DashboardHeader } from '../../components/DashboardHeader';
import { BrandCard } from '../../components/BrandCard';
import { ActivityFeed } from '../../components/ActivityFeed';
import { Spinner } from '../../components/Spinner';
import { OrderCard } from '../../components/OrderCard';
import { EmptyState } from '../../components/EmptyState';
import { ordersApi } from '../../api/endpoints';
import type { DashboardStats, Order, OrderStatus } from '../../types';
import { STATUS_COLOR, STATUS_LABEL } from '../../utils/labels';

const STAGES: OrderStatus[] = [
  'NEW_TENDER', 'REVIEW', 'CONFIRMATION',
  'PRODUCTION', 'PACKAGING', 'LOADING', 'LOGISTICS', 'DELIVERY',
];

export function DirectorHome() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [stageFilter, setStageFilter] = useState<OrderStatus | 'ALL'>('CONFIRMATION');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, list] = await Promise.all([
          ordersApi.dashboard(),
          ordersApi.list(),
        ]);
        setStats(s);
        setAllOrders(list);
      } catch (e: any) {
        setError(e.message || 'Деректерді жүктеу қатесі');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner />;

  const filtered = stageFilter === 'ALL'
    ? allOrders.filter((o) => o.status !== 'CLOSED' && o.status !== 'REJECTED')
    : allOrders.filter((o) => o.status === stageFilter);

  const confirmationCount = allOrders.filter((o) => o.status === 'CONFIRMATION').length;

  return (
    <div className="page">
      <DashboardHeader />
      <BrandCard />

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
              <div className="stat-card__value">{confirmationCount}</div>
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

      <button
        className="btn btn--soft btn--block"
        onClick={() => void ordersApi.downloadCsv()}
      >
        <span aria-hidden>📊</span>
        <span>Excel-ге экспорттау (CSV)</span>
      </button>

      <h3 className="section-title">⚡ Соңғы әрекеттер</h3>
      <ActivityFeed limit={8} />

      <h3 className="section-title">Барлық тапсырыстар</h3>
      <div className="chips">
        <button
          className={`chip ${stageFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => setStageFilter('ALL')}
        >
          Барлығы ({allOrders.filter((o) => o.status !== 'CLOSED' && o.status !== 'REJECTED').length})
        </button>
        {STAGES.map((s) => {
          const count = allOrders.filter((o) => o.status === s).length;
          return (
            <button
              key={s}
              className={`chip ${stageFilter === s ? 'is-active' : ''}`}
              onClick={() => setStageFilter(s)}
            >
              {STATUS_LABEL[s]} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="📭"
          title="Тапсырыс жоқ"
          description="Таңдалған кезеңде тапсырыстар жоқ"
        />
      ) : (
        <div className="list">
          {filtered.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </div>
  );
}
