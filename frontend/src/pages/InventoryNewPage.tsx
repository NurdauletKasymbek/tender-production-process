import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { stockApi } from '../api/endpoints';
import { hapticNotify } from '../utils/telegram';

export function InventoryNewPage() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('дана');
  const [initialQuantity, setInitialQuantity] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Атау міндетті'); return; }
    setBusy(true); setError(null);
    try {
      const item = await stockApi.create({
        name: name.trim(),
        sku: sku.trim() || undefined,
        category: category.trim() || undefined,
        unit: unit.trim() || 'дана',
        initialQuantity: initialQuantity ? Number(initialQuantity) : undefined,
        minQuantity: minQuantity ? Number(minQuantity) : undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      hapticNotify('success');
      nav(`/inventory/${item.id}`, { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Қате');
      hapticNotify('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Header title="Жаңа склад бірлігі" showBell={false} />

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
            <input
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="тауар / шикізат / қаптама"
            />
          </label>
        </div>

        <div className="grid-2">
          <label className="field">
            <span className="field__label">Өлшем бірлігі</span>
            <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Орны</span>
            <input
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="А1-3"
            />
          </label>
        </div>

        <div className="grid-2">
          <label className="field">
            <span className="field__label">Бастапқы қалдық</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.001"
              value={initialQuantity}
              onChange={(e) => setInitialQuantity(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Мин. қалдық (сигнал)</span>
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
          <span className="field__label">Ескертпе</span>
          <textarea
            className="input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
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
