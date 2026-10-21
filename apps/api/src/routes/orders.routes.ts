import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { getPool, sql } from "../db/pool.js";
import { calculateDiscount } from "../domain/discount.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { deliverOrderNotificationLater } from "../lib/order-notifications.js";
import { queueCancelledPaymentReview, savePaymentAttempt } from "../lib/payment-attempts.js";
import { buildVnpayPaymentUrl } from "../lib/vnpay.js";
import { initializeStockHold } from "../lib/stock-holds.js";
import { releaseOrderReservation } from "../lib/order-reservation.js";
import { ensureOwnerOrAdmin, requireAuth } from "../security/auth.js";

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(160),
  phone: z.string().trim().regex(/^[0-9+(). -]{8,20}$/),
  shippingAddress: z.string().trim().min(8).max(500),
  note: z.string().trim().max(1000).optional().default(""),
  couponCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/).optional(),
  paymentMethod: z.enum(["cod", "vnpay"]).default("cod")
});

const idempotencyKeySchema = z.string().uuid();

type CheckoutItem = {
  BookId: number;
  Title: string;
  Price: number;
  Stock: number;
  Quantity: number;
};

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

// A preview never reserves a coupon use. Checkout validates again inside its transaction.
ordersRouter.post("/quote", asyncHandler(async (req, res) => {
  const { couponCode } = checkoutSchema.pick({ couponCode: true }).parse(req.body);
  const pool = await getPool();
  const cart = await pool.request().input("userId", sql.Int, req.authUser!.id).query<CheckoutItem>(`
    SELECT b.Id AS BookId, b.Title, b.Price, b.Stock, ci.Quantity
    FROM dbo.Carts c
    INNER JOIN dbo.CartItems ci ON ci.CartId = c.Id
    INNER JOIN dbo.Books b ON b.Id = ci.BookId
    WHERE c.UserId = @userId AND b.IsPublished = 1;
  `);
  if (!cart.recordset.length) throw new HttpError(409, "Giỏ hàng đang trống.", "EMPTY_CART");
  const subtotal = cart.recordset.reduce((sum, item) => sum + Number(item.Price) * item.Quantity, 0);
  let discount = 0;
  if (couponCode) {
    const result = await pool.request().input("code", sql.NVarChar(40), couponCode).query<{
      DiscountType: "percent" | "fixed"; DiscountValue: number; MinimumOrder: number; MaximumDiscount: number | null;
    }>(`
      SELECT DiscountType, DiscountValue, MinimumOrder, MaximumDiscount FROM dbo.Coupons
      WHERE Code = @code AND IsActive = 1
        AND StartsAt <= SYSUTCDATETIME() AND EndsAt > SYSUTCDATETIME()
        AND (UsageLimit IS NULL OR UsedCount < UsageLimit);
    `);
    const coupon = result.recordset[0];
    if (!coupon) throw new HttpError(422, "Mã ưu đãi không hợp lệ hoặc đã hết hạn.", "COUPON_INVALID");
    discount = calculateDiscount(subtotal, { type: coupon.DiscountType, value: Number(coupon.DiscountValue), minimumOrder: Number(coupon.MinimumOrder), maximumDiscount: coupon.MaximumDiscount == null ? null : Number(coupon.MaximumDiscount) });
    if (!discount) throw new HttpError(422, "Đơn hàng chưa đạt giá trị tối thiểu của mã ưu đãi.", "COUPON_MINIMUM_NOT_MET");
  }
  res.json({ data: { subtotal, discount, total: subtotal - discount, couponCode } });
}));

ordersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = checkoutSchema.parse(req.body);
    const rawIdempotencyKey = req.header("idempotency-key");
    if (config.isSecure && !rawIdempotencyKey) {
      throw new HttpError(
        422,
        "Yêu cầu đặt hàng thiếu mã chống gửi trùng. Vui lòng tải lại trang và thử lại.",
        "IDEMPOTENCY_KEY_REQUIRED"
      );
    }
    const idempotencyKey = rawIdempotencyKey
      ? idempotencyKeySchema.parse(rawIdempotencyKey)
      : null;
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    let notificationId: number | undefined;

    try {
      if (idempotencyKey) {
        const existing = await new sql.Request(transaction)
          .input("userId", sql.Int, req.authUser!.id)
          .input("idempotencyKey", sql.UniqueIdentifier, idempotencyKey)
          .query<{
            Id: number;
            TotalAmount: number;
            Status: string;
            PaymentMethod: string;
            PaymentStatus: string;
            PaymentUrl: string | null;
          }>(`
            SELECT Id, TotalAmount, Status, PaymentMethod, PaymentStatus, PaymentUrl
            FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK)
            WHERE UserId = @userId AND IdempotencyKey = @idempotencyKey
          `);
        const previousOrder = existing.recordset[0];
        if (previousOrder) {
          await transaction.commit();
          res.setHeader("Idempotency-Replayed", "true");
          res.json({
            data: {
              id: previousOrder.Id,
              total: Number(previousOrder.TotalAmount),
              status: previousOrder.Status,
              paymentMethod: previousOrder.PaymentMethod,
              paymentStatus: previousOrder.PaymentStatus,
              paymentUrl: previousOrder.PaymentUrl,
              replayed: true
            }
          });
          return;
        }
      }

      const itemsResult = await new sql.Request(transaction)
        .input("userId", sql.Int, req.authUser!.id)
        .query<CheckoutItem>(`
          SELECT
            b.Id AS BookId, b.Title, b.Price, b.Stock, ci.Quantity
          FROM dbo.Carts c
          INNER JOIN dbo.CartItems ci ON ci.CartId = c.Id
          INNER JOIN dbo.Books b WITH (UPDLOCK, HOLDLOCK) ON b.Id = ci.BookId
          WHERE c.UserId = @userId AND b.IsPublished = 1
        `);
      const items = itemsResult.recordset;
      if (items.length === 0) {
        throw new HttpError(409, "Giỏ hàng đang trống.", "EMPTY_CART");
      }
      const unavailable = items.find((item) => item.Quantity > item.Stock);
      if (unavailable) {
        throw new HttpError(409, `Sách “${unavailable.Title}” không còn đủ số lượng.`, "INSUFFICIENT_STOCK");
      }

      const subtotal = items.reduce(
        (sum, item) => sum + Number(item.Price) * item.Quantity,
        0
      );
      let coupon: { Id: number; Code: string; DiscountType: "percent" | "fixed"; DiscountValue: number; MinimumOrder: number; MaximumDiscount: number | null } | undefined;
      let discount = 0;
      if (body.couponCode) {
        const couponResult = await new sql.Request(transaction)
          .input("code", sql.NVarChar(40), body.couponCode)
          .query<typeof coupon>(`
            SELECT Id, Code, DiscountType, DiscountValue, MinimumOrder, MaximumDiscount
            FROM dbo.Coupons WITH (UPDLOCK, HOLDLOCK)
            WHERE Code = @code AND IsActive = 1
              AND StartsAt <= SYSUTCDATETIME() AND EndsAt > SYSUTCDATETIME()
              AND (UsageLimit IS NULL OR UsedCount < UsageLimit)
          `);
        coupon = couponResult.recordset[0];
        if (!coupon) throw new HttpError(422, "Mã ưu đãi không hợp lệ hoặc đã hết hạn.", "COUPON_INVALID");
        discount = calculateDiscount(subtotal, {
          type: coupon.DiscountType,
          value: Number(coupon.DiscountValue),
          minimumOrder: Number(coupon.MinimumOrder),
          maximumDiscount: coupon.MaximumDiscount == null ? null : Number(coupon.MaximumDiscount)
        });
        if (discount === 0) throw new HttpError(422, "Đơn hàng chưa đạt giá trị tối thiểu của mã ưu đãi.", "COUPON_MINIMUM_NOT_MET");
      }
      const total = subtotal - discount;
      const orderResult = await new sql.Request(transaction)
        .input("userId", sql.Int, req.authUser!.id)
        .input("customerName", sql.NVarChar(160), body.customerName)
        .input("phone", sql.NVarChar(30), body.phone)
        .input("address", sql.NVarChar(500), body.shippingAddress)
        .input("note", sql.NVarChar(1000), body.note || null)
        .input("subtotal", sql.Decimal(18, 2), subtotal)
        .input("discount", sql.Decimal(18, 2), discount)
        .input("couponCode", sql.NVarChar(40), coupon?.Code ?? null)
        .input("total", sql.Decimal(18, 2), total)
        .input("paymentMethod", sql.NVarChar(20), body.paymentMethod)
        .input("paymentStatus", sql.NVarChar(20), "unpaid")
        .input("idempotencyKey", sql.UniqueIdentifier, idempotencyKey)
        .query<{ Id: number }>(`
          INSERT INTO dbo.Orders
            (UserId, Status, CustomerName, Phone, ShippingAddress, Note, SubtotalAmount, DiscountAmount, CouponCode, TotalAmount, PaymentMethod, PaymentStatus, IdempotencyKey)
          OUTPUT INSERTED.Id
          VALUES
            (@userId, N'pending', @customerName, @phone, @address, @note, @subtotal, @discount, @couponCode, @total, @paymentMethod, @paymentStatus, @idempotencyKey)
        `);
      const orderId = orderResult.recordset[0]?.Id;
      if (!orderId) throw new Error("Không thể tạo đơn hàng.");

      if (coupon) {
        await new sql.Request(transaction)
          .input("couponId", sql.Int, coupon.Id)
          .input("userId", sql.Int, req.authUser!.id)
          .input("orderId", sql.Int, orderId)
          .input("discount", sql.Decimal(18, 2), discount)
          .query(`
            UPDATE dbo.Coupons SET UsedCount = UsedCount + 1, UpdatedAt = SYSUTCDATETIME() WHERE Id = @couponId;
            INSERT INTO dbo.CouponRedemptions (CouponId, UserId, OrderId, DiscountAmount)
            VALUES (@couponId, @userId, @orderId, @discount);
          `);
      }

      for (const item of items) {
        await new sql.Request(transaction)
          .input("orderId", sql.Int, orderId)
          .input("bookId", sql.Int, item.BookId)
          .input("title", sql.NVarChar(255), item.Title)
          .input("price", sql.Decimal(18, 2), item.Price)
          .input("quantity", sql.Int, item.Quantity)
          .query(`
            INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (@orderId, @bookId, @title, @price, @quantity);

            UPDATE dbo.Books
            SET Stock = Stock - @quantity, UpdatedAt = SYSUTCDATETIME()
            WHERE Id = @bookId;

            INSERT INTO dbo.InventoryMovements
              (BookId, MovementType, QuantityDelta, BalanceAfter, ReferenceType, ReferenceId, Note, ChangedByUserId)
            SELECT
              @bookId, N'sale', -@quantity, Stock, N'order', @orderId,
              N'Xuất kho khi khách hàng đặt đơn', NULL
            FROM dbo.Books
            WHERE Id = @bookId;
          `);
      }

      await new sql.Request(transaction)
        .input("userId", sql.Int, req.authUser!.id)
        .input("orderId", sql.Int, orderId)
        .query(`
          INSERT INTO dbo.OrderStatusHistory
            (OrderId, FromStatus, ToStatus, ChangedByUserId, Note)
          VALUES
            (@orderId, NULL, N'pending', @userId, N'Khách hàng tạo đơn');

          DELETE ci
          FROM dbo.CartItems ci
          INNER JOIN dbo.Carts c ON c.Id = ci.CartId
          WHERE c.UserId = @userId
        `);

      let paymentUrl: string | null = null;

      if (body.paymentMethod === "vnpay") {
        const hold = await initializeStockHold(transaction, orderId);
        const returnUrl = config.vnpay.returnUrl ?? `${req.protocol}://${req.get("host")}/api/payments/vnpay-return`;
        paymentUrl = buildVnpayPaymentUrl({
          orderId,
          amount: total,
          ipAddress: req.ip || "127.0.0.1",
          returnUrl,
          expiresAt: hold.StockHoldUntil,
          orderInfo: `Thanh toan don hang #${orderId}`
        });
      }

      if (paymentUrl) {
        await savePaymentAttempt(transaction, orderId, total, paymentUrl);
      }

      const notification = await new sql.Request(transaction)
        .input("orderId", sql.Int, orderId)
        .input("userId", sql.Int, req.authUser!.id)
        .query<{ id: number }>(`
          INSERT INTO dbo.OrderNotifications (OrderId, RecipientEmail, OrderStatus)
          OUTPUT INSERTED.Id AS id
          SELECT @orderId, Email, N'pending'
          FROM dbo.Users
          WHERE Id = @userId;
        `);
      notificationId = notification.recordset[0]?.id;
      await transaction.commit();
      deliverOrderNotificationLater(notificationId);
      res.status(201).json({
        data: {
          id: orderId,
          subtotal,
          discount,
          total,
          couponCode: coupon?.Code ?? null,
          status: "pending",
          paymentMethod: body.paymentMethod,
          paymentStatus: "unpaid",
          paymentUrl,
          replayed: false
        }
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  })
);

ordersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("userId", sql.Int, req.authUser!.id)
      .query(`
        SELECT
          Id AS id, Status AS status, CustomerName AS customerName,
          TotalAmount AS totalAmount,
          PaymentMethod AS paymentMethod, PaymentStatus AS paymentStatus,
          PaymentUrl AS paymentUrl, StockHoldUntil AS stockHoldUntil, StockReleaseAfter AS stockReleaseAfter, StockExpiredAt AS stockExpiredAt,
          CreatedAt AS createdAt, UpdatedAt AS updatedAt
        FROM dbo.Orders
        WHERE UserId = @userId
        ORDER BY CreatedAt DESC
      `);
    res.json({ data: result.recordset });
  })
);

ordersRouter.get(
  "/:orderId/invoice.csv",
  asyncHandler(async (req, res) => {
    const orderId = z.coerce.number().int().positive().parse(req.params.orderId);
    const pool = await getPool();
    const result = await pool.request()
      .input("orderId", sql.Int, orderId)
      .input("userId", sql.Int, req.authUser!.id)
      .query(`
        SELECT Id, CustomerName, Phone, ShippingAddress, SubtotalAmount, DiscountAmount, CouponCode, TotalAmount, PaymentMethod, PaymentStatus, CreatedAt
        FROM dbo.Orders WHERE Id = @orderId AND (UserId = @userId OR @userId IN (SELECT u.Id FROM dbo.Users u INNER JOIN dbo.Roles r ON r.Id = u.RoleId WHERE r.Name = N'admin'));
        SELECT BookTitle, UnitPrice, Quantity FROM dbo.OrderItems WHERE OrderId = @orderId ORDER BY Id;
      `);
    const sets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>;
    const order = sets[0]?.[0];
    if (!order) throw new HttpError(404, "Không tìm thấy đơn hàng.", "ORDER_NOT_FOUND");
    const csvCell = (value: unknown) => {
      let text = String(value ?? "");
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const lines = [
      ["HÓA ĐƠN BOOKGUARD", `#${order.Id}`],
      ["Ngày đặt", new Date(String(order.CreatedAt)).toISOString()],
      ["Người nhận", order.CustomerName], ["Điện thoại", order.Phone], ["Địa chỉ", order.ShippingAddress],
      ["Phương thức thanh toán", order.PaymentMethod], ["Trạng thái thanh toán", order.PaymentStatus],
      [], ["Sách", "Đơn giá", "Số lượng", "Thành tiền"],
      ...(sets[1] ?? []).map((item) => [item.BookTitle, item.UnitPrice, item.Quantity, Number(item.UnitPrice) * Number(item.Quantity)]),
      [], ["Tạm tính", order.SubtotalAmount], ["Mã ưu đãi", order.CouponCode], ["Giảm giá", order.DiscountAmount], ["Tổng cộng", order.TotalAmount]
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=bookguard-order-${orderId}.csv`);
    res.send(`\uFEFF${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}`);
  })
);

ordersRouter.get(
  "/:orderId",
  asyncHandler(async (req, res) => {
    const orderId = z.coerce.number().int().positive().parse(req.params.orderId);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("orderId", sql.Int, orderId)
      .query(`
        SELECT
          o.Id AS id, o.UserId AS userId, o.Status AS status,
          o.CustomerName AS customerName, o.Phone AS phone,
          o.ShippingAddress AS shippingAddress, o.Note AS note,
          o.SubtotalAmount AS subtotalAmount, o.DiscountAmount AS discountAmount,
          o.CouponCode AS couponCode, o.TotalAmount AS totalAmount,
          o.PaymentMethod AS paymentMethod, o.PaymentStatus AS paymentStatus,
          o.PaymentTransactionId AS paymentTransactionId, o.PaymentPaidAt AS paymentPaidAt,
          o.PaymentUrl AS paymentUrl, o.StockHoldUntil AS stockHoldUntil, o.StockReleaseAfter AS stockReleaseAfter, o.StockExpiredAt AS stockExpiredAt,
          o.CreatedAt AS createdAt
        FROM dbo.Orders o
        WHERE o.Id = @orderId;

        SELECT
          Id AS id, BookId AS bookId, BookTitle AS bookTitle,
          UnitPrice AS unitPrice, Quantity AS quantity
        FROM dbo.OrderItems
        WHERE OrderId = @orderId
        ORDER BY Id;

        SELECT
          h.Id AS id, h.FromStatus AS fromStatus, h.ToStatus AS toStatus,
          h.Note AS note, h.CreatedAt AS createdAt,
          u.FullName AS changedByName
        FROM dbo.OrderStatusHistory h
        LEFT JOIN dbo.Users u ON u.Id = h.ChangedByUserId
        WHERE h.OrderId = @orderId
        ORDER BY h.CreatedAt ASC, h.Id ASC
      `);
    const sets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>;
    const order = sets[0]?.[0];
    if (!order) throw new HttpError(404, "Không tìm thấy đơn hàng.", "ORDER_NOT_FOUND");

    // SECURITY LAB: Baseline intentionally omits ownership checking for TC07.
    ensureOwnerOrAdmin(req, Number(order.userId));
    res.json({ data: { ...order, items: sets[1] ?? [], statusHistory: sets[2] ?? [] } });
  })
);

ordersRouter.patch(
  "/:orderId/cancel",
  asyncHandler(async (req, res) => {
    const orderId = z.coerce.number().int().positive().parse(req.params.orderId);
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    let notificationId: number | undefined;
    try {
      const order = await new sql.Request(transaction)
        .input("orderId", sql.Int, orderId)
        .input("userId", sql.Int, req.authUser!.id)
        .query<{ Id: number; Status: string }>(`
          SELECT Id, Status
          FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK)
          WHERE Id = @orderId AND UserId = @userId
        `);
      const currentOrder = order.recordset[0];
      if (!currentOrder) {
        throw new HttpError(404, "Không tìm thấy đơn hàng.", "ORDER_NOT_FOUND");
      }
      if (currentOrder.Status !== "pending") {
        throw new HttpError(409, "Không thể hủy đơn hàng này.", "ORDER_CANNOT_CANCEL");
      }
      await queueCancelledPaymentReview(transaction, orderId);
      await releaseOrderReservation(transaction, orderId, "Hoàn kho khi khách hàng hủy đơn", req.authUser!.id);

      const updated = await new sql.Request(transaction)
        .input("orderId", sql.Int, orderId)
        .input("userId", sql.Int, req.authUser!.id)
        .query<{ notificationId: number }>(`
          UPDATE dbo.Orders
          SET Status = N'cancelled', UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @orderId;

          INSERT INTO dbo.OrderStatusHistory
            (OrderId, FromStatus, ToStatus, ChangedByUserId, Note)
          VALUES
            (@orderId, N'pending', N'cancelled', @userId, N'Khách hàng hủy đơn');

          INSERT INTO dbo.OrderNotifications (OrderId, RecipientEmail, OrderStatus)
          OUTPUT INSERTED.Id AS notificationId
          SELECT @orderId, Email, N'cancelled'
          FROM dbo.Users
          WHERE Id = @userId;
        `);
      notificationId = updated.recordset[0]?.notificationId;
      await transaction.commit();
      deliverOrderNotificationLater(notificationId);
      res.json({ data: { id: orderId, status: "cancelled" } });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  })
);
