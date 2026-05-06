import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { Spinner } from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { TaskCard } from '../components/TaskCard';
import { ordersApi, productionApi } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import type { Order, OrderStatus } from '../types';
import {
  formatDate, formatDateTime, formatMoney,
  NEXT_STATUS_BY_CURRENT, nextStepLabel, ROLE_LABEL, STATUS_LABEL,
} from '../utils/labels';
import { hapticImpact, hapticNotify, setBackButton, showConfirm } from '../utils/telegram';

const ROLE_CAN_ADVANCE: Record<OrderStatus, string[]> = {
  NEW_TENDER: ['TENDER_DEPARTMENT', 'ADMIN'],
  REVIEW: ['TENDER_DEPARTMENT', 'ADMIN'],
  CONFIRMATION: ['DIRECTOR', 'ADMIN'],
  PRODUCTION: ['PRODUCTION_HEAD', 'ADMIN'],
  PACKAGING: ['PACKAGING', 'ADMIN'],
  LOADING: ['LOADING', 'ADMIN'],
  LOGISTICS: ['LOGISTICS', 'ADMIN'],
  DELIVERY: ['LOGISTICS', 'DIRECTOR', 'ADMIN'],
  CLOSED: [],
  REJECTED: [],
};

const ROLE_CAN_REJECT: Record<OrderStatus, string[]> = {
  NEW_TENDER: ['TENDER_DEPARTMENT', 'ADMIN'],
  REVIEW: ['TENDER_DEPARTMENT', 'ADMIN'],
  CONFIRMATION: ['DIRECTOR', 'ADMIN'],
  PRODUCTION: [], PACKAGING: [], LOADING: [],
  LOGISTICS: [], DELIVERY: [], CLOSED: [], REJECTED: [],
};

