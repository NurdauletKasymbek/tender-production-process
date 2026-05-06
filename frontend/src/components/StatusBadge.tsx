import type { OrderStatus, TaskStatus } from '../types';
import { STATUS_COLOR, STATUS_LABEL, TASK_STATUS_COLOR, TASK_STATUS_LABEL } from '../utils/labels';

interface OrderProps { kind?: 'order'; value: OrderStatus }
interface TaskProps { kind: 'task'; value: TaskStatus }
type Props = (OrderProps | TaskProps) & { size?: 'sm' | 'md' };

export function StatusBadge(props: Props) {
  const isTask = props.kind === 'task';
  const label = isTask ? TASK_STATUS_LABEL[props.value as TaskStatus] : STATUS_LABEL[props.value as OrderStatus];
  const color = isTask ? TASK_STATUS_COLOR[props.value as TaskStatus] : STATUS_COLOR[props.value as OrderStatus];
  return (
    <span
      className={`status-badge ${props.size === 'sm' ? 'status-badge--sm' : ''}`}
      style={{ background: color + '22', color }}
    >
      <span className="status-badge__dot" style={{ background: color }} />
      {label}
    </span>
  );
}
