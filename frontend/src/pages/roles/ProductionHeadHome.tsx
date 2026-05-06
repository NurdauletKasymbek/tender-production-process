import { Header } from '../../components/Header';
import { OrderCard } from '../../components/OrderCard';
import { Spinner } from '../../components/Spinner';
import { EmptyState } from '../../components/EmptyState';
import { useOrders } from '../../hooks/useOrders';

export function ProductionHeadHome() {
  const { orders, loading, error } = useOrders({ status: 'PRODUCTION' });

  return (
    <div className="page">
      <Header title="Өндіріс бастығы" />

      <div className="info-banner">
        Тапсырысты ашып, цех мамандарына жеке тапсырмалар таратыңыз.
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <EmptyState icon="🛠️" title="Өндірісте тапсырыс жоқ" />
      ) : (
        <div className="list">
          {orders.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </div>
  );
}
