import { expect, test, type Page } from "@playwright/test";

const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = []; browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(({ page }) => { expect(browserErrors.get(page)).toEqual([]); });

const books = [
  { id: 1, title: "Clean Code", author: "Robert Martin", slug: "clean-code", categoryId: 1, categoryName: "Công nghệ", price: 150000, stock: 5, description: "Sách lập trình", isbn: "1", coverUrl: "" },
  { id: 2, title: "Sách hết hàng", author: "Tác giả", slug: "sold-out", categoryId: 1, categoryName: "Công nghệ", price: 90000, stock: 0, description: "", isbn: "2", coverUrl: "" }
];
const user = { id: 1, email: "customer@example.test", fullName: "Nguyễn Văn A", role: "customer", emailVerified: true, phone: "0912345678", addressLine: "123 Đường Sách" };
const cart = { id: 1, total: 150000, items: [{ ...books[0], id: 10, bookId: 1, quantity: 1, lineTotal: 150000 }] };
const order = { id: 12, status: "pending", paymentStatus: "unpaid", paymentMethod: "vnpay", customerName: user.fullName, totalAmount: 150000, createdAt: "2026-10-09T00:00:00Z", items: [{ id: 1, bookId: 1, bookTitle: "Clean Code", unitPrice: 150000, quantity: 1 }] };

async function fixtures(page: Page, authenticated = false) {
  await page.route("http://localhost:4002/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const data = path === "/api/auth/me" ? user
      : path === "/api/auth/csrf" || path === "/api/contact/csrf" ? { csrfToken: "fixture" }
      : path === "/api/books/categories" ? [{ id: 1, slug: "cong-nghe", name: "Công nghệ" }]
      : path === "/api/books" ? books
      : path === "/api/books/clean-code" ? books[0]
      : path === "/api/profile/wishlist" ? []
      : path === "/api/auth/sessions" ? []
      : path === "/api/orders" ? [order]
      : path === "/api/cart" ? cart
      : path.startsWith("/api/orders/") ? order
      : {};
    const status = path === "/api/auth/me" && !authenticated ? 401 : 200;
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(status === 401 ? { error: { message: "Unauthenticated" } } : { data, meta: { total: books.length } }) });
  });
}

async function recoveryFixtures(page: Page, initialQuantity = 1) {
  await fixtures(page, true);
  const state = { quantity: initialQuantity, failReads: false, outcome: 'confirmed' as 'confirmed' | 'lost-committed' | 'lost-uncommitted' | 'rejected', writes: { POST: 0, PATCH: 0, DELETE: 0 } };
  await page.route('**/api/cart', route => route.fulfill({
    status: state.failReads ? 503 : 200,
    json: state.failReads ? { error: { message: 'Không thể tải giỏ hàng' } } : { data: { ...cart, total: state.quantity * 150000, items: state.quantity ? [{ ...cart.items[0], quantity: state.quantity, lineTotal: state.quantity * 150000 }] : [] } }
  }));
  await page.route(/\/api\/cart\/items(?:\/10)?$/, async route => {
    const method = route.request().method() as keyof typeof state.writes;
    state.writes[method]++;
    if (state.outcome === 'rejected') return route.fulfill({ status: 409, json: { error: { message: 'Số lượng vượt tồn kho' } } });
    if (state.outcome !== 'lost-uncommitted') {
      state.quantity = method === 'DELETE' ? 0 : method === 'PATCH' ? route.request().postDataJSON().quantity : state.quantity + route.request().postDataJSON().quantity;
    }
    if (state.outcome.startsWith('lost-')) return route.abort('internetdisconnected');
    state.failReads = true;
    await route.fulfill({ status: method === 'DELETE' ? 204 : 200, ...(method === 'DELETE' ? {} : { json: { data: {} } }) });
  });
  return state;
}

for (const path of ['/', '/catalog', '/wishlist']) test(`buy now adds once and opens checkout from ${path}`, async ({ page }) => {
  await fixtures(page, true);
  await page.route('**/api/profile/wishlist', route => route.fulfill({ json: { data: books } }));
  const writes: unknown[] = [];
  let ordersCreated = 0;
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/orders') ordersCreated++; });
  await page.route('**/api/cart/items', async route => {
    writes.push(route.request().postDataJSON());
    await route.fulfill({ json: { data: {} } });
  });
  await page.goto(path);
  const buy = page.getByRole('button', { name: 'Mua ngay Clean Code', exact: true }).first();
  await expect(buy).toBeEnabled();
  await buy.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole('heading', { name: 'Thông tin đặt hàng', exact: true })).toBeVisible();
  expect(writes).toEqual([{ bookId: 1, quantity: 1 }]);
  expect(ordersCreated).toBe(0);
});

