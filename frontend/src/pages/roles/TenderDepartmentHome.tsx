import { useState } from 'react';
import { Header } from '../../components/Header';
import { OrderCard } from '../../components/OrderCard';
import { Spinner } from '../../components/Spinner';
import { EmptyState } from '../../components/EmptyState';
import { useOrders } from '../../hooks/useOrders';
import type { OrderStatus } from '../../types';
import { STATUS_LABEL } from '../../utils/labels';
import { Link } from 'react-router-dom';

const TABS: { key: OrderStatus; short: string }[] = [
  { key: 'NEW_TENDER', short: 'Жаңа' },
  { key: 'REVIEW', short: 'Тексеруде' },
  { key: 'CONFIRMATION', short: 'Растауда' },
];

export function TenderDepartmentHome() {
  const [tab, setTab] = useState<OrderStatus>('NEW_TENDER');
  const { orders, loading, error } = useOrders({ status: tab });

  return (
    <div className="page">
      <Header title="Тендерлік бөлім" />

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tabs__item ${tab === t.key ? 'is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.short}
          </button>
        ))}
      </div>

      <Link to="/orders/new" className="btn btn--primary btn--lg">+ Қолмен тапсырыс жасау</Link>

      {error && <div className="alert alert--error">{error}</div>}
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
