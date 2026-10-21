export type SecurityMode = "baseline" | "secure";

export type User = {
  id: number;
  email: string;
  fullName: string;
  phone?: string | null;
  addressLine?: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  role: "admin" | "customer";
};

export type Category = {
  id: number;
  name: string;
  slug: string;
};

export type Review = {
  id: number;
  rating: number;
  content: string;
  createdAt: string;
  userId: number;
  userName: string;
};

export type Book = {
  id: number;
  title: string;
  slug: string;
  author: string;
  isbn?: string | null;
  description: string;
  price: number;
  stock: number;
  coverUrl?: string | null;
  categoryId: number;
  categoryName: string;
  isPublished?: boolean;
  isWishlisted?: boolean;
  wishlistedAt?: string;
  reviews?: Review[];
};

export type UserSession = {
  id: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  isCurrent: boolean;
  isActive: boolean;
};

export type CartItem = {
  id: number;
  quantity: number;
  bookId: number;
  title: string;
  slug: string;
  author: string;
  price: number;
  stock: number;
  coverUrl?: string | null;
  lineTotal: number;
};

export type Cart = {
  id: number;
  items: CartItem[];
  total: number;
};

export type OrderStatus = "pending" | "confirmed" | "shipping" | "completed" | "cancelled";
export type PaymentMethod = "cod" | "vnpay";
export type PaymentStatus = "unpaid" | "paid" | "failed" | "refund_pending" | "refunded";

export type Order = {
  id: number;
  userId?: number;
  status: OrderStatus;
  customerName: string;
  phone?: string;
  shippingAddress?: string;
  note?: string | null;
  totalAmount: number;
  subtotalAmount?: number;
  discountAmount?: number;
  couponCode?: string | null;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentTransactionId?: string | null;
  paymentPaidAt?: string | null;
  paymentUrl?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  items?: Array<{
    id: number;
    bookId: number;
    bookTitle: string;
    unitPrice: number;
    quantity: number;
  }>;
  statusHistory?: Array<{
    id: number;
    fromStatus?: OrderStatus | null;
    toStatus: OrderStatus;
    note?: string | null;
    createdAt: string;
    changedByName?: string | null;
  }>;
  emailNotifications?: Array<{
    id: number;
    recipientEmail: string;
    orderStatus: OrderStatus;
    deliveryState: "pending" | "processing" | "sent" | "failed";
    attemptCount: number;
    lastError?: string | null;
    createdAt: string;
    sentAt?: string | null;
  }>;
};
