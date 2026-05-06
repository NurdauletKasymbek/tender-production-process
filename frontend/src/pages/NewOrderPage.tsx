import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { ordersApi } from '../api/endpoints';
import { hapticNotify, showAlert } from '../utils/telegram';

export function NewOrderPage() {
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tenderNumber: '',
    customerName: '',
    customerBin: '',
    productName: '',
    productDescription: '',
    quantity: 1,
    totalAmount: 0,
    deadline: '',
    deliveryAddress: '',
    notes: '',
  });

  const update = <K extends keyof typeof form>(key: K, v: typeof form[K]) =>
    setForm((p) => ({ ...p, [key]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const order = await ordersApi.create({
        tenderNumber: form.tenderNumber.trim(),
        customerName: form.customerName.trim(),
        customerBin: form.customerBin.trim() || undefined,
        productName: form.productName.trim(),
        productDescription: form.productDescription.trim() || undefined,
        quantity: Number(form.quantity),
        totalAmount: Number(form.totalAmount),
        deadline: new Date(form.deadline).toISOString(),
        deliveryAddress: form.deliveryAddress.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      hapticNotify('success');
      await showAlert('Тапсырыс сәтті жасалды');
      nav(`/orders/${order.id}`, { replace: true });
    } catch (e: any) {
      hapticNotify('error');
      setError(e.message || 'Тапсырыс жасау мүмкін болмады');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <Header title="Жаңа тапсырыс" showBell={false} />
      {error && <div className="alert alert--error">{error}</div>}
      <form className="form" onSubmit={submit}>
        <Field label="Тендер нөмірі" required>
          <input className="input" required value={form.tenderNumber}
            onChange={(e) => update('tenderNumber', e.target.value)} />
        </Field>
        <Field label="Тапсырыс беруші" required>
          <input className="input" required value={form.customerName}
            onChange={(e) => update('customerName', e.target.value)} />
        </Field>
        <Field label="БСН">
          <input className="input" inputMode="numeric" value={form.customerBin}
            onChange={(e) => update('customerBin', e.target.value)} />
        </Field>
        <Field label="Өнім атауы" required>
          <input className="input" required value={form.productName}
            onChange={(e) => update('productName', e.target.value)} />
        </Field>
        <Field label="Өнім сипаттамасы">
          <textarea className="input input--textarea" value={form.productDescription}
            onChange={(e) => update('productDescription', e.target.value)} />
        </Field>
        <div className="form__row">
          <Field label="Саны" required>
            <input className="input" type="number" min={1} required value={form.quantity}
              onChange={(e) => update('quantity', Number(e.target.value))} />
          </Field>
          <Field label="Сома (₸)" required>
            <input className="input" type="number" min={0} required value={form.totalAmount}
              onChange={(e) => update('totalAmount', Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Жеткізу мерзімі" required>
          <input className="input" type="date" required value={form.deadline}
            onChange={(e) => update('deadline', e.target.value)} />
        </Field>
        <Field label="Жеткізу мекенжайы">
          <input className="input" value={form.deliveryAddress}
            onChange={(e) => update('deliveryAddress', e.target.value)} />
        </Field>
        <Field label="Ескертпе">
          <textarea className="input input--textarea" value={form.notes}
            onChange={(e) => update('notes', e.target.value)} />
        </Field>
        <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
          {submitting ? 'Сақталуда...' : 'Тапсырысты сақтау'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">
        {label}{required && <span className="field__star">*</span>}
      </span>
      {children}
    </label>
  );
}
