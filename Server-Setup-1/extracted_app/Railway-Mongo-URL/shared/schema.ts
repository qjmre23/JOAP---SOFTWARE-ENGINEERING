import { z } from "zod";

export const UserRole = { ADMIN: "ADMIN", EMPLOYEE: "EMPLOYEE" } as const;
export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export const OrderStatus = {
  PENDING_PAYMENT: "Pending Payment",
  PAID: "Paid",
  PENDING_RELEASE: "Pending Release",
  RELEASED: "Released",
  IN_TRANSIT: "In Transit",
  COMPLETED: "Completed",
} as const;
export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

export const InventoryLogType = {
  RESTOCK: "restock",
  DEDUCTION: "deduction",
  ADJUSTMENT: "adjustment",
} as const;

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "EMPLOYEE"]),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const createItemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  category: z.string().min(1, "Category is required"),
  supplierName: z.string().optional().default(""),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  currentQuantity: z.number().int().min(0, "Quantity must be non-negative"),
  reorderLevel: z.number().int().min(0, "Reorder level must be non-negative"),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const createOrderItemSchema = z.object({
  itemId: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
});

export const orderAddressSchema = z.object({
  street: z.string().optional().default(""),
  unitNumber: z.string().optional().default(""),
  city: z.string().optional().default(""),
  province: z.string().optional().default(""),
  zipCode: z.string().optional().default(""),
});

export const createOrderSchema = z.object({
  customerId: z.string().optional().default(""),
  customerName: z.string().min(1, "Customer name is required"),
  items: z.array(createOrderItemSchema).default([]),
  sourceChannel: z.enum(["phone", "email", "message", "walk-in"]).default("walk-in"),
  notes: z.string().optional().default(""),
  address: orderAddressSchema.optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const logPaymentSchema = z.object({
  orderId: z.string().min(1),
  paymentMethod: z.string().default("GCash"),
  gcashNumber: z.string().min(1, "GCash number is required"),
  gcashReferenceNumber: z.string().min(8, "Reference number must be at least 8 characters").max(20),
  amountPaid: z.number().min(0.01, "Amount must be greater than 0"),
  paymentDate: z.string().optional(),
  proofNote: z.string().optional().default(""),
});
export type LogPaymentInput = z.infer<typeof logPaymentSchema>;

export const inventoryLogSchema = z.object({
  itemId: z.string().min(1),
  type: z.enum(["restock", "deduction", "adjustment"]),
  quantity: z.number().int(),
  reason: z.string().optional().default(""),
});
export type InventoryLogInput = z.infer<typeof inventoryLogSchema>;

export const settingsSchema = z.object({
  companyName: z.string().optional(),
  theme: z.enum(["light", "dark"]).optional(),
  reorderThreshold: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  font: z.string().optional().default("Inter"),
  colorTheme: z.string().optional().default("blue"),
  gradient: z.string().optional().default("none"),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const ledgerEntrySchema = z.object({
  date: z.string(),
  accountName: z.string().min(1),
  debit: z.number().min(0),
  credit: z.number().min(0),
  description: z.string().optional().default(""),
  referenceType: z.string().optional().default(""),
  referenceId: z.string().optional().default(""),
});
export type LedgerEntryInput = z.infer<typeof ledgerEntrySchema>;

export interface IUser {
  _id: string;
  username: string;
  role: UserRoleType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string | null;
}

export interface IItem {
  _id: string;
  itemName: string;
  category: string;
  supplierName: string;
  unitPrice: number;
  currentQuantity: number;
  reorderLevel: number;
  barcode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICustomer {
  _id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface IOrderItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface IStatusEntry {
  status: OrderStatusType;
  timestamp: string;
  actor: string;
  note: string;
}

export interface IOrderAddress {
  street: string;
  unitNumber: string;
  city: string;
  province: string;
  zipCode: string;
}

export interface IOrder {
  _id: string;
  trackingNumber: string;
  customerId: string;
  customerName: string;
  items: IOrderItem[];
  totalAmount: number;
  sourceChannel: string;
  notes: string;
  currentStatus: OrderStatusType;
  statusHistory: IStatusEntry[];
  address?: IOrderAddress;
  createdAt: string;
  updatedAt: string;
}

export interface IBillingPayment {
  _id: string;
  orderId: string;
  paymentMethod: string;
  gcashNumber: string;
  gcashReferenceNumber: string;
  amountPaid: number;
  paymentDate: string;
  proofNote: string;
  loggedBy: string;
  createdAt: string;
}

export interface IInventoryLog {
  _id: string;
  itemId: string;
  itemName: string;
  type: string;
  quantity: number;
  reason: string;
  actor: string;
  createdAt: string;
}

export interface IAccountingAccount {
  _id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  balance: number;
}

export interface IGeneralLedgerEntry {
  _id: string;
  date: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
  referenceType: string;
  referenceId: string;
  isReversing: boolean;
  createdAt: string;
}

export interface ISystemLog {
  _id: string;
  action: string;
  actor: string;
  target: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface ISettings {
  _id: string;
  companyName: string;
  theme: string;
  reorderThreshold: number;
  lowStockThreshold: number;
  font: string;
  colorTheme: string;
  gradient: string;
}

export interface DashboardStats {
  totalOrdersToday: number;
  completedOrders: number;
  pendingPayments: number;
  pendingReleases: number;
  todayRevenue: number;
  totalRevenue: number;
  activeUsers: number;
  totalItems: number;
  criticalStock: number;
  lowStock: number;
  totalInventoryValue: number;
}
