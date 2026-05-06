import { api } from './client';
import type {
  AuthResponse, DashboardStats, FileType, Notification, Order, OrderFile,
  OrderStatus, ProductionTask, TaskStatus,
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

  exportCsvUrl: (status?: OrderStatus) => {
    const base = (api.defaults.baseURL || '/api').replace(/\/$/, '');
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return `${base}/orders/export.csv${qs}`;
  },

  downloadCsv: async (status?: OrderStatus) => {
    const res = await api.get('/orders/export.csv', {
      params: status ? { status } : {},
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

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

export const goszakupApi = {
  status: () => api.get<{ configured: boolean }>('/goszakup/status').then((r) => r.data),
  sync: () =>
    api.post<{
      ok: boolean;
      configured?: boolean;
      fetched?: number;
      created?: number;
      skipped?: number;
      message?: string;
    }>('/goszakup/sync').then((r) => r.data),
};

export const filesApi = {
  list: (orderId: string) =>
    api.get<OrderFile[]>(`/files/order/${orderId}`).then((r) => r.data),

  upload: (params: { orderId: string; file: File; fileType: FileType }) => {
    const fd = new FormData();
    fd.append('orderId', params.orderId);
    fd.append('fileType', params.fileType);
    fd.append('file', params.file);
    return api.post<OrderFile>('/files/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  remove: (id: string) => api.delete(`/files/${id}`).then((r) => r.data),

  /** URL-ді тікелей <img src> немесе <a href> үшін қолдану */
  downloadUrl: (id: string, inline = false) => {
    const base = (api.defaults.baseURL || '/api').replace(/\/$/, '');
    return `${base}/files/${id}${inline ? '?inline=true' : ''}`;
  },
};

export const notificationsApi = {
  list: (unreadOnly = false) =>
    api.get<Notification[]>('/notifications', { params: unreadOnly ? { unread: 'true' } : {} })
      .then((r) => r.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
};
