import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ordersApi, stockApi } from '../api/endpoints';
import type { Order, StockItem } from '../types';
import { hapticNotify, showConfirm } from '../utils/telegram';

const FMT = new Intl.NumberFormat('kk-KZ', { maximumFractionDigits: 3 });
const num = (v: string | number | null | undefined) => Number(v ?? 0);

interface Props {
  order: Order;
  canEdit: boolean;
  onUpdated: () => void;
}

/**
 * STOCK fulfillment байланысы — қандай склад бірлігінен қанша шегеру.
 * LOADING → LOGISTICS өткенде автоматты түрде шегеріледі.
 */
export function StockBinding({ order, canEdit, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(order.stockItemId ?? null);
  const [quantity, setQuantity] = useState<string>(
    order.stockQuantity != null ? String(order.stockQuantity) : String(order.quantity ?? ''),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing || items != null) return;
    stockApi.list().then(setItems).catch((e) => setError(e?.message || 'Қате'));
  }, [editing, items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    if (!q) return items.slice(0, 30);
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.sku || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q),
    ).slice(0, 30);
  }, [items, search]);

  const selected = items?.find((i) => i.id === selectedId);

  const save = async () => {
    if (!selectedId) { setError('Бірлік таңдаңыз'); return; }
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0) { setError('Мөлшер > 0 болуы керек'); return; }
    if (selected && q > num(selected.quantity)) {
      setError(`Қалдық жеткіліксіз: бар ${selected.quantity}`);
      return;
    }
    setBusy(true); setError(null);
    try {
      await ordersApi.linkStock(order.id, { stockItemId: selectedId, stockQuantity: q });
      hapticNotify('success');
      setEditing(false);
      onUpdated();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Қате');
      hapticNotify('error');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    const ok = await showConfirm('Склад байланысын алып тастаймыз ба?');
    if (!ok) return;
    setBusy(true); setError(null);
    try {
      await ordersApi.linkStock(order.id, { stockItemId: null });
      hapticNotify('success');
      setEditing(false);
      setSelectedId(null);
      setQuantity('');
      onUpdated();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Қате');
      hapticNotify('error');
    } finally {
      setBusy(false);
    }
  };

  // Шегерілген — өзгерту мүмкін емес
  if (order.stockDeductedAt && order.stockItem) {
    return (
      <div className="card" style={{ borderColor: 'var(--success)', borderWidth: 1, borderStyle: 'solid' }}>
        <div className="card__title">📦 Складтан шегерілді</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
          Тапсырыс жолға шыққан кезде автоматты түрде шегерілді.
        </div>
        <div style={{ fontSize: 14 }}>
          <Link to={`/inventory/${order.stockItem.id}`}>
            <strong>{order.stockItem.name}</strong>
          </Link>
          {' — '}
          <strong>{FMT.format(num(order.stockQuantity))} {order.stockItem.unit}</strong>
        </div>
      </div>
    );
  }

  // Бекітілген, бірақ шегеру әлі болмаған
  if (order.stockItem && !editing) {
    const enough = num(order.stockItem.quantity) >= num(order.stockQuantity);
    return (
      <div className="card">
        <div className="card__row">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="card__title">📦 Склад байланысы</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              <Link to={`/inventory/${order.stockItem.id}`}>
                <strong>{order.stockItem.name}</strong>
              </Link>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Шегеру: <strong>{FMT.format(num(order.stockQuantity))} {order.stockItem.unit}</strong>
              {' · '}қазіргі қалдық: {FMT.format(num(order.stockItem.quantity))}
            </div>
            {!enough && (
              <div className="alert alert--error" style={{ marginTop: 8, fontSize: 12 }}>
                <span>⚠️</span><span>Қалдық жеткіліксіз — толықтыру керек</span>
              </div>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-sm" style={{ marginTop: 8 }}>
            <button className="btn btn--ghost" onClick={() => setEditing(true)}>
              ✏️ Өзгерту
            </button>
            <button className="btn btn--ghost" onClick={() => void clear()} style={{ color: 'var(--danger)' }}>
              Алып тастау
            </button>
          </div>
        )}
      </div>
    );
  }

  // Байланыс жоқ, өңдеу режимі емес
  if (!editing) {
    if (!canEdit) return null;
    return (
      <div className="card" style={{ borderStyle: 'dashed', borderWidth: 1, borderColor: 'var(--divider)' }}>
        <div className="card__title">📦 Склад байланысы жоқ</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
          Жөнелту кезінде автоматты шегеру үшін склад бірлігін байлаңыз.
        </div>
        <button className="btn btn--soft btn--block" onClick={() => setEditing(true)}>
          + Бірлік таңдау
        </button>
      </div>
    );
  }

  // Өңдеу режимі
  return (
    <div className="card" style={{ borderColor: 'var(--brand-500)', borderWidth: 1, borderStyle: 'solid' }}>
      <div className="card__title">📦 Склад бірлігін байлау</div>

      {!selectedId ? (
        <>
          <input
            className="input"
            type="search"
            placeholder="Іздеу: атау, SKU, санат..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div style={{ maxHeight: 280, overflowY: 'auto', marginTop: 8 }}>
            {items == null ? (
              <div className="muted" style={{ padding: 12 }}>Жүктелуде...</div>
            ) : filtered.length === 0 ? (
              <div className="muted" style={{ padding: 12, textAlign: 'center' }}>
                Сәйкестік жоқ
              </div>
            ) : (
              filtered.map((it) => (
                <button
                  key={it.id}
                  className="card card--clickable"
                  style={{ marginBottom: 6 }}
                  onClick={() => setSelectedId(it.id)}
                >
                  <div className="card__row">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{it.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {it.sku && <>SKU: {it.sku} · </>}
                        {it.category}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>{FMT.format(num(it.quantity))}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{it.unit}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 10 }}>
            <div className="muted" style={{ fontSize: 12 }}>Таңдалды</div>
            <div style={{ fontWeight: 600 }}>{selected?.name}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              қалдық: {selected ? FMT.format(num(selected.quantity)) : '—'} {selected?.unit}
            </div>
          </div>
          <label className="field">
            <span className="field__label">Шегеру мөлшері ({selected?.unit})</span>
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
          <button
            className="btn btn--ghost"
            style={{ fontSize: 12, alignSelf: 'flex-start' }}
            onClick={() => setSelectedId(null)}
          >
            ← Басқа бірлік таңдау
          </button>
        </>
      )}

      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}

      <div className="flex gap-sm" style={{ marginTop: 8 }}>
        <button
          className="btn btn--primary"
          onClick={() => void save()}
          disabled={busy || !selectedId}
          style={{ flex: 1 }}
        >
          {busy ? '...' : 'Сақтау'}
        </button>
        <button className="btn btn--ghost" onClick={() => setEditing(false)} disabled={busy}>
          Бас тарту
        </button>
      </div>
    </div>
  );
}
