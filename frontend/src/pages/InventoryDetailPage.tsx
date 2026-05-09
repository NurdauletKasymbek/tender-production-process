import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { Spinner } from '../components/Spinner';
import { stockApi } from '../api/endpoints';
import type { StockItemDetail, StockMovement, StockMovementType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { hapticNotify, showConfirm } from '../utils/telegram';

const FMT = new Intl.NumberFormat('kk-KZ', { maximumFractionDigits: 3 });
const num = (v: string | number | null | undefined) => Number(v ?? 0);

const TYPE_LABEL: Record<StockMovementType, string> = {
  IN: 'Қабылдау',
  OUT: 'Шығыс',
  ADJUST: 'Түзету',
};
const TYPE_ICON: Record<StockMovementType, string> = { IN: '↑', OUT: '↓', ADJUST: '⚙️' };
const TYPE_COLOR: Record<StockMovementType, string> = {
  IN: 'var(--success)',
  OUT: 'var(--danger)',
  ADJUST: 'var(--text-muted)',
};

function fmtDate(s: string) {
  return new Date(s).toLocaleString('kk-KZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { effectiveRole } = useAuth();
  const canEdit = effectiveRole === 'ADMIN' || effectiveRole === 'LOADING';
  const canDelete = effectiveRole === 'ADMIN';

  const [item, setItem] = useState<StockItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<StockMovementType | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const it = await stockApi.get(id);
      setItem(it);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Қате');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async () => {
    if (!item) return;
    const ok = await showConfirm(
      `«${item.name}» бірлігі архивке өтеді (қайта тірілтуге болады). Жалғастырамыз ба?`,
    );
    if (!ok) return;
    try {
      await stockApi.remove(item.id);
      hapticNotify('success');
      nav('/inventory', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Қате');
      hapticNotify('error');
    }
  };

  if (loading) return <Spinner />;
  if (!item) return (
    <div className="page">
      <Header title="Склад бірлігі" showBell={false} />
      <div className="alert alert--error"><span>⚠️</span><span>{error || 'Табылмады'}</span></div>
    </div>
  );

  const low = item.minQuantity != null && num(item.quantity) <= num(item.minQuantity);

  return (
    <div className="page">
      <Header title={item.name} showBell={false} />

      <div className="card" style={{ textAlign: 'center', padding: 20 }}>
        <div style={{
          fontSize: 48,
          fontWeight: 800,
          color: low ? 'var(--danger)' : 'var(--text)',
          lineHeight: 1.1,
        }}>
          {FMT.format(num(item.quantity))}
        </div>
        <div className="muted" style={{ marginTop: 4 }}>
          {item.unit}
          {item.minQuantity != null && (
            <> · мин: {FMT.format(num(item.minQuantity))}</>
          )}
        </div>
        {low && (
          <div className="alert alert--error" style={{ marginTop: 12, fontSize: 13 }}>
            <span>⚠️</span><span>Қалдық төмен — толықтыру керек</span>
          </div>
        )}
      </div>

      <div className="card">
        <div className="kv-row">
          {item.sku && <div><span className="muted">SKU</span><div>{item.sku}</div></div>}
          {item.category && <div><span className="muted">Санат</span><div>{item.category}</div></div>}
          {item.location && <div><span className="muted">Орны</span><div>📍 {item.location}</div></div>}
          {item.notes && <div style={{ gridColumn: '1 / -1' }}><span className="muted">Ескертпе</span><div>{item.notes}</div></div>}
        </div>
      </div>

      {canEdit && (
        <div className="flex gap-sm" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
          <button className="btn btn--soft" onClick={() => setShowForm('IN')}>
            <span aria-hidden style={{ color: 'var(--success)' }}>↑</span>
            <span>Қабылдау</span>
          </button>
          <button className="btn btn--soft" onClick={() => setShowForm('OUT')}>
            <span aria-hidden style={{ color: 'var(--danger)' }}>↓</span>
            <span>Шығыс</span>
          </button>
          <button className="btn btn--soft" onClick={() => setShowForm('ADJUST')}>
            <span aria-hidden>⚙️</span>
            <span>Түзету</span>
          </button>
        </div>
      )}

      {showForm && (
        <MovementForm
          itemId={item.id}
          currentQuantity={num(item.quantity)}
          unit={item.unit}
          type={showForm}
          onCancel={() => setShowForm(null)}
          onDone={() => { setShowForm(null); void load(); }}
        />
      )}

      <h3 className="section-title">Қозғалыс тарихы</h3>
      {item.movements.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 16 }}>
          Қозғалыс жоқ
        </div>
      ) : (
        <div className="list">
          {item.movements.map((m) => <MovementRow key={m.id} m={m} unit={item.unit} />)}
        </div>
      )}

      {canEdit && (
        <Link to={`/inventory/${item.id}/edit`} className="btn btn--ghost btn--block">
          ✏️ Мәліметті өңдеу
        </Link>
      )}
      {canDelete && (
        <button className="btn btn--ghost btn--block" onClick={handleDelete} style={{ color: 'var(--danger)' }}>
          🗑️ Архивке жіберу
        </button>
      )}
    </div>
  );
}

