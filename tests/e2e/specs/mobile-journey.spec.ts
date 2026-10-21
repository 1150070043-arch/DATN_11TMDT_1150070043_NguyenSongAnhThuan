import { expect, test, type Page } from '@playwright/test';

const book = { id: 1, title: 'Clean Code', author: 'Robert Martin', slug: 'clean-code', categoryId: 1, categoryName: 'Công nghệ', price: 150000, stock: 5, description: 'Sách lập trình', isbn: '1', coverUrl: '' };
const user = { id: 1, email: 'customer@example.test', fullName: 'Nguyễn Văn An', role: 'customer', emailVerified: true, phone: '0912345678', addressLine: '123 Nguyễn Trãi, phường Thanh Xuân, Hà Nội' };
const cart = { id: 1, total: 150000, items: [{ ...book, id: 10, bookId: 1, quantity: 1, lineTotal: 150000 }] };
const order = { id: 12, status: 'pending', paymentStatus: 'unpaid', paymentMethod: 'vnpay', customerName: user.fullName, phone: user.phone, shippingAddress: user.addressLine, totalAmount: 150000, createdAt: '2026-10-12T00:00:00Z', items: [{ id: 1, bookId: 1, bookTitle: book.title, unitPrice: 150000, quantity: 1 }], events: [] };
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = []; pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  // Every API request is intercepted; these tests never mutate a SQL database.
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data = path === '/api/auth/me' ? user : path === '/api/auth/csrf' ? { csrfToken: 'fixture' }
      : path === '/api/books/categories' ? [{ id: 1, name: 'Công nghệ', slug: 'cong-nghe' }]
      : path === '/api/books' ? [book] : path === '/api/cart' ? cart
      : path === '/api/payments/methods' ? { vnpay: true }
      : path === '/api/orders' ? [order] : path === '/api/orders/12' ? order
      : path === '/api/books/clean-code' ? book : [];
    return route.fulfill({ json: { data, meta: { total: 1 } } });
  });
});
test.afterEach(({ page }) => { expect(pageErrors.get(page)).toEqual([]); });

async function noOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test('full address, autofill and keyboard next do not silently submit or append a city', async ({ page }, testInfo) => {
  const requests: Record<string, string>[] = [];
  await page.route('**/api/orders', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { data: { id: 12 } } });
  });
  await page.goto('/checkout');
  const name = page.getByLabel('Họ và tên', { exact: true });
  const phone = page.getByLabel('Số điện thoại', { exact: true });
  const address = page.getByLabel('Địa chỉ', { exact: true });
  await expect(address).toHaveValue(user.addressLine);
  await expect(address).toHaveAttribute('autocomplete', 'street-address');
  await expect(phone).toHaveAttribute('inputmode', 'tel');
  await name.press('Enter'); await expect(phone).toBeFocused();
  await phone.press('Enter'); await expect(address).toBeFocused();
  expect(requests).toHaveLength(0);
  await address.fill('  42 đường Trần Phú, phường Hải Châu, Đà Nẵng  ');
  if (testInfo.project.name !== 'firefox-keyboard') {
    await expect(name).toHaveCSS('font-size', '16px');
    await expect(page.getByLabel('Mã ưu đãi')).toHaveCSS('font-size', '16px');
  }
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('checkout.png'), fullPage: true });
  await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click();
  await expect(page).toHaveURL(/\/confirmation\/12$/);
  expect(requests).toHaveLength(1);
  expect(requests[0].shippingAddress).toBe('42 đường Trần Phú, phường Hải Châu, Đà Nẵng');
});

test('invalid checkout focuses the first error and preserves the address', async ({ page }) => {
  await page.goto('/checkout');
  await page.getByLabel('Họ và tên', { exact: true }).fill('A');
  await page.getByLabel('Số điện thoại', { exact: true }).fill('abc');
  await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click();
  await expect(page.getByLabel('Họ và tên', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Địa chỉ', { exact: true })).toHaveValue(user.addressLine);
  await page.getByLabel('Họ và tên', { exact: true }).fill(user.fullName);
  await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click();
  await expect(page.getByLabel('Số điện thoại', { exact: true })).toBeFocused();
  await expect(page.getByRole('alert')).toContainText('Số điện thoại');
});

test('lost checkout response has persistent recovery and reuses the exact request once', async ({ page }) => {
  const requests: { key?: string; body: string | null }[] = [];
  let retryStarted = false;
  let release!: () => void;
  const released = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/orders', async route => {
    requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    if (requests.length === 1) return route.abort('internetdisconnected');
    retryStarted = true; await released;
    await route.fulfill({ json: { data: { id: 12, replayed: true } } });
  });
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa xác nhận được đơn');
  await expect(page.getByLabel('Địa chỉ', { exact: true })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Xem đơn hàng của tôi' })).toBeVisible();
  await noOverflow(page);
  const retry = page.getByRole('button', { name: 'Thử lại đặt hàng', exact: true });
  await retry.click();
  await expect.poll(() => retryStarted).toBe(true);
  await expect(page.getByRole('button', { name: 'Đang xử lý...' })).toBeDisabled();
  await page.locator('form').evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[0].key).toMatch(/^[0-9a-f-]{36}$/);
  release();
  await expect(page).toHaveURL(/\/confirmation\/12$/);
});

