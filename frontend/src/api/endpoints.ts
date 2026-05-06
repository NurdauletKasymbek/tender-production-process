import { api } from './client';
import type {
  AuthResponse, DashboardStats, Notification, Order, OrderStatus, ProductionTask, TaskStatus,
} from '../types';

export const authApi = {
  loginWithTelegram: (initData: string) =>
    api.post<AuthResponse>('/auth/telegram', { initData }).then((r) => r.data),
};

export const ordersApi = {
  list: (params: { status?: OrderStatus; mine?: boolean } = {}) =>
    api.get<Order[]>('/orders', {
      params: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.mine ? { mine: 'true' } : {}),
      },
    }).then((r) => r.data),

  get: (id: string) => api.get<Order>(`/orders/${id}`).then((r) => r.data),

  dashboard: () => api.get<DashboardStats>('/orders/dashboard').then((r) => r.data),

  changeStatus: (id: string, next: OrderStatus, body: { comment?: string; responsibleId?: string } = {}) =>
    api.patch<Order>(`/orders/${id}/status/${next}`, body).then((r) => r.data),

  create: (body: {
    tenderNumber: string;
    customerName: string;
    productName: string;
    quantity: number;
    totalAmount: number;
    deadline: string;
    customerBin?: string;
    productDescription?: string;
    deliveryAddress?: string;
    notes?: string;
  }) => api.post<Order>('/orders', body).then((r) => r.data),
};

export const productionApi = {
  myTasks: () => api.get<ProductionTask[]>('/production/my-tasks').then((r) => r.data),

  createTask: (body: {
    orderId: string;
    title: string;
    description?: string;
    assigneeId?: string;
    deadline?: string;
  }) => api.post<ProductionTask>('/production/tasks', body).then((r) => r.data),

  updateTaskStatus: (id: string, status: TaskStatus) =>
    api.patch<ProductionTask>(`/production/tasks/${id}/status/${status}`).then((r) => r.data),
};

export const notificationsApi = {
  list: (unreadOnly = false) =>
    api.get<Notification[]>('/notifications', { params: unreadOnly ? { unread: 'true' } : {} })
      .then((r) => r.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
};
