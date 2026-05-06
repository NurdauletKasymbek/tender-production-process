import type { OrderStatus, TaskStatus, UserRole } from '../types';

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'Әкімші',
  TENDER_DEPARTMENT: 'Тендерлік бөлім',
  DIRECTOR: 'Басшы',
  PRODUCTION_HEAD: 'Өндіріс бастығы',
  WORKSHOP_WORKER: 'Цех маманы',
  PACKAGING: 'Қаптау',
  LOADING: 'Тиеу',
  LOGISTICS: 'Логист',
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW_TENDER: 'Жаңа тендер',
  REVIEW: 'Тексеру',
  CONFIRMATION: 'Растау',
  PRODUCTION: 'Өндіріс',
  PACKAGING: 'Қаптау',
  LOADING: 'Тиеу',
  LOGISTICS: 'Жолда',
  DELIVERY: 'Жеткізу',
  CLOSED: 'Жабылды',
  REJECTED: 'Қабылданбады',
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  NEW_TENDER: '#0a84ff',
  REVIEW: '#5e9eff',
  CONFIRMATION: '#7d5cff',
  PRODUCTION: '#ff9f0a',
  PACKAGING: '#ffb340',
  LOADING: '#cc8e3a',
  LOGISTICS: '#34c759',
  DELIVERY: '#30b94d',
  CLOSED: '#8e8e93',
  REJECTED: '#ff3b30',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING: 'Күтуде',
  IN_PROGRESS: 'Орындалуда',
  COMPLETED: 'Аяқталды',
  BLOCKED: 'Кедергі',
};

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  PENDING: '#8e8e93',
  IN_PROGRESS: '#0a84ff',
  COMPLETED: '#34c759',
  BLOCKED: '#ff3b30',
};

export const PRIORITY_LABEL: Record<number, string> = {
  0: 'Қалыпты',
  1: 'Жоғары',
  2: 'Шұғыл',
};

/** Әр рөл үшін негізгі жұмыс күйі (бастапқы фильтр) */
export const ROLE_PRIMARY_STATUS: Record<UserRole, OrderStatus | null> = {
  ADMIN: null,
  TENDER_DEPARTMENT: 'NEW_TENDER',
  DIRECTOR: 'CONFIRMATION',
  PRODUCTION_HEAD: 'PRODUCTION',
  WORKSHOP_WORKER: 'PRODUCTION',
  PACKAGING: 'PACKAGING',
  LOADING: 'LOADING',
  LOGISTICS: 'LOGISTICS',
};

export const NEXT_STATUS_BY_CURRENT: Partial<Record<OrderStatus, OrderStatus>> = {
  NEW_TENDER: 'REVIEW',
  REVIEW: 'CONFIRMATION',
  CONFIRMATION: 'PRODUCTION',
  PRODUCTION: 'PACKAGING',
  PACKAGING: 'LOADING',
  LOADING: 'LOGISTICS',
  LOGISTICS: 'DELIVERY',
  DELIVERY: 'CLOSED',
};

export function nextStepLabel(status: OrderStatus): string | null {
  const next = NEXT_STATUS_BY_CURRENT[status];
  if (!next) return null;
  switch (next) {
    case 'REVIEW': return 'Тексеруге жіберу';
    case 'CONFIRMATION': return 'Растауға жіберу';
    case 'PRODUCTION': return 'Өндіріске бастау';
    case 'PACKAGING': return 'Қаптауға беру';
    case 'LOADING': return 'Тиеуге беру';
    case 'LOGISTICS': return 'Жолға шығару';
    case 'DELIVERY': return 'Жеткізілді деп белгілеу';
    case 'CLOSED': return 'Жабу';
    default: return null;
  }
}

export function formatMoney(amount: string | number, currency = 'KZT'): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  return `${n.toLocaleString('kk-KZ')} ${currency === 'KZT' ? '₸' : currency}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('kk-KZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('kk-KZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function daysUntil(value: string): number {
  const d = new Date(value);
  const diff = d.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function deadlineLabel(value: string): { text: string; isOverdue: boolean; isSoon: boolean } {
  const days = daysUntil(value);
  if (days < 0) return { text: `${Math.abs(days)} күн кешікті`, isOverdue: true, isSoon: false };
  if (days === 0) return { text: 'Бүгін', isOverdue: false, isSoon: true };
  if (days <= 3) return { text: `${days} күн қалды`, isOverdue: false, isSoon: true };
  return { text: `${days} күн қалды`, isOverdue: false, isSoon: false };
}
