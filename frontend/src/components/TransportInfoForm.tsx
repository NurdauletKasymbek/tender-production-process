import { useState } from 'react';

interface TransportData {
  transportProvider: string;
  driverName: string;
  driverPhone: string;
  vehicleType: string;
  vehiclePlate: string;
  expectedArrival: string;
}

interface Props {
  initial?: Partial<TransportData>;
  onSubmit: (data: TransportData) => Promise<void> | void;
  onCancel: () => void;
  busy?: boolean;
}

export function TransportInfoForm({ initial, onSubmit, onCancel, busy }: Props) {
  const [form, setForm] = useState<TransportData>({
    transportProvider: initial?.transportProvider || '',
    driverName: initial?.driverName || '',
    driverPhone: initial?.driverPhone || '',
    vehicleType: initial?.vehicleType || '',
    vehiclePlate: initial?.vehiclePlate || '',
    expectedArrival: initial?.expectedArrival || '',
  });
  const [err, setErr] = useState<string | null>(null);

  const required = ['transportProvider', 'driverName', 'driverPhone', 'vehiclePlate'] as const;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = required.filter((k) => !form[k].trim());
    if (missing.length > 0) {
      setErr('Барлық міндетті өрістерді толтырыңыз');
      return;
    }
    setErr(null);
    await onSubmit(form);
  };

  return (
    <form className="card form" onSubmit={submit}>
      <div className="info-banner" style={{ fontSize: 13 }}>
        🚛 <strong>Көлік ақпараты міндетті</strong> — Логистикаға өту үшін жоғарыдағы өрістерді
        толтырыңыз. Директор Mini App-та толық ақпаратты көреді.
      </div>

      {err && <div className="alert alert--error"><span>⚠️</span><span>{err}</span></div>}

      <label className="field">
        <span className="field__label">Тасымалдаушы (компания/жеке)<span className="field__star">*</span></span>
        <input
          className="input"
          required
          placeholder='Мысалы: "Самосвал-Транс LLP" немесе "Жеке тасымалдаушы"'
          value={form.transportProvider}
          onChange={(e) => setForm({ ...form, transportProvider: e.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Жүргізуші аты-жөні<span className="field__star">*</span></span>
        <input
          className="input"
          required
          placeholder="Иванов Иван Иванович"
          value={form.driverName}
          onChange={(e) => setForm({ ...form, driverName: e.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Жүргізуші телефоны<span className="field__star">*</span></span>
        <input
          className="input"
          type="tel"
          required
          placeholder="+7 700 123 4567"
          value={form.driverPhone}
          onChange={(e) => setForm({ ...form, driverPhone: e.target.value })}
        />
      </label>

      <div className="form__row">
        <label className="field">
          <span className="field__label">Көлік түрі</span>
          <input
            className="input"
            placeholder="Газель / Камаз"
            value={form.vehicleType}
            onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field__label">Мемнөмір<span className="field__star">*</span></span>
          <input
            className="input"
            required
            placeholder="123ABC01"
            value={form.vehiclePlate}
            onChange={(e) => setForm({ ...form, vehiclePlate: e.target.value })}
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Болжамды жеткізу уақыты</span>
        <input
          className="input"
          type="datetime-local"
          value={form.expectedArrival}
          onChange={(e) => setForm({ ...form, expectedArrival: e.target.value })}
        />
      </label>

      <div className="form__buttons">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Жіберілуде...' : '🚛 Жолға шығару'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          Болдырмау
        </button>
      </div>
    </form>
  );
}
