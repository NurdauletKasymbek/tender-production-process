import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Публичный каталог беттерінің үстіңгі панелі (логинсіз).
 * Кірген қолданушыға — "Басқару" сілтемесі, әйтпесе — "Кіру".
 */
export function CatalogTopbar() {
  const { user } = useAuth();
  return (
    <header className="catalog-topbar">
      <Link to="/catalog" className="catalog-topbar__brand" style={{ textDecoration: 'none', color: '#fff' }}>
        <div className="catalog-topbar__logo" aria-hidden>🏭</div>
        <div style={{ minWidth: 0 }}>
          <div className="catalog-topbar__title">GOSCONTROL каталог</div>
          <div className="catalog-topbar__subtitle">Өнімдер мен бұйымдар</div>
        </div>
      </Link>
      {user ? (
        <Link to="/admin/products" className="catalog-topbar__link">Басқару</Link>
      ) : (
        <Link to="/login" className="catalog-topbar__link">Кіру</Link>
      )}
    </header>
  );
}

const PRICE_FMT = new Intl.NumberFormat('kk-KZ', { maximumFractionDigits: 0 });

/** Бағаны форматтау: белгіленбесе null қайтарады. */
export function formatPrice(
  price: string | number | null | undefined,
  currency = 'KZT',
): string | null {
  if (price == null || price === '') return null;
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  const symbol = currency === 'KZT' ? '₸' : currency;
  return `${PRICE_FMT.format(n)} ${symbol}`;
}
