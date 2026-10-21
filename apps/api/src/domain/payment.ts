export type PaymentOrder = {
  Status: string;
  PaymentMethod: string;
  PaymentStatus: string;
  PaymentUrl: string | null;
  TotalAmount: number;
};

export type PaymentAttempt = {
  Id: number;
  OrderId: number;
  TxnRef: string;
  Amount: number;
  State: string;
};

export function checkPaymentAttempt(order: PaymentOrder | undefined, attempt: PaymentAttempt | undefined,
  input: { orderId: number; txnRef: string; amount: number }): "00" | "01" | "02" | "04" {
  if (!order || !attempt || attempt.OrderId !== input.orderId || attempt.TxnRef !== input.txnRef) return "01";
  if (Math.round(Number(attempt.Amount) * 100) !== Math.round(input.amount * 100)) return "04";
  if (attempt.State === "paid" || attempt.State === "refunded") return "02";
  return "00";
}

export function paymentReviewReason(order: PaymentOrder, capturedAmount?: number): string | null {
  if (capturedAmount !== undefined && Math.round(Number(order.TotalAmount) * 100) !== Math.round(capturedAmount * 100)) return "Số tiền thu không khớp tổng đơn hiện tại; cần đối soát và hoàn tiền";
  if (["paid", "refund_pending", "refunded"].includes(order.PaymentStatus)) return "Đơn đã thu tiền qua giao dịch khác; cần hoàn khoản thu trùng";
  if (order.Status === "cancelled" || order.Status === "completed" || order.PaymentMethod !== "vnpay") return "Đơn đã kết thúc hoặc đổi phương thức; cần đối soát và hoàn tiền";
  return null;
}

export type PaymentResult = {
  orderId: number; txnRef: string; amount: number; isSuccess: boolean;
  responseCode: string; transactionNo: string;
};
