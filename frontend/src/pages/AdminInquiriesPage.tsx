import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { productsApi } from '../api/endpoints';
import type { InquiryStats, InquiryStatus, ProductInquiry } from '../types';
import { useAuth } from '../hooks/useAuth';

const STATUS_LABEL: Record<InquiryStatus, string> = {
  NEW: 'Жаңа',
  CONTACTED: 'Байланысқан',
  CLOSED: 'Жабық',
};
const STATUS_COLOR: Record<InquiryStatus, { bg: string; fg: string }> = {
  NEW: { bg: 'var(--info-bg)', fg: 'var(--info)' },
  CONTACTED: { bg: 'var(--warning-bg)', fg: 'var(--warning)' },
  CLOSED: { bg: 'var(--success-bg)', fg: 'var(--success)' },
};
const NEXT: Record<InquiryStatus, InquiryStatus | null> = {
  NEW: 'CONTACTED',
  CONTACTED: 'CLOSED',
  CLOSED: null,
};

function fmtDate(s: string) {
  return new Date(s).toLocaleString('kk-KZ', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function AdminInquiriesPage() {
  const { effectiveRole } = useAuth();
  const allowed = effectiveRole === 'ADMIN' || effectiveRole === 'DIRECTOR';

  const [items, setItems] = useState<ProductInquiry[]>([]);
  const [stats, setStats] = useState<InquiryStats | null>(null);
  const [filter, setFilter] = useState<InquiryStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([
        productsApi.inquiries(filter === 'ALL' ? undefined : filter),
        productsApi.inquiryStats(),
      ]);
      setItems(list);
      setStats(s);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Қате');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  const advance = async (inq: ProductInquiry) => {
    const next = NEXT[inq.status];
    if (!next) return;
    try {
      const updated = await productsApi.updateInquiry(inq.id, { status: next });
      setItems((prev) => prev.map((i) => (i.id === inq.id ? updated : i)));
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Қате');
    }
  };

  if (!allowed) {
    return (
      <div className="page">
        <Header title="Сұраныстар" />
        <EmptyState icon="🔒" title="Рұқсат жоқ" description="Тек басшылық көреді." />
      </div>
    );
  }

  return (
    <div className="page">
      <Header title="Клиент сұраныстары" />

      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}

      {stats && (
        <div className="stat-grid stat-grid--3">
          <div className={`stat-card ${stats.new > 0 ? 'stat-card--danger' : ''}`}>
            <div className="stat-card__icon" aria-hidden>🆕</div>
            <div className="stat-card__value">{stats.new}</div>
            <div className="stat-card__label">Жаңа</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__icon" aria-hidden>📞</div>
            <div className="stat-card__value">{stats.contacted}</div>
            <div className="stat-card__label">Байланысқан</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__icon" aria-hidden>✅</div>
            <div className="stat-card__value">{stats.closed}</div>
            <div className="stat-card__label">Жабық</div>
          </div>
        </div>
      )}

      <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
        {(['ALL', 'NEW', 'CONTACTED', 'CLOSED'] as const).map((f) => (
          <button
            key={f}
            className={`chip ${filter === f ? 'is-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'ALL' ? 'Барлығы' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState icon="📭" title="Сұраныс жоқ" description="Жаңа сұраныстар осында көрінеді." />
      ) : (
        <div className="list" style={{ marginTop: 8 }}>
          {items.map((inq) => {
            const c = STATUS_COLOR[inq.status];
            const next = NEXT[inq.status];
            return (
              <div key={inq.id} className="card" style={{ padding: 14 }}>
                <div className="card__row" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="card__title">{inq.name}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{fmtDate(inq.createdAt)}</div>
                  </div>
                  <span className="badge" style={{ background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700 }}>
                    {STATUS_LABEL[inq.status]}
                  </span>
                </div>

                <div style={{ marginTop: 8, fontSize: 14, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <a href={`tel:${inq.phone}`} style={{ fontWeight: 600 }}>📞 {inq.phone}</a>
                  {inq.email && <a href={`mailto:${inq.email}`} className="muted">✉️ {inq.email}</a>}
                  {inq.company && <span className="muted">🏢 {inq.company}</span>}
                  {inq.product && (
                    <Link to={`/admin/products/${inq.product.id}`}>📦 {inq.product.name}</Link>
                  )}
                  {inq.quantity != null && <span className="muted">Саны: {inq.quantity}</span>}
                  {inq.message && (
                    <div className="card" style={{ padding: 10, marginTop: 4, background: 'var(--tg-secondary)', whiteSpace: 'pre-wrap' }}>
                      {inq.message}
                    </div>
                  )}
                </div>

                {next && (
                  <button
                    className="btn btn--soft btn--block"
                    style={{ marginTop: 10 }}
                    onClick={() => advance(inq)}
                  >
                    {next === 'CONTACTED' ? '📞 Байланыстым деп белгілеу' : '✅ Жабу'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
