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

export function StageQueueHome({ stage, title }: Props) {
  const { orders, loading, error } = useOrders({ status: stage });

  return (
    <div className="page">
      <Header title={title} />
      {HINT[stage] && <div className="info-banner">{HINT[stage]}</div>}

      {error && <div className="alert alert--error">{error}</div>}
      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <EmptyState icon="📦" title={EMPTY[stage] || 'Тапсырыс жоқ'} />
      ) : (
        <div className="list">
          {orders.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </div>
  );
}
