import { useState } from 'react';
import { DashboardHeader } from '../../components/DashboardHeader';
import { BrandCard } from '../../components/BrandCard';
import { OrderCard } from '../../components/OrderCard';
import { Spinner } from '../../components/Spinner';
import { EmptyState } from '../../components/EmptyState';
import { GoszakupSync } from '../../components/GoszakupSync';
import { useOrders } from '../../hooks/useOrders';
import type { OrderStatus } from '../../types';
import { STATUS_LABEL } from '../../utils/labels';
import { Link } from 'react-router-dom';

const TABS: { key: OrderStatus; short: string; icon: string }[] = [
  { key: 'NEW_TENDER', short: 'Жаңа', icon: '🆕' },
  { key: 'REVIEW', short: 'Тексеруде', icon: '🔍' },
  { key: 'CONFIRMATION', short: 'Растауда', icon: '⏳' },
];

export function TenderDepartmentHome() {
  const [tab, setTab] = useState<OrderStatus>('NEW_TENDER');
  const { orders, loading, error, reload } = useOrders({ status: tab });

  return (
    <div className="page">
      <DashboardHeader />
      <BrandCard />

      <GoszakupSync onSynced={() => void reload()} />

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tabs__item ${tab === t.key ? 'is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span aria-hidden style={{ marginRight: 4 }}>{t.icon}</span>
            {t.short}
          </button>
        ))}
      </div>

      <Link to="/orders/new" className="btn btn--soft btn--lg btn--block">
        <span aria-hidden>+</span>
        <span>Қолмен тапсырыс жасау</span>
      </Link>

      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}
      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <EmptyState
          icon="📭"
          title={`${STATUS_LABEL[tab]} тапсырысы жоқ`}
          description="Goszakup-тан жаңа тендер келгенде осы жерде көрсетіледі."
        />
      ) : (
        <div className="list">
          {orders.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </div>
  );
}
