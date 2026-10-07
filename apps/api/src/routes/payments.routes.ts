import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { getPool, sql } from "../db/pool.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import { deliverOrderNotificationLater } from "../lib/order-notifications.js";
import { buildVnpayPaymentUrl, verifyVnpayReturn } from "../lib/vnpay.js";
import { ensureOwnerOrAdmin, requireAuth } from "../security/auth.js";

export const paymentsRouter = Router();

/**
 * VNPay Browser Return
 * When customer finishes or cancels payment on VNPay sandbox,
 * VNPay redirects browser to this GET endpoint with transaction query params.
 */
paymentsRouter.get(
  "/vnpay-return",
  asyncHandler(async (req, res) => {
    const query = req.query as Record<string, string>;
    const result = verifyVnpayReturn(query);
    const pool = await getPool();

    logger.info("vnpay_return_received", {
      orderId: result.orderId,
      responseCode: result.responseCode,
      isValid: result.isValid,
      isSuccess: result.isSuccess
    });

    if (result.isValid && result.isSuccess && result.orderId > 0) {
      let notificationId: number | undefined;
      const transaction = new sql.Transaction(pool);
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      try {
        const updateRes = await new sql.Request(transaction)
          .input("orderId", sql.Int, result.orderId)
          .input("txnNo", sql.NVarChar(100), result.transactionNo)
          .query<{ previousStatus: string; userId: number }>(`
            DECLARE @prev NVARCHAR(30), @uid INT;
            SELECT @prev = Status, @uid = UserId FROM dbo.Orders WHERE Id = @orderId;

            UPDATE dbo.Orders
            SET PaymentStatus = N'paid',
                Status = CASE WHEN Status = N'pending' THEN N'confirmed' ELSE Status END,
                PaymentTransactionId = @txnNo,
                PaymentPaidAt = SYSUTCDATETIME(),
                UpdatedAt = SYSUTCDATETIME()
            WHERE Id = @orderId;

            INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note)
            VALUES
              (@orderId, @prev, CASE WHEN @prev = N'pending' THEN N'confirmed' ELSE @prev END, NULL,
               N'Thanh toán VNPay thành công (Mã GD: ' + @txnNo + ')');

            SELECT @prev AS previousStatus, @uid AS userId;
          `);

        const info = updateRes.recordset[0];
        if (info && info.previousStatus === "pending") {
          const notif = await new sql.Request(transaction)
            .input("orderId", sql.Int, result.orderId)
            .query<{ id: number }>(`
              INSERT INTO dbo.OrderNotifications (OrderId, RecipientEmail, OrderStatus)
              OUTPUT INSERTED.Id AS id
              SELECT @orderId, Email, N'confirmed'
              FROM dbo.Users
              WHERE Id = (SELECT UserId FROM dbo.Orders WHERE Id = @orderId);
            `);
          notificationId = notif.recordset[0]?.id;
        }

        await transaction.commit();
        if (notificationId) {
          deliverOrderNotificationLater(notificationId);
        }
      } catch (err) {
        await transaction.rollback();
        logger.error("vnpay_return_db_error", { error: String(err) });
      }

      res.redirect(
        `${config.webOrigin}/payment/vnpay-return?orderId=${result.orderId}&status=success&transactionNo=${encodeURIComponent(result.transactionNo)}&amount=${result.amount}`
      );
      return;
    }

    // Payment failed, cancelled or invalid signature
    if (result.orderId > 0) {
      try {
        await pool.request()
          .input("orderId", sql.Int, result.orderId)
          .input("note", sql.NVarChar(500), `Thanh toán VNPay không thành công: ${result.message}`)
          .query(`
            UPDATE dbo.Orders
            SET PaymentStatus = CASE WHEN PaymentStatus != N'paid' THEN N'failed' ELSE PaymentStatus END,
                UpdatedAt = SYSUTCDATETIME()
            WHERE Id = @orderId;

            INSERT INTO dbo.OrderStatusHistory (OrderId, FromStatus, ToStatus, ChangedByUserId, Note)
            VALUES (@orderId, N'pending', N'pending', NULL, @note);
          `);
      } catch (err) {
        logger.error("vnpay_return_fail_update_error", { error: String(err) });
      }
    }

    res.redirect(
      `${config.webOrigin}/payment/vnpay-return?orderId=${result.orderId}&status=failed&message=${encodeURIComponent(result.message)}`
    );
  })
);

/**
 * Direct VNPay verification endpoint (optional API call)
 */
paymentsRouter.post(
  "/vnpay-verify",
  asyncHandler(async (req, res) => {
    const body = z.object({ query: z.record(z.string(), z.string()) }).parse(req.body);
    const result = verifyVnpayReturn(body.query);
    res.json({ data: result });
  })
);

/**
 * Generate VNPay payment URL for an existing unpaid order
 */
paymentsRouter.post(
  "/:orderId/pay",
  requireAuth,
  asyncHandler(async (req, res) => {
    const orderId = z.coerce.number().int().positive().parse(req.params.orderId);

    const pool = await getPool();
    const orderResult = await pool.request()
      .input("orderId", sql.Int, orderId)
      .query<{
        Id: number;
        UserId: number;
        Status: string;
        TotalAmount: number;
        PaymentStatus: string;
      }>(`
        SELECT Id, UserId, Status, TotalAmount, PaymentStatus
        FROM dbo.Orders
        WHERE Id = @orderId
      `);

    const order = orderResult.recordset[0];
    if (!order) {
      throw new HttpError(404, "Không tìm thấy đơn hàng.", "ORDER_NOT_FOUND");
    }
    ensureOwnerOrAdmin(req, order.UserId);

    if (order.PaymentStatus === "paid") {
      throw new HttpError(409, "Đơn hàng này đã được thanh toán.", "ORDER_ALREADY_PAID");
    }
    if (order.Status === "cancelled") {
      throw new HttpError(409, "Đơn hàng này đã bị hủy, không thể thanh toán.", "ORDER_CANCELLED");
    }

    const returnUrl = `${req.protocol}://${req.get("host")}/api/payments/vnpay-return`;
    const paymentUrl = buildVnpayPaymentUrl({
      orderId: order.Id,
      amount: Number(order.TotalAmount),
      ipAddress: req.ip || "127.0.0.1",
      returnUrl,
      orderInfo: `Thanh toan don hang #${order.Id}`
    });

    await pool.request()
      .input("orderId", sql.Int, order.Id)
      .input("paymentMethod", sql.NVarChar(20), "vnpay")
      .input("paymentUrl", sql.NVarChar(1000), paymentUrl)
      .query(`
        UPDATE dbo.Orders
        SET PaymentMethod = @paymentMethod, PaymentUrl = @paymentUrl, UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @orderId
      `);

    res.json({
      data: {
        orderId: order.Id,
        paymentMethod: "vnpay",
        paymentUrl
      }
    });
  })
);
