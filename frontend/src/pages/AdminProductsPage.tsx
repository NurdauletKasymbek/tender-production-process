import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { productsApi, productImageUrl } from '../api/endpoints';
import { formatPrice } from '../components/CatalogTopbar';
import type { Product } from '../types';
import { useAuth } from '../hooks/useAuth';

export function AdminProductsPage() {
  const nav = useNavigate();
  const { effectiveRole } = useAuth();
  const allowed = effectiveRole === 'ADMIN' || effectiveRole === 'DIRECTOR';

  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await productsApi.list({ search: search || undefined }));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Қате');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { void load(); }, 200);
    return () => clearTimeout(t);
  }, [load]);

  if (!allowed) {
    return (
      <div className="page">
        <Header title="Каталог" />
        <EmptyState icon="🔒" title="Рұқсат жоқ" description="Каталогты тек басшылық басқарады." />
      </div>
    );
  }

  return (
    <div className="page">
      <Header title="Каталог басқару" />

      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}

      <div className="flex gap-sm" style={{ flexDirection: 'column' }}>
        <Link to="/admin/products/new" className="btn btn--primary btn--lg btn--block">
          <span aria-hidden>+</span><span>Жаңа тауар</span>
        </Link>
        <div className="flex gap-sm" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <Link to="/catalog" className="btn btn--soft">👁️ Публичный көрініс</Link>
          <Link to="/admin/inquiries" className="btn btn--soft">📨 Сұраныстар</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginTop: 12 }}>
        <input
          type="search"
          className="input"
          placeholder="Іздеу: атау, артикул, санат..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon="📦"
          title={search ? 'Сәйкестік жоқ' : 'Тауар жоқ'}
          description={search ? undefined : 'Алғашқы тауарды қосыңыз.'}
        />
      ) : (
        <div className="list" style={{ marginTop: 8 }}>
          {items.map((p) => {
            const cover = p.images?.[0];
            const price = formatPrice(p.price, p.currency);
            return (
              <button
                key={p.id}
                className="card card--clickable"
                onClick={() => nav(`/admin/products/${p.id}`)}
              >
                <div className="card__row" style={{ gap: 12, alignItems: 'center' }}>
                  {cover ? (
                    <img
                      src={productImageUrl(cover.id)}
                      alt=""
                      style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                      background: 'var(--tg-secondary)', display: 'grid', placeItems: 'center', fontSize: 22,
                    }} aria-hidden>🖼️</div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      {!p.isPublished && (
                        <span className="badge" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 11 }}>
                          черновик
                        </span>
                      )}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {p.category && <>{p.category} · </>}
                      {price || 'Сұрау бойынша'}
                      {p._count != null && <> · 📷 {p._count.images} · 📨 {p._count.inquiries}</>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
