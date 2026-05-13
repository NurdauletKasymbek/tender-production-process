import { useMemo, useState } from 'react';
import { Header } from '../components/Header';
import { OrderCard } from '../components/OrderCard';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { useOrders } from '../hooks/useOrders';
import type { Order, OrderStatus } from '../types';
import { STATUS_LABEL } from '../utils/labels';

const ALL_STATUSES: OrderStatus[] = [
  'NEW_TENDER', 'REVIEW', 'CONFIRMATION', 'PRODUCTION',
  'PACKAGING', 'STORAGE', 'LOADING', 'LOGISTICS', 'DELIVERY', 'CLOSED', 'REJECTED',
];

type QuickFilter = 'ALL' | 'ACTIVE' | 'OVERDUE' | 'CLOSED' | 'MINE';

function isOverdue(o: Order) {
  if (o.status === 'CLOSED' || o.status === 'REJECTED') return false;
  return new Date(o.deadline).getTime() < Date.now();
}

export function OrdersListPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | null>(null);
  const [quick, setQuick] = useState<QuickFilter>('ALL');
  const [query, setQuery] = useState('');

  // "Мендегілер" сүзгісі — backend-тен mine=true сұрау
  const params = useMemo(
    () => (quick === 'MINE' ? { mine: true } : {}),
    [quick],
  );
  const { orders, loading, error } = useOrders(params);

  const counts = useMemo(() => {
    return {
      all: orders.length,
      active: orders.filter((o) => o.status !== 'CLOSED' && o.status !== 'REJECTED').length,
      overdue: orders.filter(isOverdue).length,
      closed: orders.filter((o) => o.status === 'CLOSED').length,
    };
  }, [orders]);

  const filtered = useMemo(() => {
    let list = orders;

    // Тез сүзгі
    if (quick === 'ACTIVE') {
      list = list.filter((o) => o.status !== 'CLOSED' && o.status !== 'REJECTED');
    } else if (quick === 'OVERDUE') {
      list = list.filter(isOverdue);
    } else if (quick === 'CLOSED') {
      list = list.filter((o) => o.status === 'CLOSED');
    }

    // Нақты кезеңге сүзгі
    if (statusFilter) {
      list = list.filter((o) => o.status === statusFilter);
    }

    // Іздеу
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((o) =>
        o.tenderNumber.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.customerBin || '').toLowerCase().includes(q),
      );
    }

    // Сорт: басымдық → мерзім (асс)
    return [...list].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [orders, quick, statusFilter, query]);

  return (
    <div className="page">
      <Header title="Барлық тапсырыстар" />

      <input
        className="input"
        type="search"
        placeholder="Іздеу: тендер №, өнім, тапсырыс беруші, БСН"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="chips">
        <button
          className={`chip ${quick === 'ALL' ? 'is-active' : ''}`}
          onClick={() => { setQuick('ALL'); setStatusFilter(null); }}
        >
          Барлығы <span className="chip__count">{counts.all}</span>
        </button>
        <button
          className={`chip ${quick === 'ACTIVE' ? 'is-active' : ''}`}
          onClick={() => { setQuick('ACTIVE'); setStatusFilter(null); }}
        >
          ⚡ Белсенді <span className="chip__count">{counts.active}</span>
        </button>
        <button
          className={`chip ${quick === 'OVERDUE' ? 'is-active' : ''}`}
          onClick={() => { setQuick('OVERDUE'); setStatusFilter(null); }}
        >
          ⏰ Кешіктірілген <span className="chip__count">{counts.overdue}</span>
        </button>
        <button
          className={`chip ${quick === 'MINE' ? 'is-active' : ''}`}
          onClick={() => { setQuick('MINE'); setStatusFilter(null); }}
        >
          👤 Менікі
        </button>
        <button
          className={`chip ${quick === 'CLOSED' ? 'is-active' : ''}`}
          onClick={() => { setQuick('CLOSED'); setStatusFilter(null); }}
        >
          ✓ Жабылған <span className="chip__count">{counts.closed}</span>
        </button>
      </div>

      {/* Толық кезең таңдау — біріншіден кейін */}
      <div className="chips">
        <button
          className={`chip chip--sm ${!statusFilter ? 'is-active' : ''}`}
          onClick={() => setStatusFilter(null)}
        >
          Әр кезеңде
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            className={`chip chip--sm ${statusFilter === s ? 'is-active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Тапсырыс табылмады"
          description={query ? 'Іздеу шарттарын өзгертіп көріңіз' : undefined}
        />
      ) : (
        <>
          <div className="muted" style={{ fontSize: 12, padding: '4px 4px 0' }}>
            {filtered.length} тапсырыс
          </div>
          <div className="list">
            {filtered.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        </>
      )}
    </div>
  );
}
