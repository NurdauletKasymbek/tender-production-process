export type UserRole =
  | 'ADMIN'
  | 'TENDER_DEPARTMENT'
  | 'DIRECTOR'
  | 'PRODUCTION_HEAD'
  | 'WORKSHOP_WORKER'
  | 'PACKAGING'
  | 'LOADING'
  | 'LOGISTICS';

export type OrderStatus =
  | 'NEW_TENDER'
  | 'REVIEW'
  | 'CONFIRMATION'
  | 'PRODUCTION'
  | 'PACKAGING'
  | 'LOADING'
  | 'LOGISTICS'
  | 'DELIVERY'
  | 'CLOSED'
  | 'REJECTED';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';

export interface User {
  id: string;
  telegramId: string;
  fullName: string;
  role: UserRole;
  phone?: string | null;
  isActive: boolean;
}

export interface Order {
  id: string;
  goszakupId?: string | null;
  tenderNumber: string;
  contractNumber?: string | null;
  customerName: string;
  customerBin?: string | null;
  productName: string;
  productDescription?: string | null;
  quantity: number;
  unit: string;
  totalAmount: string | number;
  currency: string;
  contractDate?: string | null;
  deadline: string;
  startedAt?: string | null;
  completedAt?: string | null;
  deliveryAddress?: string | null;
  deliveryContact?: string | null;
  status: OrderStatus;
  priority: number;
  responsibleId?: string | null;
  responsible?: { id: string; fullName: string; role: UserRole } | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  statusHistory?: OrderStatusHistoryItem[];
  productionTasks?: ProductionTask[];
  files?: OrderFile[];
}

export interface OrderStatusHistoryItem {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  comment?: string | null;
  createdAt: string;
  changedBy: { fullName: string; role: UserRole };
}

export interface ProductionTask {
  id: string;
  orderId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  assigneeId?: string | null;
  assignee?: { fullName: string } | null;
  startedAt?: string | null;
  completedAt?: string | null;
  deadline?: string | null;
  order?: { tenderNumber: string; productName: string; deadline: string };
}

export type FileType =
  | 'CONTRACT'
  | 'TECHNICAL_SPEC'
  | 'PRODUCTION_PHOTO'
  | 'PACKAGING_PHOTO'
  | 'LOADING_PHOTO'
  | 'DELIVERY_PHOTO'
  | 'INVOICE'
  | 'OTHER';

export interface OrderFile {
  id: string;
  orderId: string;
  fileName: string;
  fileType: FileType;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { fullName: string; role?: UserRole };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  orderId?: string | null;
  createdAt: string;
}

export interface DashboardStats {
  byStatus: { status: OrderStatus; count: number }[];
  overdueCount: number;
  activeCount: number;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
