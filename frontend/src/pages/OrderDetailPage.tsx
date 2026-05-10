import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { Spinner } from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { StageStepper } from '../components/StageStepper';
import { TaskCard } from '../components/TaskCard';
import { FileGallery } from '../components/FileGallery';
import { TransportInfoForm } from '../components/TransportInfoForm';
import { StockBinding } from '../components/StockBinding';
import { ordersApi, productionApi } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import type { FileType, FulfillmentType, Order, OrderStatus, UserRole } from '../types';
import {
  formatDate, formatDateTime, formatMoney, FULFILLMENT_ICON, FULFILLMENT_LABEL,
  NEXT_STATUS_BY_CURRENT, nextStepLabel, ROLE_ICON, ROLE_LABEL, STATUS_LABEL,
} from '../utils/labels';

/** Әр кезеңді ауыстыруға жауапты НЕГІЗГІ рөл (ADMIN-нен бөлек) */
const STAGE_PRIMARY_ROLE: Partial<Record<OrderStatus, UserRole>> = {
  NEW_TENDER: 'TENDER_DEPARTMENT',
  REVIEW: 'TENDER_DEPARTMENT',
  CONFIRMATION: 'DIRECTOR',
  PRODUCTION: 'PRODUCTION_HEAD',
  PACKAGING: 'PACKAGING',
  STORAGE: 'LOADING', // STORAGE-ті LOADING рөлі басқарады
  LOADING: 'LOADING',
  LOGISTICS: 'LOGISTICS',
  DELIVERY: 'LOGISTICS',
};
import { hapticImpact, hapticNotify, setBackButton, showConfirm } from '../utils/telegram';

const ROLE_CAN_ADVANCE: Record<OrderStatus, string[]> = {
  NEW_TENDER: ['TENDER_DEPARTMENT', 'ADMIN'],
  REVIEW: ['TENDER_DEPARTMENT', 'ADMIN'],
  CONFIRMATION: ['DIRECTOR', 'ADMIN'],
  PRODUCTION: ['PRODUCTION_HEAD', 'ADMIN'],
  PACKAGING: ['PACKAGING', 'ADMIN'],
  STORAGE: ['LOADING', 'ADMIN'],
  LOADING: ['LOADING', 'LOGISTICS', 'ADMIN'],
  LOGISTICS: ['LOGISTICS', 'ADMIN'],
  DELIVERY: ['LOGISTICS', 'DIRECTOR', 'ADMIN'],
  CLOSED: [],
  REJECTED: [],
};

const FILE_TYPE_BY_STAGE: Partial<Record<OrderStatus, FileType>> = {
  NEW_TENDER: 'CONTRACT',
  REVIEW: 'CONTRACT',
  CONFIRMATION: 'TECHNICAL_SPEC',
  PRODUCTION: 'PRODUCTION_PHOTO',
  PACKAGING: 'PACKAGING_PHOTO',
  STORAGE: 'PACKAGING_PHOTO',
  LOADING: 'LOADING_PHOTO',
  LOGISTICS: 'LOADING_PHOTO',
  DELIVERY: 'DELIVERY_PHOTO',
  CLOSED: 'INVOICE',
};

/** Кезеңнен шығу үшін қандай файл түрі МІНДЕТТІ. Backend де осыны тексереді. */
const STAGE_REQUIRED_FILE: Partial<Record<OrderStatus, FileType>> = {
  NEW_TENDER: 'CONTRACT',
  CONFIRMATION: 'TECHNICAL_SPEC',
  PRODUCTION: 'PRODUCTION_PHOTO',
  PACKAGING: 'PACKAGING_PHOTO',
  LOADING: 'LOADING_PHOTO',
  DELIVERY: 'DELIVERY_PHOTO',
};

