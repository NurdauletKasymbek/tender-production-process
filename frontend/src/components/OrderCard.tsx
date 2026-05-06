import { Link } from 'react-router-dom';
import type { Order } from '../types';
import { StatusBadge } from './StatusBadge';
import { StageStepper } from './StageStepper';
import {
  deadlineLabel, formatMoney, FULFILLMENT_ICON, FULFILLMENT_LABEL, PRIORITY_LABEL,
} from '../utils/labels';

export function OrderCard({ order }: { order: Order }) {
  const dl = deadlineLabel(order.deadline);
  return (
    <Link to={`/orders/${order.id}`} className="card card--link">
      <div className="card__row">
        <span className="card__title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-label={FULFILLMENT_LABEL[order.fulfillmentType]}
            title={FULFILLMENT_LABEL[order.fulfillmentType]}
          >
            {FULFILLMENT_ICON[order.fulfillmentType]}
          </span>
          №{order.tenderNumber}
        </span>
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
      <StageStepper current={order.status} compact />
      {order.priority > 0 && (
        <div className={`priority-tag priority-tag--${order.priority}`}>
          {PRIORITY_LABEL[order.priority]}
        </div>
      )}
    </Link>
  );
}
