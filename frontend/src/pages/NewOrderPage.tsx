import { FormEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { filesApi, ordersApi } from '../api/endpoints';
import { hapticNotify, showAlert } from '../utils/telegram';
import type { FileType, FulfillmentType } from '../types';

interface AttachedFile {
  file: File;
  fileType: FileType;
}

const ATTACH_TYPE_OPTIONS: Array<{ value: FileType; label: string }> = [
  { value: 'TECHNICAL_SPEC', label: '📋 Техникалық тапсырма' },
  { value: 'CONTRACT', label: '📄 Келісімшарт' },
  { value: 'OTHER', label: '📎 Басқа' },
];

export function NewOrderPage() {
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    fulfillmentType: 'PRODUCTION' as FulfillmentType,
  });

  const update = <K extends keyof typeof form>(key: K, v: typeof form[K]) =>
    setForm((p) => ({ ...p, [key]: v }));

  const pickFiles = () => fileInputRef.current?.click();

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    if (list.length === 0) return;
    setFiles((prev) => [
      ...prev,
      ...list.map((f) => ({
        file: f,
        // Бірінші — техникалық тапсырма деп болжаймыз. Кейін өзгертуге болады.
        fileType: 'TECHNICAL_SPEC' as FileType,
      })),
    ]);
  };

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const changeFileType = (idx: number, type: FileType) =>
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, fileType: type } : f)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // 1. Тапсырысты жасау
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
        fulfillmentType: form.fulfillmentType,
      });

      // 2. Файлдарды жүктеу — әрбірі бөлек.
      // Біреуі сәтсіз болса да қалғаны жалғасады, нәтижесі alert-те.
      let uploaded = 0;
      let failed = 0;
      for (const f of files) {
        try {
          await filesApi.upload({
            orderId: order.id,
            file: f.file,
            fileType: f.fileType,
          });
          uploaded += 1;
        } catch {
          failed += 1;
        }
      }

      hapticNotify('success');
      let msg = 'Тапсырыс сәтті жасалды.';
      if (uploaded > 0) msg += `\n📎 Жүктелген файл: ${uploaded}`;
      if (failed > 0) msg += `\n⚠️ Жүктелмеген файл: ${failed} (тапсырыс бетінен қайта тіркеңіз)`;
      await showAlert(msg);
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
      <div className="info-banner">
        <strong>Қолмен тапсырыс</strong>: өнім атауын мен сипаттамасын өзіңіз жазыңыз.
        Техникалық тапсырманы (PDF/фото) форма ішіне бірден тіркеуге болады.
      </div>
      {error && <div className="alert alert--error"><span>⚠️</span><span>{error}</span></div>}

      <form className="form" onSubmit={submit}>
        <Field label="Тендер нөмірі" required>
          <input className="input" required value={form.tenderNumber}
            onChange={(e) => update('tenderNumber', e.target.value)} />
        </Field>

        <Field label="Тапсырыс беруші" required>
          <input className="input" required value={form.customerName}
            onChange={(e) => update('customerName', e.target.value)}
            placeholder="мысалы: «...» ШЖҚ МКҚК" />
        </Field>

        <Field label="БСН">
          <input className="input" inputMode="numeric" value={form.customerBin}
            onChange={(e) => update('customerBin', e.target.value)}
            placeholder="12 саннан тұрады" />
        </Field>

        <Field label="Өнім атауы" required>
          <input className="input" required value={form.productName}
            onChange={(e) => update('productName', e.target.value)}
            placeholder="мысалы: Кеңсе үстелі, ученический" />
        </Field>

        <Field label="Өнім сипаттамасы (қысқаша)">
          <textarea
            className="input input--textarea"
            rows={3}
            value={form.productDescription}
            onChange={(e) => update('productDescription', e.target.value)}
            placeholder="Материал, өлшем, түс — бір-екі сөйлеммен. Толық сипаттаманы файлмен қоса беріңіз."
          />
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

        <Field label="Орындау түрі" required>
          <div className="tabs">
            <button
              type="button"
              className={`tabs__item ${form.fulfillmentType === 'PRODUCTION' ? 'is-active' : ''}`}
              onClick={() => update('fulfillmentType', 'PRODUCTION')}
            >
              🏭 Цехта жасалады
            </button>
            <button
              type="button"
              className={`tabs__item ${form.fulfillmentType === 'STOCK' ? 'is-active' : ''}`}
              onClick={() => update('fulfillmentType', 'STOCK')}
            >
              📦 Складтан
            </button>
          </div>
          <span className="field__hint">
            Дайын өнім бар болса "Складтан" — цех аттап өтіледі.
          </span>
        </Field>

        <Field label="Ескертпе">
          <textarea className="input input--textarea" value={form.notes}
            onChange={(e) => update('notes', e.target.value)} />
        </Field>

        {/* === Файлдар === */}
        <div className="field">
          <span className="field__label">
            📎 Файлдарды тіркеу (PDF, фото)
          </span>
          <span className="field__hint" style={{ marginBottom: 8 }}>
            Техникалық тапсырма, келісімшарт немесе басқа файлдарды бірден қоса беріңіз.
            Тапсырыс сақталған соң файлдар сонымен бірге жүктеледі.
          </span>
          <button
            type="button"
            className="btn btn--soft btn--block"
            onClick={pickFiles}
            disabled={submitting}
          >
            <span aria-hidden>📎</span>
            <span>{files.length === 0 ? 'Файл таңдау' : 'Тағы файл қосу'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            style={{ display: 'none' }}
            onChange={onPickFiles}
          />

          {files.length > 0 && (
            <div className="attached-list">
              {files.map((f, idx) => (
                <div key={idx} className="attached-row">
                  <div className="attached-row__name" title={f.file.name}>
                    {f.file.type.startsWith('image/') ? '🖼️' : '📄'} {f.file.name}
                  </div>
                  <select
                    className="input attached-row__type"
                    value={f.fileType}
                    onChange={(e) => changeFileType(idx, e.target.value as FileType)}
                  >
                    {ATTACH_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="attached-row__remove"
                    onClick={() => removeFile(idx)}
                    aria-label="Файлды алып тастау"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
          {submitting ? 'Сақталуда...' : `Тапсырысты сақтау${files.length > 0 ? ` (+${files.length} файл)` : ''}`}
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
