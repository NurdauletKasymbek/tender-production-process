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
  | 'STORAGE'
  | 'LOADING'
  | 'LOGISTICS'
  | 'DELIVERY'
  | 'CLOSED'
  | 'REJECTED';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';

/** Орындау түрі — цех (өндіріс) немесе склад (дайын өнім) */
export type FulfillmentType = 'PRODUCTION' | 'STOCK';

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
  // Көлік ақпараты (логист толтырады LOADING → LOGISTICS өткенде)
  transportProvider?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  vehicleType?: string | null;
  vehiclePlate?: string | null;
  departedAt?: string | null;
  expectedArrival?: string | null;
  status: OrderStatus;
  priority: number;
  fulfillmentType: FulfillmentType;
  responsibleId?: string | null;
  responsible?: { id: string; fullName: string; role: UserRole } | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  statusHistory?: OrderStatusHistoryItem[];
  productionTasks?: ProductionTask[];
  files?: OrderFile[];

  // STOCK fulfillment байланысы (LOADING-те автоматты шегеру үшін)
  stockItemId?: string | null;
  stockQuantity?: string | number | null;
  stockDeductedAt?: string | null;
  stockItem?: {
    id: string;
    name: string;
    unit: string;
    quantity: string | number;
    sku?: string | null;
  } | null;
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

// ============== СКЛАД ==============

export type StockMovementType = 'IN' | 'OUT' | 'ADJUST';

export interface StockItem {
  id: string;
  sku?: string | null;
  name: string;
  category?: string | null;
  unit: string;
  quantity: string | number;        // Decimal (string)
  minQuantity?: string | number | null;
  location?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  stockItemId: string;
  type: StockMovementType;
  quantity: string | number;
  balanceAfter: string | number;
  comment?: string | null;
  orderId?: string | null;
  createdAt: string;
  createdBy?: { id: string; fullName: string; role: UserRole } | null;
  order?: { id: string; tenderNumber: string; productName: string } | null;
}

export interface StockItemDetail extends StockItem {
  movements: StockMovement[];
}

export interface StockStats {
  total: number;
  active: number;
  inactive: number;
  lowStockCount: number;
  lowStockItems: Array<{
    id: string;
    name: string;
    quantity: string | number;
    minQuantity: string | number;
    unit: string;
  }>;
}
