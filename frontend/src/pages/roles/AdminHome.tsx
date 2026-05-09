import { useCallback, useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import { Spinner } from '../../components/Spinner';
import { OrderCard } from '../../components/OrderCard';
import { EmptyState } from '../../components/EmptyState';
import { GoszakupSync } from '../../components/GoszakupSync';
import { ordersApi } from '../../api/endpoints';
import type { DashboardStats, Order } from '../../types';
import { STATUS_COLOR, STATUS_LABEL } from '../../utils/labels';
import { Link } from 'react-router-dom';

export function AdminHome() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Spinner />;

  const closedCount = stats?.byStatus.find((s) => s.status === 'CLOSED')?.count ?? 0;

  return (
    <div className="page">
      <Header title="Әкімші панелі" />

      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}

      {stats && (
        <>
          <div className="hero-stat">
            <div className="hero-stat__label">Белсенді тапсырыстар</div>
            <div className="hero-stat__value">{stats.activeCount}</div>
            <div className="hero-stat__hint">
              Барлық кезеңдер бойынша қозғалыстағы тапсырыстар
            </div>
          </div>

          <div className="stat-grid stat-grid--3">
            <div className="stat-card stat-card--danger">
              <div className="stat-card__icon" aria-hidden>⏰</div>
              <div className="stat-card__value">{stats.overdueCount}</div>
              <div className="stat-card__label">Кешіктірілді</div>
            </div>
            <div className="stat-card stat-card--success">
              <div className="stat-card__icon" aria-hidden>✓</div>
              <div className="stat-card__value">{closedCount}</div>
              <div className="stat-card__label">Жабылды</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon" aria-hidden>📊</div>
              <div className="stat-card__value">{stats.byStatus.length}</div>
              <div className="stat-card__label">Кезеңдер</div>
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

      <GoszakupSync onSynced={() => void load()} />

      <div className="flex gap-sm" style={{ flexDirection: 'column' }}>
        <Link to="/orders/new" className="btn btn--primary btn--lg btn--block">
          <span aria-hidden>+</span>
          <span>Тапсырыс жасау</span>
        </Link>
        <Link to="/admin/users" className="btn btn--soft btn--block">
          <span aria-hidden>👥</span>
          <span>Қызметкерлер және парольдер</span>
        </Link>
        <Link to="/inventory" className="btn btn--soft btn--block">
          <span aria-hidden>📦</span>
          <span>Склад инвентары</span>
        </Link>
        <button
          className="btn btn--soft btn--block"
          onClick={() => void ordersApi.downloadCsv()}
        >
          <span aria-hidden>📊</span>
          <span>Excel-ге экспорттау (CSV)</span>
        </button>
      </div>

      <h3 className="section-title">Соңғы тапсырыстар</h3>

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
