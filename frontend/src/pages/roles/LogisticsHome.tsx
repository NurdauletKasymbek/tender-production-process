import { useState } from 'react';
import { DashboardHeader } from '../../components/DashboardHeader';
import { BrandCard } from '../../components/BrandCard';
import { OrderCard } from '../../components/OrderCard';
import { Spinner } from '../../components/Spinner';
import { EmptyState } from '../../components/EmptyState';
import { useOrders } from '../../hooks/useOrders';
import type { OrderStatus } from '../../types';

const TABS: { key: OrderStatus; label: string; icon: string }[] = [
  { key: 'LOGISTICS', label: 'Жолда', icon: '🛣️' },
  { key: 'DELIVERY', label: 'Жеткізуде', icon: '📍' },
];

export function LogisticsHome() {
  const [tab, setTab] = useState<OrderStatus>('LOGISTICS');
  const { orders, loading, error } = useOrders({ status: tab });

  return (
    <div className="page">
      <DashboardHeader />
      <BrandCard />

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tabs__item ${tab === t.key ? 'is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span aria-hidden style={{ marginRight: 4 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}
      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={tab === 'LOGISTICS' ? '🚚' : '📍'}
          title="Тапсырыс жоқ"
          description={tab === 'LOGISTICS' ? 'Тиеу аяқталғаннан кейін осында шығады.' : 'Жолда тапсырыстар жоқ.'}
        />
      ) : (
        <div className="list">
          {orders.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </div>
  );
}
