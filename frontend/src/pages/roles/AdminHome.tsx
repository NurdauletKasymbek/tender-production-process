import { useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import { Spinner } from '../../components/Spinner';
import { OrderCard } from '../../components/OrderCard';
import { EmptyState } from '../../components/EmptyState';
import { ordersApi } from '../../api/endpoints';
import type { DashboardStats, Order } from '../../types';
import { STATUS_COLOR, STATUS_LABEL } from '../../utils/labels';
import { Link } from 'react-router-dom';

export function AdminHome() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<Order[]>([]);
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
        setRecent(list.slice(0, 10));
      } catch (e: any) {
        setError(e.message || 'Деректерді жүктеу қатесі');
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="page">
      <Header title="Әкімші панелі" />

      {error && <div className="alert alert--error">{error}</div>}

      {stats && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-card__value">{stats.activeCount}</div>
              <div className="stat-card__label">Белсенді</div>
            </div>
            <div className="stat-card stat-card--danger">
              <div className="stat-card__value">{stats.overdueCount}</div>
              <div className="stat-card__label">Кешіктірілді</div>
            </div>
          </div>

          <div className="card">
            {stats.byStatus.map((s) => (
              <div key={s.status} className="row">
                <span className="row__dot" style={{ background: STATUS_COLOR[s.status] }} />
                <span className="row__label">{STATUS_LABEL[s.status]}</span>
                <span className="row__value">{s.count}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="section-title">Соңғы тапсырыстар</h3>
      <Link to="/orders/new" className="btn btn--primary">+ Тапсырыс жасау</Link>

      {recent.length === 0 ? (
        <EmptyState icon="🗂️" title="Тапсырыс жоқ" />
      ) : (
        <div className="list">
          {recent.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </div>
  );
}