export function OrderDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrder(await ordersApi.get(id));
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Жүктеу қатесі');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => setBackButton(() => nav(-1)), [nav]);

  if (loading) return <Spinner />;
  if (error) return <div className="page"><Header title="Тапсырыс" showBell={false} /><div className="alert alert--error">{error}</div></div>;
  if (!order || !user) return null;

  const next = NEXT_STATUS_BY_CURRENT[order.status];
  const canAdvance = next && ROLE_CAN_ADVANCE[order.status]?.includes(user.role);
  const canReject = ROLE_CAN_REJECT[order.status]?.includes(user.role);
  const canAddTasks = order.status === 'PRODUCTION' && (user.role === 'PRODUCTION_HEAD' || user.role === 'ADMIN');

  const advance = async () => {
    if (!next) return;
    const ok = await showConfirm(`Тапсырыс күйі "${STATUS_LABEL[next]}" болады. Жалғастырамыз ба?`);
    if (!ok) return;
    setBusy(true);
    try {
      hapticImpact('medium');
      await ordersApi.changeStatus(order.id, next);
      hapticNotify('success');
      await load();
    } catch (e: any) {
      hapticNotify('error');
      setError(e.message || 'Күй өзгерту қатесі');
    } finally { setBusy(false); }
  };

  const reject = async () => {
    const ok = await showConfirm('Тапсырысты қабылдамаймыз ба? Бұл әрекетті кері қайтаруға болмайды.');
    if (!ok) return;
    setBusy(true);
    try {
      await ordersApi.changeStatus(order.id, 'REJECTED');
      hapticNotify('warning');
      await load();
    } catch (e: any) {
      setError(e.message || 'Қате');
    } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <Header title={`№${order.tenderNumber}`} showBell={false} />

      <div className="card">
        <div className="detail__header">
          <StatusBadge value={order.status} />
          {order.priority > 0 && (
            <span className={`priority-tag priority-tag--${order.priority}`}>
              {order.priority === 2 ? 'Шұғыл' : 'Жоғары'}
            </span>
          )}
        </div>
        <h2 className="detail__title">{order.productName}</h2>
        {order.productDescription && (
          <p className="muted detail__desc">{order.productDescription}</p>
        )}
      </div>

      <div className="card">
        <Row label="Тапсырыс беруші" value={order.customerName} />
        {order.customerBin && <Row label="БСН" value={order.customerBin} />}
        {order.contractNumber && <Row label="Келісімшарт №" value={order.contractNumber} />}
        <Row label="Саны" value={`${order.quantity} ${order.unit}`} />
        <Row label="Сома" value={formatMoney(order.totalAmount, order.currency)} />
        <Row label="Жеткізу мерзімі" value={formatDate(order.deadline)} />
        {order.deliveryAddress && <Row label="Мекенжай" value={order.deliveryAddress} />}
        {order.responsible && (
          <Row label="Жауапты" value={`${order.responsible.fullName} (${ROLE_LABEL[order.responsible.role]})`} />
        )}
      </div>

      {(canAdvance || canReject) && (
        <div className="actions">
          {canAdvance && next && (
            <button className="btn btn--primary btn--lg" onClick={advance} disabled={busy}>
              {nextStepLabel(order.status) || `→ ${STATUS_LABEL[next]}`}
            </button>
          )}
          {canReject && (
            <button className="btn btn--danger" onClick={reject} disabled={busy}>
              Қабылдамау
            </button>
          )}
        </div>
      )}

      {canAddTasks && (
        <>
          <h3 className="section-title">Цех тапсырмалары</h3>
          {order.productionTasks && order.productionTasks.length > 0 ? (
            <div className="list">
              {order.productionTasks.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          ) : (
            <div className="muted">Әлі тапсырма жоқ</div>
          )}
          {showAddTask ? (
            <NewTaskForm orderId={order.id} onCreated={() => { setShowAddTask(false); void load(); }} onCancel={() => setShowAddTask(false)} />
          ) : (
            <button className="btn btn--ghost" onClick={() => setShowAddTask(true)}>
              + Жаңа тапсырма
            </button>
          )}
        </>
      )}

      {!canAddTasks && order.productionTasks && order.productionTasks.length > 0 && (
        <>
          <h3 className="section-title">Тапсырмалар</h3>
          <div className="list">
            {order.productionTasks.map((t) => <TaskCard key={t.id} task={t} />)}
          </div>
        </>
      )}

      {order.statusHistory && order.statusHistory.length > 0 && (
        <>
          <h3 className="section-title">Тарих</h3>
          <div className="card timeline">
            {order.statusHistory.map((h) => (
              <div key={h.id} className="timeline__item">
                <div className="timeline__head">
                  <StatusBadge value={h.toStatus} size="sm" />
                  <span className="muted">{formatDateTime(h.createdAt)}</span>
                </div>
                <div className="timeline__by">
                  {h.changedBy.fullName} · {ROLE_LABEL[h.changedBy.role]}
                </div>
                {h.comment && <div className="timeline__comment">{h.comment}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="row">
      <span className="muted">{label}</span>
      <span className="row__value">{value}</span>
    </div>
  );
}

function NewTaskForm({ orderId, onCreated, onCancel }: {
  orderId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await productionApi.createTask({
        orderId,
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
      });
      onCreated();
    } catch (e: any) {
      setErr(e.message || 'Қате');
    } finally { setBusy(false); }
  };

  return (
    <form className="card form" onSubmit={submit}>
      {err && <div className="alert alert--error">{err}</div>}
      <label className="field">
        <span className="field__label">Тапсырма атауы<span className="field__star">*</span></span>
        <input className="input" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field">
        <span className="field__label">Сипаттама</span>
        <textarea className="input input--textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="field">
        <span className="field__label">Мерзім</span>
        <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </label>
      <div className="form__buttons">
        <button type="submit" className="btn btn--primary" disabled={busy}>Сақтау</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Болдырмау</button>
      </div>
    </form>
  );
}

