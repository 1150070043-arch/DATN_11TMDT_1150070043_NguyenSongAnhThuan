export type DiscountRule = {
  type: "percent" | "fixed";
  value: number;
  maximumDiscount?: number | null;
  minimumOrder?: number;
};

export function calculateDiscount(subtotal: number, rule: DiscountRule): number {
  if (!Number.isFinite(subtotal) || subtotal < 0) throw new Error("Subtotal must be non-negative.");
  if (!Number.isFinite(rule.value) || rule.value <= 0) throw new Error("Discount value must be positive.");
  if (subtotal < (rule.minimumOrder ?? 0)) return 0;

  const raw = rule.type === "percent"
    ? subtotal * Math.min(rule.value, 100) / 100
    : rule.value;
  const capped = rule.maximumDiscount == null ? raw : Math.min(raw, rule.maximumDiscount);
  return Math.round(Math.min(subtotal, capped) * 100) / 100;
}
