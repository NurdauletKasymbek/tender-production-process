import { useCallback, useEffect, useState } from 'react';
import { ordersApi } from '../api/endpoints';
import type { Order, OrderStatus } from '../types';

export function useOrders(params: { status?: OrderStatus; mine?: boolean } = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ordersApi.list(params);
      setOrders(data);
    } catch (e: any) {
      setError(e.message || 'Тапсырыстарды жүктеу мүмкін болмады');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.status, params.mine]);

  useEffect(() => { void reload(); }, [reload]);

  return { orders, loading, error, reload };
}
