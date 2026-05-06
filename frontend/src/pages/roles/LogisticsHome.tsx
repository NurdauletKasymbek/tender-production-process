import { useState } from 'react';
import { Header } from '../../components/Header';
import { OrderCard } from '../../components/OrderCard';
import { Spinner } from '../../components/Spinner';
import { EmptyState } from '../../components/EmptyState';
import { useOrders } from '../../hooks/useOrders';
import type { OrderStatus } from '../../types';

const TABS: { key: OrderStatus; label: string }[] = [
  { key: 'LOGISTICS', label: 'Жолда' },
  { key: 'DELIVERY', label: 'Жеткізу' },
];

export function LogisticsHome() {
  const [tab, setTab] = useState<OrderStatus>('LOGISTICS');
  const { orders, loading, error } = useOrders({ status: tab });

  return (
    <div className="page">
      <Header title="Логистика" />
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tabs__item ${tab === t.key ? 'is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <EmptyState icon="🚚" title="Тапсырыс жоқ" />
      ) : (
        <div className="list">
          {orders.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </div>
  );
}
