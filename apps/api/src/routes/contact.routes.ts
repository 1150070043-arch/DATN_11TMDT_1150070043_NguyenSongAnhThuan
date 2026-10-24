import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { getPool } from '../db/pool.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { sendMail, type MailContent } from '../lib/mailer.js';
import { setCsrfCookie } from '../security/csrf.js';

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  topic: z.enum(['books', 'orders', 'account', 'feedback']),
  message: z.string().trim().min(10).max(3000)
}).strict();
const subjects = { books: 'Tư vấn sách', orders: 'Đơn hàng', account: 'Tài khoản', feedback: 'Góp ý khác' };
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

type ContactDependencies = { recipient: () => Promise<string | undefined>; deliver: (content: MailContent) => Promise<void> };
const dependencies: ContactDependencies = {
  recipient: async () => {
    const pool = await getPool();
    const result = await pool.request().query<{ email: string }>(`SELECT TOP (1) u.Email AS email FROM dbo.Users u INNER JOIN dbo.Roles r ON r.Id = u.RoleId WHERE r.Name = N'admin' AND u.IsActive = 1 ORDER BY u.Id`);
    return result.recordset[0]?.email;
  },
  deliver: sendMail
};

export function createContactRouter(services: ContactDependencies = dependencies) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/csrf', (_req, res) => { res.json({ data: { csrfToken: setCsrfCookie(res) ?? null } }); });
  router.post('/', rateLimit({
    windowMs: 15 * 60 * 1000, limit: 3, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => { res.status(429).json({ error: { code: 'CONTACT_RATE_LIMITED', message: 'Bạn đã gửi nhiều lời nhắn. Vui lòng chờ một chút rồi thử lại.' } }); }
  }), asyncHandler(async (req, res) => {
    const body = contactSchema.parse(req.body);
    const recipient = await services.recipient();
    if (!recipient || !z.string().email().safeParse(recipient).success) throw new HttpError(503, 'Kênh liên hệ chưa sẵn sàng. Vui lòng quay lại sau.', 'CONTACT_UNAVAILABLE');
    const reference = `TT-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const topic = subjects[body.topic];
    try {
      await services.deliver({
        to: recipient, replyTo: body.email,
        subject: `[${reference}] ${topic} · Liên hệ Thất Tịnh`,
        text: `Mã tham chiếu: ${reference}\nChủ đề: ${topic}\nNgười gửi: ${body.name}\nEmail: ${body.email}\n\n${body.message}`,
        html: `<h1>Lời nhắn tới Thất Tịnh</h1><p><strong>Mã tham chiếu:</strong> ${reference}</p><p><strong>Chủ đề:</strong> ${topic}</p><p><strong>Người gửi:</strong> ${escape(body.name)} &lt;${escape(body.email)}&gt;</p><div style="white-space:pre-wrap">${escape(body.message)}</div>`
      });
    } catch {
      throw new HttpError(503, 'Chưa xác nhận được việc gửi lời nhắn. Nội dung của bạn vẫn được giữ để thử lại.', 'CONTACT_DELIVERY_FAILED');
    }
    res.status(201).json({ data: { reference } });
  }));
  return router;
}
export const contactRouter = createContactRouter();
