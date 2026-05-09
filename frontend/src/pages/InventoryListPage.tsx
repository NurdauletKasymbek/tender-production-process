import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { stockApi } from '../api/endpoints';
import type { StockItem, StockStats } from '../types';
import { useAuth } from '../hooks/useAuth';

const FMT = new Intl.NumberFormat('kk-KZ', { maximumFractionDigits: 3 });
const num = (v: string | number | null | undefined) => Number(v ?? 0);

function isLow(item: StockItem): boolean {
  if (item.minQuantity == null) return false;
  return num(item.quantity) <= num(item.minQuantity);
}

export function InventoryListPage() {
  const nav = useNavigate();
  const { effectiveRole } = useAuth();
  const canEdit = effectiveRole === 'ADMIN' || effectiveRole === 'LOADING';

  const [items, setItems] = useState<StockItem[]>([]);
  const [stats, setStats] = useState<StockStats | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([
        stockApi.list({ search: search || undefined, lowOnly: filter === 'low' }),
        stockApi.stats(),
      ]);
      setItems(list);
      setStats(s);
    } catch (e: any) {
      setError(e?.message || 'Деректерді жүктеу қатесі');
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { void load(); }, 200);
    return () => clearTimeout(t);
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, StockItem[]>();
    for (const it of items) {
      const k = it.category || 'Санатсыз';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  return (
    <div className="page">
      <Header title="Склад" />

      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}

      {stats && (
        <div className="stat-grid stat-grid--3">
          <div className="stat-card">
            <div className="stat-card__icon" aria-hidden>📦</div>
            <div className="stat-card__value">{stats.active}</div>
            <div className="stat-card__label">Бірлік</div>
          </div>
          <div className={`stat-card ${stats.lowStockCount > 0 ? 'stat-card--danger' : ''}`}>
            <div className="stat-card__icon" aria-hidden>⚠️</div>
            <div className="stat-card__value">{stats.lowStockCount}</div>
            <div className="stat-card__label">Төмен қалдық</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__icon" aria-hidden>🗂️</div>
            <div className="stat-card__value">{grouped.length}</div>
            <div className="stat-card__label">Санат</div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 12 }}>
        <input
          type="search"
          className="input"
          placeholder="Іздеу: атау, SKU, санат..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-sm" style={{ marginTop: 8 }}>
          <button
            className={`chip ${filter === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Барлығы
          </button>
          <button
            className={`chip ${filter === 'low' ? 'is-active' : ''}`}
            onClick={() => setFilter('low')}
          >
            ⚠️ Төмен қалдық
          </button>
        </div>
      </div>

      {canEdit && (
        <Link to="/inventory/new" className="btn btn--primary btn--lg btn--block">
          <span aria-hidden>+</span>
          <span>Жаңа бірлік</span>
        </Link>
      )}

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon="📦"
          title={search || filter === 'low' ? 'Сәйкестік жоқ' : 'Склад бос'}
          description={canEdit ? 'Жаңа бірлік қосыңыз немесе CSV-тен импорттаңыз.' : undefined}
        />
      ) : (
        <div className="list">
          {grouped.map(([cat, list]) => (
            <div key={cat}>
              <h3 className="section-title" style={{ marginTop: 12 }}>{cat}</h3>
              {list.map((it) => {
                const low = isLow(it);
                return (
                  <button
                    key={it.id}
                    className="card card--clickable"
                    onClick={() => nav(`/inventory/${it.id}`)}
                  >
                    <div className="card__row">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {low && <span aria-hidden>⚠️</span>}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</span>
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                          {it.sku && <>SKU: {it.sku} · </>}
                          {it.location && <>📍 {it.location}</>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: low ? 'var(--danger)' : 'var(--text)',
                        }}>
                          {FMT.format(num(it.quantity))}
                        </div>
                        <div className="muted" style={{ fontSize: 11 }}>
                          {it.unit}
                          {it.minQuantity != null && <> / мин {FMT.format(num(it.minQuantity))}</>}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
