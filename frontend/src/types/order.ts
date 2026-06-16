// Mirrors the backend Order / Message shape (see backend/src/models/Order.js).

export type OrderStatus =
  | "INQUIRY"
  | "CONFIRMED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

export interface Message {
  sender: "customer" | "bot" | "agent";
  messageType: "text" | "voice";
  message: string;
  createdAt: string;
}

export interface Order {
  _id: string;
  phoneNumber: string;
  customerName: string;
  email: string;
  address: string;
  product: string;
  size: string;
  color: string;
  quantity: string;
  status: OrderStatus;
  summary: string;
  autoReplyEnabled: boolean;
  unreadCount: number;
  isReturningCustomer: boolean;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  inquiry: number;
  confirmed: number;
  delivered: number;
  completed: number;
  cancelled: number;
  reorders: number;
  total: number;
}

export interface ReorderCustomer {
  phoneNumber: string;
  customerName: string;
  completedCount: number;
  lastOrderDate: string;
}
