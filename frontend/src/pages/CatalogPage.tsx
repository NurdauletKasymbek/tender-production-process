import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalogApi, productImageUrl } from '../api/endpoints';
import { CatalogTopbar, formatPrice } from '../components/CatalogTopbar';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import type { CategoryCount, Product } from '../types';

export function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await catalogApi.list({
        search: search || undefined,
        category: category || undefined,
      });
      setProducts(list);
    } catch (e: any) {
      setError(e?.message || 'Деректерді жүктеу қатесі');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  // Санаттар бір рет жүктеледі
  useEffect(() => {
    catalogApi.categories().then(setCategories).catch(() => { /* елемейміз */ });
  }, []);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { void load(); }, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="app-shell app-shell--no-nav">
      <CatalogTopbar />
      <div className="catalog-wrap">
        {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}

        <input
          type="search"
          className="input"
          placeholder="Іздеу: атау, сипаттама..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {categories.length > 0 && (
          <div className="flex gap-sm" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <button
              className={`chip ${category === null ? 'is-active' : ''}`}
              onClick={() => setCategory(null)}
            >
              Барлығы
            </button>
            {categories.map((c) => (
              <button
                key={c.category}
                className={`chip ${category === c.category ? 'is-active' : ''}`}
                onClick={() => setCategory(c.category)}
              >
                {c.category} <span style={{ opacity: 0.6 }}>· {c.count}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <Spinner />
          ) : products.length === 0 ? (
            <EmptyState
              icon="📦"
              title={search || category ? 'Сәйкестік табылмады' : 'Каталог бос'}
              description="Кейінірек қайта қараңыз."
            />
          ) : (
            <div className="product-grid">
              {products.map((p) => {
                const cover = p.images?.[0];
                const price = formatPrice(p.price, p.currency);
                return (
                  <Link key={p.id} to={`/catalog/${p.slug}`} className="product-card" style={{ position: 'relative' }}>
                    {cover ? (
                      <img className="product-thumb" src={productImageUrl(cover.id)} alt={p.name} loading="lazy" />
                    ) : (
                      <div className="product-thumb product-thumb--placeholder" aria-hidden>🖼️</div>
                    )}
                    <div className="product-card__body">
                      <div className="product-card__name">{p.name}</div>
                      {price ? (
                        <div className="product-card__price">{price}</div>
                      ) : (
                        <div className="product-card__price--ask">Сұрау бойынша</div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 28, paddingBottom: 24 }}>
          © {new Date().getFullYear()} GOSCONTROL
        </div>
      </div>
    </div>
  );
}