test('buy now on book detail uses the selected quantity', async ({ page }) => {
  await fixtures(page, true);
  const writes: unknown[] = [];
  await page.route('**/api/cart/items', async route => { writes.push(route.request().postDataJSON()); await route.fulfill({ json: { data: {} } }); });
  await page.goto('/books/clean-code');
  await page.getByRole('button', { name: 'Tăng số lượng', exact: true }).click({ clickCount: 2 });
  await page.getByRole('button', { name: 'Mua ngay', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  expect(writes).toEqual([{ bookId: 1, quantity: 3 }]);
});

test('buy now requires login and is disabled for sold out books', async ({ page }) => {
  await fixtures(page);
  let writes = 0;
  await page.route('**/api/cart/items', route => { writes++; return route.fulfill({ json: { data: {} } }); });
  await page.goto('/catalog');
  await expect(page.getByRole('button', { name: 'Mua ngay Sách hết hàng', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Mua ngay Clean Code', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(writes).toBe(0);
});

test('buy now with an unsynchronized cart opens recovery without repeating the write', async ({ page }) => {
  const state = await recoveryFixtures(page, 0);
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Mua ngay Clean Code', exact: true }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole('heading', { name: 'Giỏ hàng đang chờ cập nhật' })).toBeVisible();
  expect(state.writes.POST).toBe(1);
  state.failReads = false;
  await page.getByRole('button', { name: 'Tải lại giỏ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tiến hành thanh toán', exact: true })).toBeEnabled();
  expect(state.writes.POST).toBe(1);
});

test('a rejected buy now stays on the book list and allows a retry', async ({ page }) => {
  const state = await recoveryFixtures(page);
  state.outcome = 'rejected';
  await page.goto('/catalog');
  const buy = page.getByRole('button', { name: 'Mua ngay Clean Code', exact: true });
  await buy.click();
  await expect(page.getByText('Số lượng vượt tồn kho', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(buy).toBeEnabled();
  expect(state.writes.POST).toBe(1);
});

test('confirmed add with a failed refresh offers read-only recovery and never adds twice', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const state = await recoveryFixtures(page);
  await page.goto('/catalog');
  const add = page.getByRole('button', { name: 'Thêm Clean Code vào giỏ' });
  await add.click();
  const notice = page.getByRole('status', { name: 'Đồng bộ giỏ hàng' });
  await expect(notice).toContainText('Đã thêm sách');
  await expect(add).toBeDisabled();
  await expect(page.getByText('Đã thêm "Clean Code" vào giỏ', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tải lại giỏ', exact: true }).click();
  await expect(notice).toBeVisible();
  await page.getByRole('link', { name: 'Xem giỏ hàng' }).click();
  await expect(page.getByRole('heading', { name: '1 sản phẩm', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tiến hành thanh toán' })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: '../../reports/ux/cart-recovery-mobile.png', fullPage: true });
  state.failReads = false;
  await page.getByRole('button', { name: 'Tải lại giỏ', exact: true }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '2 sản phẩm', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tiến hành thanh toán' })).toBeEnabled();
  expect(state.writes.POST).toBe(1);
});

test('adding to an empty cart with a failed refresh shows pending synchronization instead of empty', async ({ page }) => {
  const state = await recoveryFixtures(page, 0);
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Thêm Clean Code vào giỏ' }).click();
  await page.getByRole('link', { name: 'Xem giỏ hàng' }).click();
  await expect(page.getByRole('heading', { name: 'Giỏ hàng đang chờ cập nhật' })).toBeVisible();
  await expect(page.getByText('Chưa có sách nào', { exact: true })).toHaveCount(0);
  state.failReads = false;
  await page.getByRole('button', { name: 'Tải lại giỏ', exact: true }).click();
  await expect(page.getByRole('heading', { name: '1 sản phẩm', exact: true })).toBeVisible();
  expect(state.writes.POST).toBe(1);
});

for (const method of ['PATCH', 'DELETE'] as const) {
  test(`confirmed ${method} keeps cart rows stable after refresh failure and recovers without repeating the write`, async ({ page }) => {
    const state = await recoveryFixtures(page);
    await page.goto('/cart');
    await page.getByRole('button', { name: method === 'PATCH' ? 'Tăng số lượng Clean Code' : 'Xóa Clean Code khỏi giỏ' }).click();
    const notice = page.getByRole('status', { name: 'Đồng bộ giỏ hàng' });
    await expect(notice).toContainText(method === 'PATCH' ? 'Đã đổi số lượng' : 'Đã xóa sách');
    await expect(page.getByRole('heading', { name: '1 sản phẩm', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tăng số lượng Clean Code' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Tiến hành thanh toán' })).toBeDisabled();
    state.failReads = false;
    await page.getByRole('button', { name: 'Tải lại giỏ', exact: true }).click();
    await expect(page.getByRole('heading', { name: method === 'PATCH' ? '2 sản phẩm' : 'Giỏ hàng trống', exact: true })).toBeVisible();
    await expect(notice).toHaveCount(0);
    expect(state.writes[method]).toBe(1);
  });
}

for (const outcome of ['lost-committed', 'lost-uncommitted'] as const) {
  test(`lost add response (${outcome}) requires checking actual quantities without an automatic POST retry`, async ({ page }) => {
    const state = await recoveryFixtures(page); state.outcome = outcome;
    await page.goto('/catalog');
    const add = page.getByRole('button', { name: 'Thêm Clean Code vào giỏ' });
    await add.click();
    await expect(page.getByRole('alert', { name: 'Đồng bộ giỏ hàng' })).toContainText('Chưa xác nhận được thay đổi');
    await expect(add).toBeDisabled();
    await expect(page.getByText('Đã thêm "Clean Code" vào giỏ', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Tải lại giỏ', exact: true }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole('heading', { name: `${outcome === 'lost-committed' ? 2 : 1} sản phẩm`, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tăng số lượng Clean Code' })).toBeEnabled();
    expect(state.writes.POST).toBe(1);
  });
}

test('a definite stock rejection keeps the add button usable and does not claim synchronization failure', async ({ page }) => {
  const state = await recoveryFixtures(page); state.outcome = 'rejected';
  await page.goto('/catalog');
  const add = page.getByRole('button', { name: 'Thêm Clean Code vào giỏ' });
  await add.click();
  await expect(page.getByText('Số lượng vượt tồn kho', { exact: true })).toBeVisible();
  await expect(add).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Tải lại giỏ', exact: true })).toHaveCount(0);
  expect(state.quantity).toBe(1);
});

test('a stock rejection during the initial cart read does not turn a populated cart into an empty one', async ({ page }) => {
  const state = await recoveryFixtures(page); state.outcome = 'rejected';
  let started = false; let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/cart', async route => { started = true; await held; await route.fulfill({ json: { data: cart } }); });
  await page.goto('/catalog');
  await expect.poll(() => started).toBe(true);
  await page.getByRole('button', { name: 'Thêm Clean Code vào giỏ' }).click();
  await expect(page.getByText('Số lượng vượt tồn kho', { exact: true })).toBeVisible();
  await page.locator('header').getByRole('button', { name: 'Giỏ hàng', exact: true }).click();
  await expect(page.getByText('Giỏ hàng trống', { exact: true })).toHaveCount(0);
  const read = page.waitForResponse(response => new URL(response.url()).pathname === '/api/cart');
  release(); await read;
  await expect(page.getByRole('heading', { name: '1 sản phẩm', exact: true })).toBeVisible();
});

test('checkout reached through browser history stays blocked until a failed cart refresh recovers', async ({ page }) => {
  const state = await recoveryFixtures(page);
  await page.goto('/checkout');
  await expect(page.getByRole('button', { name: 'Đặt hàng', exact: true })).toBeVisible();
  await page.locator('header').getByRole('button', { name: 'Giỏ hàng', exact: true }).click();
  await page.getByRole('button', { name: 'Tăng số lượng Clean Code' }).click();
  await expect(page.getByRole('status', { name: 'Đồng bộ giỏ hàng' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole('heading', { name: 'Cập nhật giỏ hàng trước khi đặt hàng' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đặt hàng', exact: true })).toHaveCount(0);
  state.failReads = false;
  await page.getByRole('button', { name: 'Tải lại giỏ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đặt hàng', exact: true })).toBeVisible();
  expect(state.writes.PATCH).toBe(1);
});

test('a delayed read from before adding cannot overwrite the latest cart quantity', async ({ page }) => {
  await fixtures(page, true);
  let started = false; let reads = 0; let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/cart', async route => {
    const first = ++reads === 1;
    if (first) { started = true; await held; }
    await route.fulfill({ json: { data: { ...cart, items: [{ ...cart.items[0], quantity: first ? 1 : 2 }] } } });
  });
  await page.goto('/catalog');
  await expect.poll(() => started).toBe(true);
  await page.getByRole('button', { name: 'Thêm Clean Code vào giỏ' }).click();
  await expect(page.getByText('Đã thêm "Clean Code" vào giỏ', { exact: true })).toBeVisible();
  const oldRead = page.waitForResponse(response => new URL(response.url()).pathname === '/api/cart');
  release(); await oldRead;
  await page.locator('header').getByRole('button', { name: 'Giỏ hàng', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2 sản phẩm', exact: true })).toBeVisible();
});

test('switching accounts while an add is pending cannot expose the previous account cart when the next read fails', async ({ page }) => {
  await fixtures(page, true);
  let nextAccount = false; let started = false; let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/cart', route => route.fulfill({ status: nextAccount ? 503 : 200, json: nextAccount ? { error: { message: 'Không thể tải giỏ tài khoản mới' } } : { data: cart } }));
  await page.route('**/api/cart/items', async route => { started = true; await held; await route.fulfill({ json: { data: {} } }).catch(() => {}); });
  await page.route('**/api/auth/login', route => { nextAccount = true; return route.fulfill({ json: { data: { user: { ...user, id: 2, fullName: 'Người dùng B' }, csrfToken: 'fixture-b' } } }); });
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Thêm Clean Code vào giỏ' }).click();
  await expect.poll(() => started).toBe(true);
  await page.locator('header').getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.locator('header').getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('next@example.test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('FixturePassword123!');
  await page.locator('form').getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.locator('header').getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
  release();
  await page.locator('header').getByRole('button', { name: 'Giỏ hàng', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Không thể tải giỏ tài khoản mới');
  await expect(page.locator('.reference-cart-row')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tải lại giỏ', exact: true })).toHaveCount(0);
});

test("catalog failure has retry and does not masquerade as an empty catalog", async ({ page }) => {
  await fixtures(page);
  let failed = true;
  await page.route("**/api/books?**", route => route.fulfill({ status: failed ? 503 : 200, json: failed ? { error: { message: "Máy chủ đang bận" } } : { data: books, meta: { total: 2 } } }));
  await page.goto("/catalog");
  await expect(page.getByRole("alert")).toHaveText("Máy chủ đang bận");
  await expect(page.getByText("Không tìm thấy", { exact: true })).toHaveCount(0);
  failed = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: "Clean Code", exact: true })).toBeVisible();
});

test("slow catalog preserves its heading and filter position until real books arrive", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await fixtures(page);
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/books?**", async route => {
    await ready;
    await route.fulfill({ json: { data: books, meta: { total: books.length } } });
  });
  await page.goto("/catalog");
  await expect(page.getByRole("heading", { name: "Sách", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Đang tải sách…");
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await expect(page.getByText("Không tìm thấy", { exact: true })).toHaveCount(0);
  const before = await page.getByLabel("Sắp xếp sách").boundingBox();
  release();
  await expect(page.getByRole("heading", { name: "Clean Code", exact: true })).toBeVisible();
  const after = await page.getByLabel("Sắp xếp sách").boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
});

test("visible book covers load first and a custom cover loads when scrolled into view", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await fixtures(page);
  const manyBooks = Array.from({ length: 20 }, (_, index) => ({ ...books[0], id: index + 1, title: `Sách tải ${index + 1}`, coverUrl: `http://localhost:4002/uploads/cover-${index + 1}.png` }));
  await page.route("**/api/books?**", route => route.fulfill({ json: { data: manyBooks, meta: { total: manyBooks.length } } }));
  const requested: string[] = [];
  await page.route("**/uploads/cover-*.png", route => {
    requested.push(route.request().url());
    return route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") });
  });
  await page.goto("/catalog");
  await expect(page.getByRole("img", { name: "Sách tải 1", exact: true })).toBeVisible();
  const visibleCovers = await page.locator('.book-card .book-cover').evaluateAll(elements => elements.flatMap((element, index) => {
    const bounds = element.getBoundingClientRect(); return bounds.top < innerHeight && bounds.bottom > 0 ? [index] : [];
  }));
  await expect.poll(() => visibleCovers.every(index => requested.includes(manyBooks[index].coverUrl))).toBe(true);
  expect(requested.length).toBeLessThan(manyBooks.length);
  expect(requested).not.toContain(manyBooks[19].coverUrl);
  await page.locator(".book-card").last().scrollIntoViewIfNeeded();
  await expect(page.getByRole("img", { name: "Sách tải 20", exact: true })).toBeVisible();
  await expect.poll(() => requested.includes(manyBooks[19].coverUrl)).toBe(true);
});

test("320px catalog supports touch buying, keyboard title links, sorting and a role-aware menu", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixtures(page);
  await page.goto("/catalog");
  const add = page.getByRole("button", { name: "Thêm Clean Code vào giỏ" });
  await expect(add).toBeVisible();
  await expect(add).toHaveCSS("opacity", "1");
  await add.focus();
  await expect(add).toHaveCSS("opacity", "1");
  await expect(page.getByRole("button", { name: "Thêm Sách hết hàng vào giỏ" })).toBeDisabled();
  await page.getByLabel("Sắp xếp sách").selectOption("price-asc");
  await expect(page.locator(".book-card h3").first()).toHaveText("Sách hết hàng");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: "../../reports/ux/catalog-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.locator("header").getByRole("button", { name: "Quản trị", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Clean Code", exact: true }).focus();
  await page.route("**/api/books/clean-code", route => route.fulfill({ json: { data: books[0] } }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/books\/clean-code$/);
});

test("clearing search prevents an older response from restoring a stale filter", async ({ page }) => {
  await fixtures(page);
  let started = false;
  await page.route("**/api/books?q=**", async route => {
    started = true;
    await new Promise(resolve => setTimeout(resolve, 600));
    await route.fulfill({ json: { data: [], meta: { total: 0 } } }).catch(() => {});
  });
  await page.goto("/catalog");
  await page.getByLabel("Tìm theo tên sách hoặc tác giả").fill("không có");
  await expect.poll(() => started).toBe(true);
  await page.getByLabel("Tìm theo tên sách hoặc tác giả").fill("");
  await page.waitForTimeout(800);
  await expect(page.getByRole("heading", { name: "Clean Code", exact: true })).toBeVisible();
});

test("cart failure has retry; quantity controls stay stable and prevent overlapping mutations", async ({ page }) => {
  await fixtures(page, true);
  let failed = true;
  let quantity = 1;
  let mutations = 0;
  await page.route("**/api/cart", route => route.fulfill({ status: failed ? 503 : 200, json: failed ? { error: { message: "Không thể tải giỏ hàng" } } : { data: { ...cart, items: [{ ...cart.items[0], quantity }] } } }));
  await page.route("**/api/cart/items/10", async route => {
    mutations++;
    quantity = route.request().postDataJSON().quantity;
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.fulfill({ json: { data: {} } });
  });
  await page.goto("/cart");
  await expect(page.getByRole("alert")).toHaveText("Không thể tải giỏ hàng");
  failed = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("button", { name: "Giảm số lượng Clean Code" })).toBeDisabled();
  const increase = page.getByRole("button", { name: "Tăng số lượng Clean Code" });
  await increase.click();
  await expect(increase).toBeDisabled();
  await expect(page.getByText("Đang tải giỏ hàng…", { exact: true })).toHaveCount(0);
  await expect(increase).toBeEnabled();
  expect(mutations).toBe(1);
});

test("order network failure is distinct from denied access and can be retried", async ({ page }) => {
  await fixtures(page, true);
  let code = 503;
  await page.route("**/api/orders/12", route => route.fulfill({ status: code, json: { error: { message: code === 403 ? "Forbidden" : "Máy chủ đang bận" } } }));
  await page.goto("/confirmation/12");
  await expect(page.getByRole("alert")).toHaveText("Máy chủ đang bận");
  await expect(page.getByText(/403|IDOR/)).toHaveCount(0);
  code = 403;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("alert")).toHaveText("Bạn không có quyền xem đơn hàng này.");
  await expect(page.getByRole("button", { name: "Thử lại" })).toHaveCount(0);
});

test("coupon Enter previews real discount without submitting checkout; order sends a stable idempotency key", async ({ page }) => {
  await fixtures(page, true);
  let submissions = 0;
  let request: { headers: Record<string, string>; body: Record<string, string> } | undefined;
  await page.route("**/api/orders/quote", route => route.fulfill({ json: { data: { subtotal: 150000, discount: 25000, total: 125000 } } }));
  await page.route("**/api/orders", async route => {
    submissions++;
    request = { headers: route.request().headers(), body: route.request().postDataJSON() };
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.fulfill({ json: { data: { id: 12 } } });
  });
  await page.goto("/checkout");
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByLabel("Mã ưu đãi").fill("SAVE25");
  await page.getByLabel("Mã ưu đãi").press("Enter");
  await expect(page.getByText("Giảm 25.000 ₫", { exact: true })).toBeVisible();
  expect(submissions).toBe(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "../../reports/ux/checkout-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Đặt hàng", exact: true }).click();
  await expect(page).toHaveURL(/\/confirmation\/12$/);
  expect(submissions).toBe(1);
  expect(request?.body.couponCode).toBe("SAVE25");
  expect(request?.headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
});

test("payment success cannot be forged through query parameters", async ({ page }) => {
  await fixtures(page, true);
  await page.goto("/payment/vnpay-return?orderId=12&status=success&amount=1&transactionNo=FAKE");
  await expect(page.getByRole("heading", { name: "Đang chờ xác nhận thanh toán" })).toBeVisible();
  await expect(page.getByText("FAKE", { exact: true })).toHaveCount(0);
  await page.route("**/api/orders/12", route => route.fulfill({ json: { data: { ...order, paymentStatus: "paid", paymentTransactionId: "REAL123" } } }));
  await page.getByRole("button", { name: "Kiểm tra lại" }).click();
  await expect(page.getByRole("heading", { name: "Thanh toán thành công", exact: true })).toBeVisible();
  await expect(page.getByText("REAL123", { exact: true })).toBeVisible();
});

test("home removes inactive newsletter and fixed business statistics", async ({ page }) => {
  await fixtures(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tìm cuốn sách tiếp theo của bạn." })).toBeVisible();
  await expect(page.getByText("160+", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Bản tin", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "../../reports/ux/home-desktop.png", fullPage: true });
  await page.getByRole('button', { name: 'Công nghệ', exact: false }).click();
  await expect(page).toHaveURL(/category=cong-nghe/);
});

test("detail shows stored metadata and settings exclude inactive notification and 2FA controls", async ({ page }) => {
  await fixtures(page, true);
  await page.route('**/api/books/clean-code', route => route.fulfill({ json: { data: books[0] } }));
  await page.goto('/books/clean-code');
  await page.getByRole('button', { name: 'Thông tin chi tiết', exact: true }).click();
  await expect(page.getByText('320 trang', { exact: true })).toHaveCount(0);
  await expect(page.getByText('4.2 · 128 đánh giá', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Đổi trả 7 ngày', { exact: true })).toHaveCount(0);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Cài đặt', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thông báo', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Bảo mật', exact: true }).click();
  await expect(page.getByText('Xác thực 2 bước (2FA)', { exact: true })).toHaveCount(0);
});

for (const width of [320, 768, 1440]) for (const path of ['/about', '/contact']) test(`brand page ${path} works at ${width}px with real navigation`, async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await expect(page.locator('main h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  if (width < 1024) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const other = path === '/about' ? 'Liên hệ' : 'Về chúng tôi';
  await page.locator('header').getByRole('button', { name: other, exact: true }).click();
  await expect(page).toHaveURL(path === '/about' ? /\/contact$/ : /\/about$/);
  if (width < 1024) await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.screenshot({ path: `../../reports/ux/brand-${path.slice(1)}-${width}.png`, fullPage: true });
});

test('reading journey supports keyboard steps and leads to the real cart workflow', async ({ page }) => {
  await fixtures(page, true); await page.goto('/about');
  const steps = page.getByRole('tablist', { name: 'Hành trình mua sách' });
  await steps.getByRole('tab', { name: /Khám phá/ }).focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await expect(steps.getByRole('tab', { name: /Đặt sách/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tabpanel').getByRole('button', { name: 'Mở giỏ sách', exact: true }).click();
  await expect(page).toHaveURL(/\/cart$/);
});

async function contactDraft(page: Page) {
  await page.goto('/contact?topic=orders');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByRole('textbox', { name: 'Họ và tên', exact: true }).fill('Độc giả kiểm thử');
  await page.getByRole('textbox', { name: 'Email nhận phản hồi', exact: true }).fill('reader@example.test');
  await page.getByRole('textbox', { name: /Lời nhắn của bạn/ }).fill('Tôi muốn hỏi về trạng thái đơn hàng #12.');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
}

test('contact reviews the message before sending, prevents duplicate sends and shows only a confirmed reference', async ({ page }) => {
  await fixtures(page);
  const writes: unknown[] = [];
  await page.route('**/api/contact', async route => { writes.push(route.request().postDataJSON()); await route.fulfill({ status: 201, json: { data: { reference: 'TT-FIXTURE12345' } } }); });
  await contactDraft(page);
  expect(writes).toHaveLength(0);
  await expect(page.locator('.contact-review')).toContainText('Đơn hàng');
  await page.getByRole('button', { name: 'Gửi lời nhắn', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByRole('heading', { name: 'Lời nhắn đã được gửi.', exact: true })).toBeVisible();
  await expect(page.getByText('TT-FIXTURE12345', { exact: true })).toBeVisible();
  expect(writes).toEqual([{ name: 'Độc giả kiểm thử', email: 'reader@example.test', topic: 'orders', message: 'Tôi muốn hỏi về trạng thái đơn hàng #12.' }]);
});

test('contact failure preserves the draft and never displays a success receipt', async ({ page }) => {
  await fixtures(page);
  await page.route('**/api/contact', route => route.fulfill({ status: 503, json: { error: { message: 'Chưa gửi được lời nhắn.' } } }));
  await contactDraft(page);
  await page.getByRole('button', { name: 'Gửi lời nhắn', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa gửi được lời nhắn.');
  await expect(page.locator('.contact-success')).toHaveCount(0);
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /Lời nhắn của bạn/ })).toHaveValue('Tôi muốn hỏi về trạng thái đơn hàng #12.');
});

test('book detail exposes metadata and a cover viewer with keyboard dismissal and focus restoration', async ({ page }) => {
  await fixtures(page); await page.goto('/books/clean-code');
  await expect(page.getByRole('heading', { name: 'Thông tin sách', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Về cuốn sách này', exact: true })).toBeVisible();
  const cover = page.getByRole('button', { name: 'Phóng lớn bìa Clean Code', exact: true });
  await cover.click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Phóng to', exact: true }).click();
  await expect(page.locator('.lightbox-image')).toHaveClass(/is-zoomed/);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(cover).toBeFocused();
  await page.getByRole('button', { name: 'Thông tin chi tiết', exact: true }).click();
  await expect(page.locator('#book-specifications')).toBeInViewport();
});

test('brand motion respects reduced motion and the contact FAQ works with the keyboard', async ({ page }) => {
  await fixtures(page); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/contact');
  expect(await page.locator('.storefront-page-enter').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  const faq = page.locator('.faq-list details').first();
  await faq.locator('summary').focus(); await page.keyboard.press('Enter');
  await expect(faq).toHaveAttribute('open', '');
  await expect(faq.locator('p')).toBeVisible();
});

test("lazy admin pages render real fixture data after the storefront split", async ({ page }) => {
  await fixtures(page, true);
  await page.route('**/api/auth/me', route => route.fulfill({ json: { data: { ...user, role: 'admin' } } }));
  await page.route('**/api/admin/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/dashboard') ? {
      summary: { orders: 1, revenue: 0, books: 2, customers: 1, pendingOrders: 1 },
      recentOrders: [order], revenueByDay: [], ordersByStatus: [], topSelling: [], lowStock: []
    } : path.endsWith('/books') ? books : path.endsWith('/orders') ? [order]
      : path.endsWith('/categories') ? [{ id: 1, name: 'Công nghệ', slug: 'cong-nghe', bookCount: 2 }]
      : path.endsWith('/security-report') ? { available: false } : [];
    return route.fulfill({ json: { data } });
  });
  await page.goto('/admin');
  await expect(page.getByRole('button', { name: 'Kho sách', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kho sách', exact: true }).click();
  await expect(page.getByText('Clean Code', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Đã xảy ra lỗi', { exact: true })).toHaveCount(0);
});
