// Mirrors the backend Order / Message shape (see backend/src/models/Order.js).

export type OrderStatus = "INQUIRY" | "CONFIRMED" | "CANCELLED";

export interface Message {
  sender: "customer" | "bot";
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
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  inquiry: number;
  confirmed: number;
  cancelled: number;
  total: number;
}
