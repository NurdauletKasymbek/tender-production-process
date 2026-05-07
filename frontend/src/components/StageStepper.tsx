import type { OrderStatus } from '../types';
import { STATUS_LABEL } from '../utils/labels';

const PIPELINE: OrderStatus[] = [
  'NEW_TENDER',
  'REVIEW',
  'CONFIRMATION',
  'PRODUCTION',
  'PACKAGING',
  'STORAGE',
  'LOADING',
  'LOGISTICS',
  'DELIVERY',
  'CLOSED',
];

interface Props {
  current: OrderStatus;
  compact?: boolean;
}

export function StageStepper({ current, compact = false }: Props) {
  if (current === 'REJECTED') {
    return (
      <div className="stepper stepper--rejected">
        <span className="stepper__rejected-icon" aria-hidden>✕</span>
        <span>Тапсырыс қабылданбады</span>
      </div>
    );
  }

  const currentIdx = PIPELINE.indexOf(current);
  const total = PIPELINE.length;

  if (compact) {
    return (
      <div className="stepper-bar" aria-label={`${STATUS_LABEL[current]}: ${currentIdx + 1}/${total}`}>
        {PIPELINE.map((s, i) => (
          <span
            key={s}
            className={`stepper-bar__seg ${
              i < currentIdx ? 'is-done' : i === currentIdx ? 'is-active' : ''
            }`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="stepper">
      {PIPELINE.map((s, i) => {
        const state = i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending';
        return (
          <div key={s} className={`stepper__item is-${state}`}>
            <div className="stepper__node">
              {state === 'done' ? '✓' : i + 1}
            </div>
            <div className="stepper__label">{STATUS_LABEL[s]}</div>
            {i < PIPELINE.length - 1 && (
              <div className={`stepper__line ${i < currentIdx ? 'is-done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
