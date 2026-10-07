import { Link, useSearchParams } from "react-router-dom";
import { currency } from "../lib/format";

export function VnpayReturnPage() {
  const [params] = useSearchParams();
  const orderId = params.get("orderId");
  const status = params.get("status");
  const transactionNo = params.get("transactionNo");
  const amountStr = params.get("amount");
  const amount = amountStr ? Number(amountStr) : null;
  const message = params.get("message");
  const isSuccess = status === "success";

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[#131110] border border-[#22201d] rounded-sm p-8 text-center shadow-xl">
        {isSuccess ? (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-600/50 flex items-center justify-center mx-auto mb-6 text-emerald-400">
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-[10px] tracking-[0.25em] text-[#c8a94d] uppercase font-mono mb-2">
              Cổng thanh toán VNPAY
            </div>
            <h1 className="font-display text-2xl text-[#ede7dc] font-semibold mb-2">
              Thanh toán thành công!
            </h1>
            <p className="text-xs text-[#7a6f64] mb-6">
              Đơn hàng của bạn đã được thanh toán và chuyển sang trạng thái xác nhận.
            </p>

            <div className="bg-[#1c1815] border border-[#2b2520] rounded-sm p-4 text-left space-y-2 mb-6 text-xs">
              {orderId && (
                <div className="flex justify-between">
                  <span className="text-[#7a6f64]">Mã đơn hàng:</span>
                  <span className="font-mono text-[#c8a94d] font-bold">#{orderId}</span>
                </div>
              )}
              {transactionNo && (
                <div className="flex justify-between">
                  <span className="text-[#7a6f64]">Mã giao dịch VNPay:</span>
                  <span className="font-mono text-[#ede7dc]">{transactionNo}</span>
                </div>
              )}
              {amount !== null && (
                <div className="flex justify-between border-t border-[#2b2520] pt-2">
                  <span className="text-[#7a6f64]">Số tiền thanh toán:</span>
                  <span className="font-mono text-[#c8a94d] font-semibold">{currency.format(amount)}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Link
                to="/orders"
                state={orderId ? { selectedOrderId: Number(orderId) } : undefined}
                className="block w-full py-3 bg-[#c8a94d] hover:bg-[#bfa145] text-[#0b0907] text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors"
              >
                Xem đơn hàng của bạn
              </Link>
              <Link
                to="/catalog"
                className="block w-full py-2.5 text-xs text-[#7a6f64] hover:text-[#ede7dc] transition-colors"
              >
                Tiếp tục mua sắm →
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-600/50 flex items-center justify-center mx-auto mb-6 text-red-400">
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="text-[10px] tracking-[0.25em] text-red-400 uppercase font-mono mb-2">
              Giao dịch chưa hoàn tất
            </div>
            <h1 className="font-display text-2xl text-[#ede7dc] font-semibold mb-2">
              Thanh toán không thành công
            </h1>
            <p className="text-xs text-[#7a6f64] mb-6">
              {message || "Giao dịch bị hủy hoặc xảy ra lỗi trong quá trình thanh toán qua VNPay."}
            </p>

            {orderId && (
              <div className="bg-[#1c1815] border border-[#2b2520] rounded-sm p-4 text-left text-xs mb-6">
                <div className="flex justify-between">
                  <span className="text-[#7a6f64]">Mã đơn hàng:</span>
                  <span className="font-mono text-[#c8a94d] font-bold">#{orderId}</span>
                </div>
                <div className="text-[11px] text-[#7a6f64] mt-1">
                  Đơn hàng vẫn được lưu lại. Bạn có thể thanh toán lại trong mục Đơn hàng.
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Link
                to="/orders"
                state={orderId ? { selectedOrderId: Number(orderId) } : undefined}
                className="block w-full py-3 bg-[#c8a94d] hover:bg-[#bfa145] text-[#0b0907] text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors"
              >
                Vào mục Đơn hàng để thử lại
              </Link>
              <Link
                to="/"
                className="block w-full py-2.5 text-xs text-[#7a6f64] hover:text-[#ede7dc] transition-colors"
              >
                Về trang chủ →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

