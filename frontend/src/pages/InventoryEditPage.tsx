import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { Spinner } from '../components/Spinner';
import { stockApi } from '../api/endpoints';
import { hapticNotify } from '../utils/telegram';

export function InventoryEditPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('дана');
  const [minQuantity, setMinQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    stockApi.get(id)
      .then((it) => {
        setName(it.name);
        setSku(it.sku || '');
        setCategory(it.category || '');
        setUnit(it.unit);
        setMinQuantity(it.minQuantity != null ? String(it.minQuantity) : '');
        setLocation(it.location || '');
        setNotes(it.notes || '');
      })
      .catch((e) => setError(e?.message || 'Қате'))
      .finally(() => setLoading(false));
  }, [id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !name.trim()) { setError('Атау міндетті'); return; }
    setBusy(true); setError(null);
    try {
      await stockApi.update(id, {
        name: name.trim(),
        sku: sku.trim(),
        category: category.trim(),
        unit: unit.trim() || 'дана',
        minQuantity: minQuantity ? Number(minQuantity) : undefined,
        location: location.trim(),
        notes: notes.trim(),
      });
      hapticNotify('success');
      nav(`/inventory/${id}`, { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Қате');
      hapticNotify('error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="page">
      <Header title="Бірлікті өңдеу" showBell={false} />

      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Атау *</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="grid-2">
          <label className="field">
            <span className="field__label">SKU</span>
            <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Санат</span>
            <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
        </div>
        <div className="grid-2">
          <label className="field">
            <span className="field__label">Өлшем бірлігі</span>
            <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Мин. қалдық</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.001"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
            />
          </label>
        </div>
        <label className="field">
          <span className="field__label">Орны</span>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">Ескертпе</span>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}
        <div className="flex gap-sm" style={{ flexDirection: 'column' }}>
          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
            {busy ? 'Сақталуда...' : 'Сақтау'}
          </button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => nav(-1)} disabled={busy}>
            Бас тарту
          </button>
        </div>
      </form>
    </div>
  );
}
