export const orderStatuses = [
  "pending",
  "confirmed",
  "shipping",
  "completed",
  "cancelled"
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

const allowedTransitions: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  pending: new Set(["confirmed", "cancelled"]),
  confirmed: new Set(["shipping", "cancelled"]),
  shipping: new Set(["completed"]),
  completed: new Set(),
  cancelled: new Set()
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return from === to || allowedTransitions[from].has(to);
}
