import { Link } from 'react-router-dom';
import type { Order } from '../types';
import { StatusBadge } from './StatusBadge';
import { deadlineLabel, formatMoney, PRIORITY_LABEL } from '../utils/labels';

export function OrderCard({ order }: { order: Order }) {
  const dl = deadlineLabel(order.deadline);
  return (
    <Link to={`/orders/${order.id}`} className="card card--link">
      <div className="card__row">
        <span className="card__title">№{order.tenderNumber}</span>
        <StatusBadge value={order.status} size="sm" />
      </div>
      <div className="card__product">{order.productName}</div>
      <div className="card__meta">
        <span className="muted">{order.customerName}</span>
      </div>
      <div className="card__row card__footer">
        <span className="card__amount">{formatMoney(order.totalAmount, order.currency)}</span>
        <span className={`card__deadline ${dl.isOverdue ? 'is-overdue' : dl.isSoon ? 'is-soon' : ''}`}>
          {dl.text}
        </span>
      </div>
      {order.priority > 0 && (
        <div className={`priority-tag priority-tag--${order.priority}`}>
          {PRIORITY_LABEL[order.priority]}
        </div>
      )}
    </Link>
  );
}
