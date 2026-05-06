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

      <div className="hero-stat">
        <div className="hero-stat__label">Өндірісте</div>
        <div className="hero-stat__value">{orders.length}</div>
        <div className="hero-stat__hint">
          Тапсырысты ашып, цех мамандарына жеке тапсырмалар таратыңыз
        </div>
      </div>

      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}
      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <EmptyState
          icon="🛠️"
          title="Өндірісте тапсырыс жоқ"
          description="Басшы растағаннан кейін тапсырыстар осы жерде көрінеді."
        />
      ) : (
        <>
          <h3 className="section-title">Белсенді тапсырыстар</h3>
          <div className="list">
            {orders.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        </>
      )}
    </div>
  );
}
