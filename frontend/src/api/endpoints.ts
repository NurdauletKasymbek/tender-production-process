import { api, tokenStorage } from './client';
import type {
  ActivityItem, AuthResponse, DashboardStats, FileType, FulfillmentType, Notification,
  Order, OrderFile, OrderMessage, OrderStatus, ProductionTask, StockItem, StockItemDetail,
  StockMovement, StockMovementType, StockStats, TaskStatus,
} from '../types';

export const authApi = {
  loginWithTelegram: (initData: string) =>
    api.post<AuthResponse>('/auth/telegram', { initData }).then((r) => r.data),
  loginWithPassword: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { username, password }).then((r) => r.data),
  me: () => api.get<import('../types').User>('/auth/me').then((r) => r.data),
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

  activity: (limit = 20) =>
    api.get<ActivityItem[]>('/orders/activity', { params: { limit } }).then((r) => r.data),

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

  changeStatus: (
    id: string,
    next: OrderStatus,
    body: {
      comment?: string;
      responsibleId?: string;
      fulfillmentType?: FulfillmentType;
      // Көлік ақпараты — LOADING → LOGISTICS өту үшін міндетті
      transportProvider?: string;
      driverName?: string;
      driverPhone?: string;
      vehicleType?: string;
      vehiclePlate?: string;
      departedAt?: string;
      expectedArrival?: string;
    } = {},
  ) => api.patch<Order>(`/orders/${id}/status/${next}`, body).then((r) => r.data),

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
    fulfillmentType?: FulfillmentType;
  }) => api.post<Order>('/orders', body).then((r) => r.data),

  linkStock: (id: string, body: {
    stockItemId?: string | null;
    stockQuantity?: number;
  }) => api.patch<Order>(`/orders/${id}/stock-link`, body).then((r) => r.data),
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
  sync: (silent = false) =>
    api.post<{
      ok: boolean;
      configured?: boolean;
      fetched?: number;
      created?: number;
      skipped?: number;
      silent?: boolean;
      message?: string;
    }>('/goszakup/sync', undefined, { params: silent ? { silent: 'true' } : {} }).then((r) => r.data),
  cleanupApproved: () =>
    api.post<{
      ok: boolean;
      configured?: boolean;
      fetched?: number;
      closedDoneIds?: number;
      closed?: number;
      message?: string;
    }>('/goszakup/cleanup-approved').then((r) => r.data),
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

  /** URL-ді тікелей <img src> немесе <a href> үшін қолдану.
   *  Browser тікелей URL-ге кіргенде Authorization header қоспайды,
   *  сондықтан JWT-ні query string-те жібереміз (`?token=...`). */
  downloadUrl: (id: string, inline = false) => {
    const base = (api.defaults.baseURL || '/api').replace(/\/$/, '');
    const token = tokenStorage.get();
    const params = new URLSearchParams();
    if (inline) params.set('inline', 'true');
    if (token) params.set('token', token);
    const qs = params.toString();
    return `${base}/files/${id}${qs ? `?${qs}` : ''}`;
  },
};

export interface AdminUser {
  id: string;
  fullName: string;
  role: import('../types').UserRole;
  username: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  phone: string | null;
  isActive: boolean;
  hasPassword: boolean;
  createdAt: string;
}

export const usersApi = {
  list: () => api.get<AdminUser[]>('/users').then((r) => r.data),

  linkMyTelegram: (telegramId: string) =>
    api.patch<{ ok: boolean; telegramId: string | null }>(
      '/users/me/telegram',
      { telegramId },
    ).then((r) => r.data),

  create: (body: {
    fullName: string;
    role: import('../types').UserRole;
    username?: string;
    password?: string;
    telegramId?: string;
    telegramUsername?: string;
    phone?: string;
  }) => api.post<AdminUser>('/users', body).then((r) => r.data),
  update: (id: string, body: Partial<{
    fullName: string;
    role: import('../types').UserRole;
    username: string;
    password: string;
    telegramId: string | null;
    telegramUsername: string | null;
    phone: string | null;
    isActive: boolean;
  }>) => api.patch<AdminUser>(`/users/${id}`, body).then((r) => r.data),
  setActive: (id: string, isActive: boolean) =>
    api.patch<AdminUser>(`/users/${id}/active/${isActive}`).then((r) => r.data),
};

export const stockApi = {
  list: (params: { search?: string; lowOnly?: boolean; all?: boolean } = {}) =>
    api.get<StockItem[]>('/stock', {
      params: {
        ...(params.search ? { search: params.search } : {}),
        ...(params.lowOnly ? { lowOnly: 'true' } : {}),
        ...(params.all ? { all: 'true' } : {}),
      },
    }).then((r) => r.data),

  stats: () => api.get<StockStats>('/stock/stats').then((r) => r.data),

  get: (id: string) => api.get<StockItemDetail>(`/stock/${id}`).then((r) => r.data),

  create: (body: {
    name: string;
    sku?: string;
    category?: string;
    unit?: string;
    initialQuantity?: number;
    minQuantity?: number;
    location?: string;
    notes?: string;
  }) => api.post<StockItem>('/stock', body).then((r) => r.data),

  update: (id: string, body: Partial<{
    name: string;
    sku: string;
    category: string;
    unit: string;
    minQuantity: number;
    location: string;
    notes: string;
    isActive: boolean;
  }>) => api.patch<StockItem>(`/stock/${id}`, body).then((r) => r.data),

  remove: (id: string) => api.delete<StockItem>(`/stock/${id}`).then((r) => r.data),

  createMovement: (id: string, body: {
    type: StockMovementType;
    quantity: number;
    comment?: string;
    orderId?: string;
  }) => api.post<{ item: StockItem; movement: StockMovement }>(
    `/stock/${id}/movements`, body,
  ).then((r) => r.data),

  downloadCsv: async () => {
    const res = await api.get('/stock/export.csv', { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  importCsv: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<{
      ok: boolean;
      created: number;
      updated: number;
      errors: Array<{ row: number; message: string }>;
      message?: string;
    }>('/stock/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};

export const messagesApi = {
  list: (orderId: string) =>
    api.get<OrderMessage[]>(`/orders/${orderId}/messages`).then((r) => r.data),

  create: (orderId: string, body: { text: string; fileId?: string }) =>
    api.post<OrderMessage>(`/orders/${orderId}/messages`, body).then((r) => r.data),

  remove: (orderId: string, messageId: string) =>
    api.delete<{ ok: boolean }>(`/orders/${orderId}/messages/${messageId}`).then((r) => r.data),
};

export const notificationsApi = {
  list: (unreadOnly = false) =>
    api.get<Notification[]>('/notifications', { params: unreadOnly ? { unread: 'true' } : {} })
      .then((r) => r.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
};
