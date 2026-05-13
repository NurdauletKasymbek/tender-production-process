import { Link } from 'react-router-dom';
import type { Order } from '../types';
import { StatusBadge } from './StatusBadge';
import { StageStepper } from './StageStepper';
import {
  deadlineLabel, formatMoney, FULFILLMENT_ICON, FULFILLMENT_LABEL, PRIORITY_LABEL,
} from '../utils/labels';

/**
 * Кезеңде қанша күн тұрғанын есептеу + түс.
 *   Жабылған/қабылданбаған тапсырыста — null (көрсетпейміз).
 */
function stageAge(order: Order): { days: number; level: 'fresh' | 'warn' | 'danger' } | null {
  if (order.status === 'CLOSED' || order.status === 'REJECTED') return null;
  const base = order.stageChangedAt || order.updatedAt;
  if (!base) return null;
  const ms = Date.now() - new Date(base).getTime();
  const days = Math.floor(ms / 86_400_000);
  let level: 'fresh' | 'warn' | 'danger';
  if (days <= 1) level = 'fresh';
  else if (days <= 3) level = 'warn';
  else level = 'danger';
  return { days, level };
}

export function OrderCard({ order }: { order: Order }) {
  const dl = deadlineLabel(order.deadline);
  const sla = stageAge(order);
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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {sla && (
            <span className={`sla-tag sla-tag--${sla.level}`} title="Кезеңде қанша уақыт">
              ⏱ {sla.days === 0 ? 'бүгін' : `${sla.days} күн`}
            </span>
          )}
          <span className={`card__deadline ${dl.isOverdue ? 'is-overdue' : dl.isSoon ? 'is-soon' : ''}`}>
            {dl.text}
          </span>
        </div>
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
