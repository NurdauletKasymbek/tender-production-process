import { Link } from 'react-router-dom';
import { Header } from '../../components/Header';
import { OrderCard } from '../../components/OrderCard';
import { Spinner } from '../../components/Spinner';
import { EmptyState } from '../../components/EmptyState';
import { useOrders } from '../../hooks/useOrders';
import type { OrderStatus } from '../../types';

interface Props {
  stage: OrderStatus;
  title: string;
}

const HINT: Partial<Record<OrderStatus, string>> = {
  PACKAGING: 'Қаптау аяқталған соң тапсырысты "Тиеуге беру" деп белгілеңіз.',
  LOADING: 'Тиеу аяқталған соң логистикаға жіберіңіз.',
};

const EMPTY: Partial<Record<OrderStatus, string>> = {
  PACKAGING: 'Қаптауды күтетін тапсырыс жоқ',
  LOADING: 'Тиеуді күтетін тапсырыс жоқ',
};

const ICON: Partial<Record<OrderStatus, string>> = {
  PACKAGING: '📦',
  LOADING: '🚛',
};

export function StageQueueHome({ stage, title }: Props) {
  const { orders, loading, error } = useOrders({ status: stage });

  return (
    <div className="page">
      <Header title={title} />

      <div className="hero-stat">
        <div className="hero-stat__label">{title}</div>
        <div className="hero-stat__value">{orders.length}</div>
        <div className="hero-stat__hint">{HINT[stage]}</div>
      </div>

      {(stage === 'LOADING' || stage === 'STORAGE') && (
        <Link to="/inventory" className="btn btn--soft btn--block">
          <span aria-hidden>📦</span>
          <span>Склад инвентары</span>
        </Link>
      )}

      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}
      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <EmptyState icon={ICON[stage] || '📦'} title={EMPTY[stage] || 'Тапсырыс жоқ'} />
      ) : (
        <>
          <h3 className="section-title">Кезек</h3>
          <div className="list">
            {orders.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        </>
      )}
    </div>
  );
}