test('rejected checkout remains editable and exposes the server error', async ({ page }) => {
  await page.route('**/api/orders', route => route.fulfill({ status: 422, json: { error: { message: 'Sách vừa hết hàng, vui lòng cập nhật giỏ.' } } }));
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Sách vừa hết hàng');
  await expect(page.getByLabel('Địa chỉ', { exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Đặt hàng', exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/\/checkout$/);
});

test('cart touch targets and an unknown quantity result require a read before editing again', async ({ page }, testInfo) => {
  await page.route('**/api/cart/items/10', route => route.abort('internetdisconnected'));
  await page.goto('/cart');
  const increase = page.getByRole('button', { name: 'Tăng số lượng Clean Code' });
  for (const control of [increase, page.getByRole('button', { name: 'Giảm số lượng Clean Code' }), page.getByRole('button', { name: 'Xóa Clean Code khỏi giỏ' })]) {
    const box = await control.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await increase.click();
  await expect(page.getByRole('alert')).toContainText('Không thể kết nối');
  await expect(increase).toBeDisabled();
  await page.getByRole('button', { name: 'Tải lại giỏ', exact: true }).click();
  await expect(increase).toBeEnabled();
  await expect(page.locator('.reference-cart-row').getByText('1', { exact: true })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('cart-recovery.png'), fullPage: true });
});

test('confirmed add with a failed cart read recovers on mobile without repeating the addition', async ({ page }, testInfo) => {
  let failed = false; let additions = 0;
  await page.route('**/api/cart', route => route.fulfill({ status: failed ? 503 : 200, json: failed ? { error: { message: 'Máy chủ đang bận' } } : { data: { ...cart, items: [{ ...cart.items[0], quantity: additions ? 2 : 1 }] } } }));
  await page.route('**/api/cart/items', route => { additions++; failed = true; return route.fulfill({ json: { data: { quantity: 2 } } }); });
  await page.goto('/catalog');
  const add = page.getByRole('button', { name: 'Thêm Clean Code vào giỏ' });
  await add.click();
  await expect(page.getByRole('status', { name: 'Đồng bộ giỏ hàng' })).toContainText('Đã thêm sách');
  await expect(add).toBeDisabled();
  await page.getByRole('link', { name: 'Xem giỏ hàng' }).click();
  await expect(page.getByRole('heading', { name: '1 sản phẩm', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tiến hành thanh toán' })).toBeDisabled();
  const retry = page.getByRole('button', { name: 'Tải lại giỏ', exact: true });
  const box = await retry.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44);
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('cart-sync-notice.png'), fullPage: true });
  failed = false;
  await retry.focus(); await retry.press('Enter');
  await expect(page.getByRole('heading', { name: '2 sản phẩm', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Đồng bộ giỏ hàng' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tiến hành thanh toán' })).toBeEnabled();
  expect(additions).toBe(1);
});

test('unavailable stock explains how to continue instead of only disabling checkout', async ({ page }) => {
  await page.route('**/api/cart', route => route.fulfill({ json: { data: { ...cart, items: [{ ...cart.items[0], stock: 0 }] } } }));
  await page.goto('/cart');
  await expect(page.getByRole('alert')).toContainText('Giảm số lượng hoặc xóa sách hết hàng');
  await expect(page.getByRole('button', { name: 'Tiến hành thanh toán' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Xóa Clean Code khỏi giỏ' })).toBeEnabled();
});

test('payment choices support keyboard focus and unavailable VNPAY can be retried', async ({ page }) => {
  await page.route('**/api/payments/methods', route => route.fulfill({ status: 503, json: { error: { message: 'Bảo trì' } } }));
  await page.goto('/checkout');
  await expect(page.getByRole('status')).toContainText('Bạn vẫn có thể chọn trả khi nhận hàng');
  await page.route('**/api/payments/methods', route => route.fulfill({ json: { data: { vnpay: true } } }));
  await page.getByRole('button', { name: 'Thử tải VNPAY' }).click();
  const cod = page.locator('input[value="cod"]');
  await cod.focus();
  await expect(page.locator('.payment-option').first()).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('input[value="vnpay"]')).toBeChecked();
  await noOverflow(page);
});

test('VNPAY redirect uses one checkout and a mocked provider destination', async ({ page }) => {
  let submissions = 0;
  await page.route('**/api/orders', route => {
    submissions++;
    return route.fulfill({ json: { data: { id: 12, paymentUrl: 'https://sandbox.vnpayment.vn/fixture-payment' } } });
  });
  await page.route('https://sandbox.vnpayment.vn/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Mock VNPAY gateway</h1>' }));
  await page.goto('/checkout');
  await page.locator('.payment-option').filter({ hasText: 'VNPAY (Sandbox)' }).click();
  await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mock VNPAY gateway' })).toBeVisible();
  expect(submissions).toBe(1);
});

test('payment return reflects verified paid, failed and refund states without overflow', async ({ page }) => {
  for (const [paymentStatus, title] of [['paid', 'Thanh toán thành công'], ['failed', 'Thanh toán chưa hoàn tất'], ['refund_pending', 'Đang chờ hoàn tiền'], ['refunded', 'Đã hoàn tiền']]) {
    await page.route('**/api/orders/12', route => route.fulfill({ json: { data: { ...order, paymentStatus, paymentTransactionId: 'REAL-123' } } }));
    await page.goto('/payment/vnpay-return?orderId=12&status=success&transactionNo=FAKE');
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByText('FAKE', { exact: true })).toHaveCount(0);
    await noOverflow(page);
  }
});

test('payment return network failure offers retry and a slow confirmation never claims success', async ({ page }) => {
  await page.route('**/api/orders/12', route => route.abort('internetdisconnected'));
  await page.goto('/payment/vnpay-return?orderId=12&status=success');
  await expect(page.getByRole('alert')).toContainText('Không thể kết nối');
  await page.route('**/api/orders/12', route => route.fulfill({ json: { data: order } }));
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('heading', { name: 'Đang chờ xác nhận thanh toán' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Thanh toán thành công', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Xem đơn hàng', exact: true })).toBeVisible();
});

test('payment-link failure remains visible inside the order dialog and can recover', async ({ page }) => {
  await page.route('**/api/payments/12/pay', route => route.abort('internetdisconnected'));
  await page.goto('/orders');
  await page.getByRole('button', { name: 'Xem chi tiết đơn 12', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Thanh toán qua VNPay' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Không thể kết nối');
  await expect(dialog.getByRole('button', { name: 'Thanh toán qua VNPay' })).toBeEnabled();
  await noOverflow(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('payment polling stops after five further checks and explains an unconfirmed debit', async ({ page }) => {
  await page.clock.install();
  let checks = 0;
  await page.route('**/api/orders/12', route => { checks++; return route.fulfill({ json: { data: order } }); });
  await page.goto('/payment/vnpay-return?orderId=12');
  await expect(page.getByRole('heading', { name: 'Đang chờ xác nhận thanh toán' })).toBeVisible();
  // Development StrictMode may issue an aborted mount request before the live one.
  const initialChecks = checks;
  for (let poll = 1; poll <= 5; poll++) {
    await page.clock.runFor(2100);
    await expect.poll(() => checks).toBe(initialChecks + poll);
    if (poll < 5) await expect(page.getByRole('status')).toHaveText('Đang kiểm tra kết quả từ VNPAY…');
  }
  await expect(page.getByRole('status')).toContainText('Nếu đã bị trừ tiền');
  await page.clock.runFor(6000);
  expect(checks).toBe(initialChecks + 5);
});

test('a background payment network failure preserves the known order while offering recovery', async ({ page }) => {
  await page.clock.install();
  let fail = false;
  await page.route('**/api/orders/12', route => fail ? route.abort('internetdisconnected') : route.fulfill({ json: { data: order } }));
  await page.goto('/payment/vnpay-return?orderId=12');
  await expect(page.getByRole('heading', { name: 'Đang chờ xác nhận thanh toán' })).toBeVisible();
  fail = true;
  await page.clock.runFor(2100);
  await expect(page.getByRole('alert')).toContainText('Không thể kết nối');
  await expect(page.getByText('#12', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kiểm tra lại' })).toBeEnabled();
});