function MovementRow({ m, unit }: { m: StockMovement; unit: string }) {
  const sign = m.type === 'IN' ? '+' : m.type === 'OUT' ? '−' : '';
  return (
    <div className="card">
      <div className="card__row">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, color: TYPE_COLOR[m.type] }}>
            {TYPE_ICON[m.type]} {TYPE_LABEL[m.type]}
            {m.type !== 'ADJUST' && (
              <span style={{ marginLeft: 8 }}>
                {sign}{FMT.format(num(m.quantity))} {unit}
              </span>
            )}
            {m.type === 'ADJUST' && (
              <span style={{ marginLeft: 8 }}>
                = {FMT.format(num(m.quantity))} {unit}
              </span>
            )}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {fmtDate(m.createdAt)}
            {m.createdBy && <> · {m.createdBy.fullName}</>}
          </div>
          {m.order && (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              📋 <Link to={`/orders/${m.order.id}`}>№{m.order.tenderNumber}</Link>
            </div>
          )}
          {m.comment && (
            <div className="muted" style={{ fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
              {m.comment}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', fontSize: 12 }}>
          <div className="muted">қалдық</div>
          <div style={{ fontWeight: 600 }}>{FMT.format(num(m.balanceAfter))}</div>
        </div>
      </div>
    </div>
  );
}

function MovementForm({
  itemId, currentQuantity, unit, type, onCancel, onDone,
}: {
  itemId: string;
  currentQuantity: number;
  unit: string;
  type: StockMovementType;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [quantity, setQuantity] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const q = Number(quantity);
    if (!Number.isFinite(q) || q < 0) { setError('Дұрыс сан енгізіңіз'); return; }
    if (type === 'OUT' && q > currentQuantity) {
      setError(`Қалдық жеткіліксіз: бар ${currentQuantity}`);
      return;
    }
    setBusy(true); setError(null);
    try {
      await stockApi.createMovement(itemId, { type, quantity: q, comment: comment.trim() || undefined });
      hapticNotify('success');
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Қате');
      hapticNotify('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ borderColor: 'var(--brand-500)', borderStyle: 'solid', borderWidth: 1 }}>
      <div className="card__title">{TYPE_ICON[type]} {TYPE_LABEL[type]}</div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        {type === 'IN' && 'Қазіргі қалдыққа қосылады'}
        {type === 'OUT' && `Бар: ${FMT.format(currentQuantity)} ${unit}`}
        {type === 'ADJUST' && 'Жаңа қалдықты енгізіңіз (абсолюттік мән)'}
      </div>
      <label className="field">
        <span className="field__label">
          {type === 'ADJUST' ? 'Жаңа қалдық' : 'Мөлшер'} ({unit})
        </span>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.001"
          autoFocus
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">Ескертпе</span>
        <input
          className="input"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={type === 'IN' ? 'мысалы: ABC жеткізушіден' : type === 'OUT' ? 'мысалы: брак, жоғалды' : 'мысалы: инвентаризация'}
        />
      </label>
      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}
      <div className="flex gap-sm">
        <button className="btn btn--primary" onClick={() => void submit()} disabled={busy}>
          {busy ? '...' : 'Жазу'}
        </button>
        <button className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          Бас тарту
        </button>
      </div>
    </div>
  );
}
