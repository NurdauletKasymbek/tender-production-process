export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {label && <div className="spinner__label">{label}</div>}
    </div>
  );
}
