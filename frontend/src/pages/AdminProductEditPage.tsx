import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { Spinner } from '../components/Spinner';
import { productsApi, productImageUrl } from '../api/endpoints';
import type { Product, ProductImage } from '../types';
import { hapticNotify } from '../utils/telegram';

export function AdminProductEditPage() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('дана');
  const [price, setPrice] = useState('');
  const [sku, setSku] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');

  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fill = (p: Product) => {
    setName(p.name);
    setCategory(p.category || '');
    setDescription(p.description || '');
    setUnit(p.unit);
    setPrice(p.price != null ? String(p.price) : '');
    setSku(p.sku || '');
    setIsPublished(p.isPublished);
    setSortOrder(String(p.sortOrder));
    setImages(p.images || []);
  };

  useEffect(() => {
    if (isNew) return;
    productsApi.get(id!)
      .then(fill)
      .catch((e) => setError(e?.response?.data?.message || e?.message || 'Жүктеу қатесі'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Атау міндетті'); return; }
    setBusy(true); setError(null);
    try {
      const body = {
        name: name.trim(),
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        unit: unit.trim() || 'дана',
        price: price ? Number(price) : undefined,
        sku: sku.trim() || undefined,
        isPublished,
        sortOrder: sortOrder ? Number(sortOrder) : 0,
      };
      if (isNew) {
        const created = await productsApi.create(body);
        hapticNotify('success');
        // Жасалғаннан кейін өңдеу бетіне — сурет қосу үшін
        nav(`/admin/products/${created.id}`, { replace: true });
      } else {
        await productsApi.update(id!, { ...body, price: price ? Number(price) : null });
        hapticNotify('success');
        nav('/admin/products');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Сақтау қатесі');
      hapticNotify('error');
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (files: FileList | null) => {
    if (!files || !id) return;
    setUploading(true); setError(null);
    try {
      for (const f of Array.from(files)) {
        const img = await productsApi.addImage(id, f);
        setImages((prev) => [...prev, img]);
      }
      hapticNotify('success');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Сурет жүктеу қатесі');
      hapticNotify('error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteImage = async (imageId: string) => {
    try {
      await productsApi.removeImage(imageId);
      setImages((prev) => prev.filter((i) => i.id !== imageId));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Өшіру қатесі');
    }
  };

  const makeCover = async (imageId: string) => {
    if (!id) return;
    const reordered = [imageId, ...images.filter((i) => i.id !== imageId).map((i) => i.id)];
    try {
      const updated = await productsApi.reorderImages(id, reordered);
      setImages(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Реттеу қатесі');
    }
  };

  const removeProduct = async () => {
    if (!id) return;
    if (!window.confirm('Бұл тауарды суреттерімен бірге өшіру керек пе?')) return;
    setBusy(true);
    try {
      await productsApi.remove(id);
      hapticNotify('success');
      nav('/admin/products', { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Өшіру қатесі');
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <Header title="Тауар" showBell={false} />
        <Spinner label="Жүктелуде..." />
      </div>
    );
  }

  return (
    <div className="page">
      <Header title={isNew ? 'Жаңа тауар' : 'Тауарды өңдеу'} showBell={false} />

      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Атау *</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <div className="grid-2">
          <label className="field">
            <span className="field__label">Санат</span>
            <input
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="плитка / бордюр..."
            />
          </label>
          <label className="field">
            <span className="field__label">Артикул (SKU)</span>
            <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} />
          </label>
        </div>

        <div className="grid-2">
          <label className="field">
            <span className="field__label">Баға (₸, бос — «сұрау бойынша»)</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Өлшем бірлігі</span>
            <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Сипаттама</span>
          <textarea
            className="input"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Өлшемдері, материалы, артықшылықтары..."
          />
        </label>

        <div className="grid-2">
          <label className="field">
            <span className="field__label">Сұрыптау реті (кіші — жоғары)</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </label>
          <label className="field" style={{ justifyContent: 'flex-end' }}>
            <span className="field__label">Каталогта көрсету</span>
            <label className="flex gap-sm" style={{ alignItems: 'center', height: 44 }}>
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                style={{ width: 20, height: 20 }}
              />
              <span>{isPublished ? 'Жарияланған' : 'Черновик (жасырын)'}</span>
            </label>
          </label>
        </div>

        {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? 'Сақталуда...' : 'Сақтау'}
        </button>
      </form>

      {/* ============== СУРЕТТЕР (тек бар тауарда) ============== */}
      {!isNew && (
        <div style={{ marginTop: 20 }}>
          <h3 className="section-title">Суреттер</h3>
          <p className="muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>
            Бірінші сурет — каталогтағы басты (cover). Cover ету үшін суретті басыңыз.
          </p>

          {images.length > 0 && (
            <div className="img-manage">
              {images.map((img, i) => (
                <div key={img.id} className="img-manage__cell">
                  <img
                    className="img-manage__img"
                    src={productImageUrl(img.id)}
                    alt=""
                    onClick={() => i !== 0 && makeCover(img.id)}
                    style={{ cursor: i === 0 ? 'default' : 'pointer' }}
                  />
                  {i === 0 && <span className="img-manage__cover">Басты</span>}
                  <button
                    type="button"
                    className="img-manage__del"
                    onClick={() => deleteImage(img.id)}
                    aria-label="Өшіру"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="btn btn--soft btn--block"
            style={{ marginTop: 10 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <span aria-hidden>📷</span>
            <span>{uploading ? 'Жүктелуде...' : 'Сурет қосу'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => onUpload(e.target.files)}
          />

          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginTop: 18, color: 'var(--danger)' }}
            onClick={removeProduct}
            disabled={busy}
          >
            🗑️ Тауарды өшіру
          </button>
        </div>
      )}

      <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 10 }} onClick={() => nav('/admin/products')}>
        ← Тізімге оралу
      </button>
    </div>
  );
}
