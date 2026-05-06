import { useMemo, useState } from 'react';
import { Header } from '../components/Header';
import { OrderCard } from '../components/OrderCard';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { useOrders } from '../hooks/useOrders';
import type { OrderStatus } from '../types';
import { STATUS_LABEL } from '../utils/labels';

const ALL_STATUSES: OrderStatus[] = [
  'NEW_TENDER', 'REVIEW', 'CONFIRMATION', 'PRODUCTION',
  'PACKAGING', 'LOADING', 'LOGISTICS', 'DELIVERY', 'CLOSED', 'REJECTED',
];

export function OrdersListPage() {
  const [status, setStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const params = useMemo(
    () => (status === 'ALL' ? {} : { status }),
    [status],
  );
  const { orders, loading, error } = useOrders(params);

  const filtered = useMemo(() => {
    if (!query.trim()) return orders;
    const q = query.toLowerCase();
    return orders.filter((o) =>
      o.tenderNumber.toLowerCase().includes(q) ||
      o.productName.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q),
    );
  }, [orders, query]);

  return (
    <div className="page">
      <Header title="Барлық тапсырыстар" />

      <input
        className="input"
        type="search"
        placeholder="Іздеу: тендер №, өнім, тапсырыс беруші"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="chips">
        <button
          className={`chip ${status === 'ALL' ? 'is-active' : ''}`}
          onClick={() => setStatus('ALL')}
        >
          Барлығы
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            className={`chip ${status === s ? 'is-active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔍" title="Тапсырыс табылмады" />
      ) : (
        <div className="list">
          {filtered.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </div>
  );
}