const FILE_TYPE_LABEL: Record<FileType, string> = {
  CONTRACT: 'Келісімшарт',
  TECHNICAL_SPEC: 'Техникалық тапсырма',
  PRODUCTION_PHOTO: 'Өндіріс фотосы',
  PACKAGING_PHOTO: 'Қаптау фотосы',
  LOADING_PHOTO: 'Тиеу фотосы',
  DELIVERY_PHOTO: 'Жеткізу фотосы',
  INVOICE: 'Шот-фактура',
  OTHER: 'Файл',
};

const ROLE_CAN_REJECT: Record<OrderStatus, string[]> = {
  NEW_TENDER: ['TENDER_DEPARTMENT', 'ADMIN'],
  REVIEW: ['TENDER_DEPARTMENT', 'ADMIN'],
  CONFIRMATION: ['DIRECTOR', 'ADMIN'],
  PRODUCTION: [], PACKAGING: [], STORAGE: [], LOADING: [],
  LOGISTICS: [], DELIVERY: [], CLOSED: [], REJECTED: [],
};

export function OrderDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user, effectiveRole, setRoleOverride } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showTransportForm, setShowTransportForm] = useState(false);

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
  if (!order || !user || !effectiveRole) return null;

  const next = NEXT_STATUS_BY_CURRENT[order.status];
  const canAdvance = next && ROLE_CAN_ADVANCE[order.status]?.includes(effectiveRole);
  const canReject = ROLE_CAN_REJECT[order.status]?.includes(effectiveRole);
  // ProductionTask UI алынып тасталды — Цех басшысы Mini App-сыз бөледі.
  // Mini App тек статус + фото/видео отчет.
  const canAddTasks = false;
  const fileCount = order.files?.length ?? 0;
  const hasTechSpec = !!order.files?.some(
    (f) => f.fileType === 'TECHNICAL_SPEC' || f.fileType === 'CONTRACT',
  );

  // Кезеңнен шығу үшін қандай файл міндетті, ол жүктелген бе
  const requiredFileType = STAGE_REQUIRED_FILE[order.status];
  const hasRequiredFile = !requiredFileType || !!order.files?.some(
    (f) => f.fileType === requiredFileType,
  );
  const advanceBlockedByFile = !!requiredFileType && !hasRequiredFile;

  /** Директор CONFIRMATION-да 2 нұсқаны таңдайды: цех немесе склад */
  const isDirectorConfirmation =
    order.status === 'CONFIRMATION' && (effectiveRole === 'DIRECTOR' || effectiveRole === 'ADMIN');
  const willGoToProduction = order.status === 'CONFIRMATION' && next === 'PRODUCTION';

  const advanceTo = async (target: OrderStatus, extraBody: Record<string, unknown> = {}) => {
    // LOADING → LOGISTICS — көлік ақпараты міндетті, форма ашамыз
    if (order.status === 'LOADING' && target === 'LOGISTICS' && !extraBody.transportProvider) {
      setShowTransportForm(true);
      return;
    }

    if (target === 'PRODUCTION' && !hasTechSpec) {
      const ok = await showConfirm(
        'Тапсырыс цех басшысына барады, бірақ техникалық тапсырма (PDF/фото) тіркелмеген. ' +
          'Цех мамандарына ақпарат жетпеуі мүмкін. Сонда да жалғастырамыз ба?',
      );
      if (!ok) return;
    } else if (!extraBody.transportProvider) {
      const ok = await showConfirm(`Тапсырыс күйі "${STATUS_LABEL[target]}" болады. Жалғастырамыз ба?`);
      if (!ok) return;
    }
    setBusy(true);
    try {
      hapticImpact('medium');
      await ordersApi.changeStatus(order.id, target, extraBody);
      hapticNotify('success');
      setShowTransportForm(false);
      await load();
    } catch (e: any) {
      hapticNotify('error');
      setError(e.message || 'Күй өзгерту қатесі');
    } finally { setBusy(false); }
  };

  const advance = () => next && advanceTo(next);

  const submitTransport = async (transport: {
    transportProvider: string;
    driverName: string;
    driverPhone: string;
    vehicleType: string;
    vehiclePlate: string;
    expectedArrival: string;
  }) => {
    await advanceTo('LOGISTICS', {
      transportProvider: transport.transportProvider,
      driverName: transport.driverName,
      driverPhone: transport.driverPhone,
      vehicleType: transport.vehicleType,
      vehiclePlate: transport.vehiclePlate,
      expectedArrival: transport.expectedArrival
        ? new Date(transport.expectedArrival).toISOString()
        : undefined,
      departedAt: new Date().toISOString(),
    });
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
        <h3 className="section-title" style={{ margin: 0 }}>Pipeline</h3>
        <StageStepper current={order.status} />
      </div>

      <div className="card">
        <Row label="Тапсырыс беруші" value={order.customerName} />
        {order.customerBin && <Row label="БСН" value={order.customerBin} />}
        {order.contractNumber && <Row label="Келісімшарт №" value={order.contractNumber} />}
        <Row label="Саны" value={`${order.quantity} ${order.unit}`} />
        <Row label="Сома" value={formatMoney(order.totalAmount, order.currency)} />
        <Row label="Жеткізу мерзімі" value={formatDate(order.deadline)} />
        <Row
          label="Орындау түрі"
          value={`${FULFILLMENT_ICON[order.fulfillmentType]} ${FULFILLMENT_LABEL[order.fulfillmentType]}`}
        />
        {order.deliveryAddress && <Row label="Мекенжай" value={order.deliveryAddress} />}
        {order.responsible && (
          <Row label="Жауапты" value={`${order.responsible.fullName} (${ROLE_LABEL[order.responsible.role]})`} />
        )}
      </div>

      {/* Склад байланысы — STOCK fulfillment немесе STORAGE/LOADING кезеңіндегі тапсырыстар */}
      {(order.fulfillmentType === 'STOCK' ||
        order.status === 'STORAGE' ||
        order.status === 'LOADING' ||
        order.stockItem) && (
        <>
          <h3 className="section-title">📦 Склад</h3>
          <StockBinding
            order={order}
            canEdit={
              !order.stockDeductedAt &&
              (effectiveRole === 'ADMIN' ||
               effectiveRole === 'LOADING' ||
               effectiveRole === 'DIRECTOR')
            }
            onUpdated={() => void load()}
          />
        </>
      )}

      {/* Көлік ақпараты — толтырылған болса көрсетеміз (Logistics + кейінгі кезеңдерде) */}
      {(order.transportProvider || order.driverName || order.vehiclePlate) && (
        <>
          <h3 className="section-title">🚛 Көлік ақпараты</h3>
          <div className="card">
            {order.transportProvider && <Row label="Тасымалдаушы" value={order.transportProvider} />}
            {order.driverName && <Row label="Жүргізуші" value={order.driverName} />}
            {order.driverPhone && <Row label="Телефон" value={order.driverPhone} />}
            {order.vehicleType && <Row label="Көлік түрі" value={order.vehicleType} />}
            {order.vehiclePlate && <Row label="Мемнөмір" value={order.vehiclePlate} />}
            {order.departedAt && <Row label="Жолға шықты" value={formatDateTime(order.departedAt)} />}
            {order.expectedArrival && <Row label="Болжамды жеткізу" value={formatDateTime(order.expectedArrival)} />}
          </div>
        </>
      )}

      {/* Файлдар секциясы — action батырмалардан бұрын. Тендер бөлімі/Директор
          цех басшысына жібермес бұрын техникалық PDF тіркей алады. */}
      <div className="section-title-row">
        <h3 className="section-title" style={{ margin: 0 }}>
          Файлдар {fileCount > 0 && <span className="section-count">{fileCount}</span>}
        </h3>
      </div>
      {willGoToProduction && !hasTechSpec && (
        <div className="alert alert--info" style={{ alignItems: 'center' }}>
          <span aria-hidden>📎</span>
          <span>
            <strong>Цех басшысына жіберуден бұрын</strong> техникалық тапсырма (PDF) тіркеңіз —
            "Стул ученический" сияқты қысқа сипаттама жеткіліксіз болуы мүмкін.
          </span>
        </div>
      )}
      {advanceBlockedByFile && requiredFileType && (canAdvance || canReject) && (
        <div className="alert alert--error" style={{ alignItems: 'center' }}>
          <span aria-hidden>📎</span>
          <span>
            Келесі кезеңге өту үшін <strong>«{FILE_TYPE_LABEL[requiredFileType]}»</strong> жүктеу
            міндетті. Төменнен файл таңдап жүктеңіз.
          </span>
        </div>
      )}
      <FileGallery
        orderId={order.id}
        suggestedType={FILE_TYPE_BY_STAGE[order.status] || 'OTHER'}
        canUpload={effectiveRole !== 'WORKSHOP_WORKER' || order.status === 'PRODUCTION'}
        onChange={() => void load()}
      />

      {/* ADMIN басқа рөл болып отыр да, ағымдағы кезеңді сол рөл ауыстыра алмайды —
          бір батырмамен дұрыс рөлге ауыстыруды ұсынамыз. */}
      {!canAdvance && !canReject && user.role === 'ADMIN' && order.status !== 'CLOSED' && order.status !== 'REJECTED' && (() => {
        const required = STAGE_PRIMARY_ROLE[order.status];
        if (!required || required === effectiveRole) return null;
        return (
          <div className="card" style={{ borderColor: 'var(--brand-300)' }}>
            <div className="muted" style={{ fontSize: 13 }}>
              <strong>"{STATUS_LABEL[order.status]}"</strong> кезеңін ауыстыру үшін
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <span aria-hidden style={{ fontSize: 20 }}>{ROLE_ICON[required]}</span>
              <span>{ROLE_LABEL[required]}</span>
              <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>рөлі керек</span>
            </div>
            <button
              className="btn btn--soft btn--block"
              onClick={() => setRoleOverride(required)}
            >
              <span aria-hidden>🧪</span>
              <span>{ROLE_LABEL[required]} ретінде басқару</span>
            </button>
          </div>
        );
      })()}

      {/* LOADING → LOGISTICS — Логист көлік ақпаратын толтырады */}
      {showTransportForm && (
        <TransportInfoForm
          initial={{
            transportProvider: order.transportProvider || '',
            driverName: order.driverName || '',
            driverPhone: order.driverPhone || '',
            vehicleType: order.vehicleType || '',
            vehiclePlate: order.vehiclePlate || '',
          }}
          onSubmit={submitTransport}
          onCancel={() => setShowTransportForm(false)}
          busy={busy}
        />
      )}

      {(canAdvance || canReject) && !showTransportForm && (
        <div className="actions">
          {/* CONFIRMATION: Директор 2 нұсқа таңдайды */}
          {isDirectorConfirmation ? (
            <>
              <button
                className="btn btn--primary btn--lg"
                onClick={() => void advanceTo('PRODUCTION')}
                disabled={busy || advanceBlockedByFile}
              >
                <span aria-hidden>🏭</span>
                <span>Өндіріске жіберу (цех)</span>
              </button>
              <button
                className="btn btn--success btn--lg"
                onClick={() => void advanceTo('STORAGE')}
                disabled={busy || advanceBlockedByFile}
              >
                <span aria-hidden>📦</span>
                <span>Складтан алу (қойма → тиеу)</span>
              </button>
              <div className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                Дайын өнім бар болса — "Складтан алу" (цех + қаптау аттап өтіледі).
                Жоқ болса — "Өндіріске жіберу".
              </div>
            </>
          ) : (
            canAdvance && next && (
              <button
                className="btn btn--primary btn--lg"
                onClick={advance}
                disabled={busy || advanceBlockedByFile}
              >
                {nextStepLabel(order.status) || `→ ${STATUS_LABEL[next]}`}
              </button>
            )
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
