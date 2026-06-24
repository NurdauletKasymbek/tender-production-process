import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { catalogApi, productImageUrl } from '../api/endpoints';
import { CatalogTopbar, formatPrice } from '../components/CatalogTopbar';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import type { Product } from '../types';

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Сұраныс формасы
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    catalogApi.bySlug(slug)
      .then((p) => { setProduct(p); setActiveImg(0); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setFormError('Аты-жөні мен телефон міндетті');
      return;
    }
    setSending(true); setFormError(null);
    try {
      await catalogApi.inquiry({
        productId: product?.id,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        company: company.trim() || undefined,
        quantity: quantity ? Number(quantity) : undefined,
        message: message.trim() || undefined,
      });
      setSent(true);
    } catch (e: any) {
      setFormError(e?.response?.data?.message || e?.message || 'Жіберу қатесі');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell app-shell--no-nav">
        <CatalogTopbar />
        <div className="catalog-wrap"><Spinner label="Жүктелуде..." /></div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="app-shell app-shell--no-nav">
        <CatalogTopbar />
        <div className="catalog-wrap">
          <EmptyState icon="🔍" title="Тауар табылмады" description="Сілтеме ескірген болуы мүмкін." />
          <Link to="/catalog" className="btn btn--soft btn--block" style={{ marginTop: 12 }}>← Каталогқа оралу</Link>
        </div>
      </div>
    );
  }

  const price = formatPrice(product.price, product.currency);
  const images = product.images || [];
  const hero = images[activeImg];

  return (
    <div className="app-shell app-shell--no-nav">
      <CatalogTopbar />
      <div className="catalog-wrap">
        <Link to="/catalog" className="muted" style={{ display: 'inline-block', marginBottom: 10, fontSize: 13 }}>
          ← Каталог
        </Link>

        {hero ? (
          <img className="product-hero" src={productImageUrl(hero.id)} alt={product.name} />
        ) : (
          <div className="product-hero product-hero--placeholder" aria-hidden>🖼️</div>
        )}

        {images.length > 1 && (
          <div className="product-thumbs">
            {images.map((img, i) => (
              <img
                key={img.id}
                className={`product-thumbs__item ${i === activeImg ? 'is-active' : ''}`}
                src={productImageUrl(img.id)}
                alt=""
                onClick={() => setActiveImg(i)}
              />
            ))}
          </div>
        )}

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '14px 0 6px' }}>{product.name}</h1>
        {product.category && (
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{product.category}</div>
        )}

        <div style={{ margin: '10px 0 4px' }}>
          {price ? (
            <span className="price-tag">{price}</span>
          ) : (
            <span className="price-tag--ask">Баға сұрау бойынша</span>
          )}
          <span className="muted" style={{ fontSize: 14, marginLeft: 8 }}>/ {product.unit}</span>
        </div>

        {product.sku && (
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Артикул: {product.sku}</div>
        )}

        {product.description && (
          <div className="card" style={{ padding: 14, marginTop: 16, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {product.description}
          </div>
        )}

        {/* ============== СҰРАНЫС ФОРМАСЫ ============== */}
        <h2 className="section-title" style={{ marginTop: 24 }}>Сұраныс қалдыру</h2>

        {sent ? (
          <div className="alert alert--success" style={{ alignItems: 'flex-start' }}>
            <span>✓</span>
            <div>
              Рақмет! Сұранысыңыз қабылданды. Біз жақын арада сізбен байланысамыз.
            </div>
          </div>
        ) : (
          <form className="form" onSubmit={submit}>
            <div className="grid-2">
              <label className="field">
                <span className="field__label">Аты-жөні *</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className="field">
                <span className="field__label">Телефон *</span>
                <input
                  className="input"
                  type="tel"
                  inputMode="tel"
                  placeholder="+7 700 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </label>
            </div>
            <div className="grid-2">
              <label className="field">
                <span className="field__label">Email</span>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">Компания</span>
                <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
            </div>
            <label className="field">
              <span className="field__label">Қажетті саны ({product.unit})</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">Хабарлама</span>
              <textarea
                className="input"
                rows={3}
                placeholder="Қосымша талаптар, жеткізу мерзімі..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>

            {formError && <div className="alert alert--error"><span>⚠️</span><span>{formError}</span></div>}

            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={sending}>
              {sending ? 'Жіберілуде...' : 'Сұраныс жіберу'}
            </button>
          </form>
        )}

        <div style={{ height: 32 }} />
      </div>
    </div>
  );
}
