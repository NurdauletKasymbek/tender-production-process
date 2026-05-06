import type { ProductionTask, TaskStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { formatDate } from '../utils/labels';

interface Props {
  task: ProductionTask;
  onChangeStatus?: (next: TaskStatus) => void;
}

export function TaskCard({ task, onChangeStatus }: Props) {
  return (
    <div className="card">
      <div className="card__row">
        <span className="card__title">{task.title}</span>
        <StatusBadge kind="task" value={task.status} size="sm" />
      </div>
      {task.description && <div className="muted card__product">{task.description}</div>}
      {task.order && (
        <div className="card__meta">
          <span className="muted">№{task.order.tenderNumber} · {task.order.productName}</span>
        </div>
      )}
      <div className="card__row card__footer">
        <span className="muted">Мерзім: {formatDate(task.deadline)}</span>
      </div>
      {onChangeStatus && task.status !== 'COMPLETED' && (
        <div className="task-actions">
          {task.status === 'PENDING' && (
            <button className="btn btn--primary btn--sm" onClick={() => onChangeStatus('IN_PROGRESS')}>
              Бастау
            </button>
          )}
          {task.status === 'IN_PROGRESS' && (
            <>
              <button className="btn btn--primary btn--sm" onClick={() => onChangeStatus('COMPLETED')}>
                Аяқтау
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => onChangeStatus('BLOCKED')}>
                Кедергі
              </button>
            </>
          )}
          {task.status === 'BLOCKED' && (
            <button className="btn btn--primary btn--sm" onClick={() => onChangeStatus('IN_PROGRESS')}>
              Жалғастыру
            </button>
          )}
        </div>
      )}
    </div>
  );
}
