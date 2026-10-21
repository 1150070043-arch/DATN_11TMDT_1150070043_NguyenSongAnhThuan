import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';

const titles = ['Clean Code', 'Sách', 'Một cuốn sách có tiêu đề rất dài về nghệ thuật sống và những điều nhỏ bé mỗi ngày', 'LậpTrìnhỨngDụngWebVớiMộtTiêuĐềKhôngCóKhoảngTrắngRấtDài'];
const categories = ['Công nghệ', 'Lịch sử - xã hội', 'Kỹ năng'];
const books = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, title: titles[index % 4], author: index % 3 ? 'Tác giả' : 'Nguyễn Văn An và những người cộng sự với tên tác giả dài',
  slug: 'layout-' + index, categoryId: index % 3 + 1, categoryName: categories[index % 3], price: index % 2 ? 9000 : 1250000, stock: index % 4 ? 5 : 0,
  description: 'Dữ liệu kiểm tra bố cục', isbn: String(index), coverUrl: index % 2 ? '/covers/layout-missing.jpg' : '' }));
const user = { id: 1, email: 'layout@example.test', fullName: 'Người kiểm tra bố cục', role: 'customer', emailVerified: true, phone: '0912345678', addressLine: 'Địa chỉ fixture' };
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = []; page.on('pageerror', error => errors.push(error.message));
  // Keep third-party fonts/category photographs deterministic. Carousel images
  // still use the actual local production assets and are checked for loading.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://images.unsplash.com/**', route => route.fulfill({ contentType: 'image/webp', path: resolve('../../apps/web/public/design/hero/reading-640.webp') }));
  await page.route('**/covers/layout-missing.jpg', route => route.fulfill({ status: 404 }));
  // No SQL, email or payment mutations: every API request uses local fixtures.
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data = path === '/api/auth/me' ? user : path === '/api/auth/csrf' ? { csrfToken: 'fixture' }
      : path === '/api/books' || path === '/api/profile/wishlist' ? books
      : path.startsWith('/api/books/layout-') ? books[Number(path.split('-').at(-1))]
      : path === '/api/books/categories' ? categories.map((name, index) => ({ id: index + 1, name, slug: 'category-' + index }))
      : path === '/api/cart' ? { id: 1, total: 1250000, items: [{ ...books[2], id: 20, bookId: 3, quantity: 1, lineTotal: 1250000 }] }
      : path === '/api/payments/methods' ? { vnpay: true } : [];
    return route.fulfill({ json: { data, meta: { total: books.length } } });
  });
});
test.afterEach(() => { expect(errors).toEqual([]); });

async function cardLayout(page: Page, selector = '.book-card:not([aria-hidden])') {
  await expect(page.locator(selector).first()).toBeVisible();
  const cards = await page.locator(selector).evaluateAll(elements => elements.map(card => {
    const rect = (selector: string) => {
      const node = card.querySelector(selector)!; const r = node.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width };
    };
    const bounds = card.getBoundingClientRect();
    return { height: bounds.height, width: bounds.width, cover: rect('.book-cover'), category: rect('.book-category'), title: rect('.book-title'), author: rect('.book-author'), price: rect('.book-price'), add: rect('.book-add') };
  }));
  if (cards.some(card => Math.abs(card.height - cards[0].height) > 1)) console.log(JSON.stringify({ layoutMismatch: cards }));
  for (const card of cards) {
    expect(card.cover.bottom).toBeLessThanOrEqual(card.category.top + 1);
    expect(card.category.bottom).toBeLessThanOrEqual(card.title.top + 1);
    expect(card.title.bottom).toBeLessThanOrEqual(card.author.top + 1);
    expect(card.author.bottom).toBeLessThanOrEqual(card.price.top + 1);
    expect(card.price.bottom).toBeLessThanOrEqual(card.add.top + 1);
    expect(card.add.height).toBeGreaterThanOrEqual(44);
    expect(card.add.left).toBeGreaterThanOrEqual(card.cover.left);
    expect(card.add.right).toBeLessThanOrEqual(card.cover.right + 1);
    expect(Math.abs(card.height - cards[0].height)).toBeLessThanOrEqual(1);
    expect(Math.abs(card.width - cards[0].width)).toBeLessThanOrEqual(1);
  }
}
async function viewportBounds(page: Page) {
  const overflow = await page.locator('header button, #main-content input, #main-content select, #main-content textarea').evaluateAll(elements => elements.filter(node => {
    const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.left < -1 || r.right > innerWidth + 1);
  }).map(node => node.getAttribute('aria-label') || node.textContent));
  expect(overflow).toEqual([]);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
for (const width of [320, 390, 768, 1024, 1440]) for (const theme of ['dark', 'light']) {
  test(`catalog cards have equal dimensions and unobstructed actions at ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(theme => localStorage.setItem('bookguard-theme', theme), theme);
    await page.goto('/catalog'); await expect(page.locator('.book-card:not([aria-hidden])')).toHaveCount(12);
    await cardLayout(page); await viewportBounds(page);
    await expect(page.locator('.book-add').first()).toBeDisabled();
    if (width === 390 || width === 1440) await page.screenshot({ path: `../../reports/ui-layout/catalog-${info.project.name}-${width}-${theme}.png`, fullPage: true });
  });
}
for (const width of [390, 1440]) test(`home recommendations align at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 }); await page.goto('/');
  await expect(page.locator('section .grid .book-card:not([aria-hidden])')).toHaveCount(4);
  await cardLayout(page, 'section .grid .book-card:not([aria-hidden])');
  await viewportBounds(page); await page.screenshot({ path: `../../reports/ui-layout/home-${info.project.name}-${width}.png`, fullPage: true });
});
for (const width of [320, 768]) test(`wishlist cards and remove actions are usable without hover at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await page.goto('/wishlist');
  await expect(page.locator('.wishlist-grid .book-card')).toHaveCount(12); await cardLayout(page); await viewportBounds(page);
  const remove = page.locator('.book-remove').first(); await expect(remove).toBeVisible();
  const box = await remove.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44);
  let removed = false; await page.route('**/api/profile/wishlist/1', route => { removed = true; return route.fulfill({ status: 204 }); });
  await remove.click(); await expect(page.locator('.wishlist-grid .book-card')).toHaveCount(11); expect(removed).toBe(true);
});
for (const route of ['/cart', '/checkout', '/profile', '/orders', '/books/layout-2', '/login']) test(`tablet controls stay within viewport on ${route}`, async ({ page }, info) => {
  await page.setViewportSize({ width: 768, height: 900 });
  if (route === '/login') {
    await page.route('**/api/auth/me', endpoint => endpoint.fulfill({ status: 401, json: { error: { message: 'Fixture unauthenticated' } } }));
  }
  await page.goto(route); await expect(page.locator('header')).toBeVisible(); await expect(page).toHaveURL(new RegExp(route + '$'));
  await expect(page.locator('#main-content h1').first()).toBeVisible(); await viewportBounds(page);
  await page.screenshot({ path: `../../reports/ui-layout/tablet-${info.project.name}-${route.replaceAll('/', '-')}.png`, fullPage: true });
});
test('hover keeps card geometry stable and the title works with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/catalog');
  const card = page.locator('.book-card:not([aria-hidden])').nth(1); await expect(card).toBeVisible(); await page.evaluate(() => document.fonts.ready); await card.scrollIntoViewIfNeeded(); const before = await card.boundingBox();
  await card.hover(); const after = await card.boundingBox(); expect(after).toEqual(before);
  const title = card.locator('.book-title button'); await title.focus(); await title.press('Enter');
  await expect(page).toHaveURL(/\/books\/layout-/);
});
test('short mobile viewport can reach every menu action with touch sized controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 }); await page.goto('/catalog');
  const menu = page.getByRole('button', { name: 'Menu', exact: true }); await expect(menu).toBeVisible();
  await menu.click(); const signOut = page.locator('.storefront-mobile-menu').getByRole('button', { name: 'Đăng xuất', exact: true });
  await signOut.scrollIntoViewIfNeeded(); await expect(signOut).toBeInViewport();
  const bounds = await page.locator('.storefront-nav button[aria-label]').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect()).filter(rect => rect.width > 0));
  for (const rect of bounds) { expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44); }
  await page.keyboard.press('Escape'); await expect(signOut).not.toBeVisible();
});
test('pending wishlist removal blocks a duplicate write and failure leaves the item usable', async ({ page }) => {
  await page.goto('/wishlist'); let attempts = 0; let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/profile/wishlist/1', async route => { attempts++; await held; await route.fulfill({ status: 503, json: { error: { message: 'Không thể bỏ yêu thích' } } }); });
  const remove = page.locator('.book-remove').first(); await remove.click(); await expect(remove).toBeDisabled();
  expect(attempts).toBe(1); release(); await expect(remove).toBeEnabled();
  await expect(page.locator('.wishlist-grid .book-card')).toHaveCount(12);
});

for (const width of [320, 390, 768, 1024, 1440]) for (const theme of ['dark', 'light']) {
  test(`header and photo carousel stay usable at ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(theme => localStorage.setItem('bookguard-theme', theme), theme);
    await page.goto('/');
    const hero = page.getByRole('region', { name: 'Gợi ý đọc sách' });
    await expect(hero.getByRole('heading', { name: 'Tìm cuốn sách tiếp theo của bạn.' })).toBeVisible();
    await expect.poll(() => hero.locator('img.is-active').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    const before = await hero.boundingBox();
    const panel = await hero.locator('.hero-panel').boundingBox();
    expect(panel!.x).toBe(0); expect(panel!.width).toBe(width);
    await expect(hero.getByRole('button', { name: /Phát slide|Dừng slide|Slide trước|Slide tiếp/ })).toHaveCount(0);
    await hero.getByRole('button', { name: 'Slide 2', exact: true }).click();
    await expect(hero.getByRole('heading', { name: 'Mỗi trang sách, một góc nhìn mới.' })).toBeVisible();
    await expect(hero.getByRole('button', { name: 'Slide 2', exact: true })).toHaveAttribute('aria-current', 'true');
    expect(await hero.boundingBox()).toEqual(before);
    await hero.getByRole('button', { name: 'Slide 3', exact: true }).click();
    await expect(hero.getByRole('heading', { name: 'Chậm lại một chút. Đọc thêm một trang.' })).toBeVisible();
    expect(await hero.boundingBox()).toEqual(before);
    await hero.getByRole('button', { name: 'Slide 1', exact: true }).click();
    const controls = await page.locator('.storefront-nav button, .hero-controls button').evaluateAll(buttons => buttons.map(button => {
      const r = button.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    }).filter(rect => rect.width > 0 && rect.height > 0));
    for (const rect of controls) { expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44); }
    const header = await page.locator('.storefront-nav button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect()).filter(rect => rect.width > 0).map(rect => ({ x: rect.x, right: rect.right })));
    for (let i = 0; i < header.length; i++) for (let j = i + 1; j < header.length; j++) expect(Math.min(header[i].right, header[j].right) - Math.max(header[i].x, header[j].x)).toBeLessThanOrEqual(1);
    await viewportBounds(page);
    if (width === 390 || width === 1440) await page.screenshot({ path: `../../reports/ui-layout/storefront-${info.project.name}-${width}-${theme}.png` });
  });
}
test('carousel supports keyboard, wraps, and respects reduced motion', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByRole('region', { name: 'Gợi ý đọc sách' });
  const first = hero.getByRole('button', { name: 'Slide 1', exact: true });
  await first.focus(); await page.keyboard.press('ArrowLeft');
  await expect(hero.getByRole('button', { name: 'Slide 3', exact: true })).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('ArrowRight'); await expect(first).toHaveAttribute('aria-current', 'true');
  await expect(hero.getByRole('button', { name: /Phát slide|Dừng slide/ })).toHaveCount(0);
  await hero.getByRole('button', { name: 'Khám phá sách', exact: true }).click(); await expect(page).toHaveURL(/\/catalog$/);
});
test('carousel autoplays while hovered and resumes after keyboard interaction without playback controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install({ time: new Date('2026-10-13T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-13T00:00:01Z'));
  await page.goto('/');
  const hero = page.getByRole('region', { name: 'Gợi ý đọc sách' });
  const advanceTo = async (index: number) => {
    await page.clock.runFor(6000);
    // React installs a passive timer effect after the DOM commit. Advance in
    // small steps so WebKit can commit that effect before the next deadline.
    await expect.poll(async () => {
      await page.clock.runFor(250);
      return hero.getByRole('button', { name: `Slide ${index}`, exact: true }).getAttribute('aria-current');
    }, { intervals: [100], timeout: 5000 }).toBe('true');
  };
  await expect(hero.getByRole('button', { name: 'Slide 1', exact: true })).toHaveAttribute('aria-current', 'true');
  await page.mouse.move(1, 1); await expect(hero.locator('.hero-copy')).toHaveAttribute('aria-live', 'off'); await advanceTo(2);
  await expect(hero.getByRole('button', { name: 'Slide 2', exact: true })).toHaveAttribute('aria-current', 'true');
  await hero.hover(); await expect(hero.locator('.hero-copy')).toHaveAttribute('aria-live', 'off'); await advanceTo(3);
  await hero.getByRole('button', { name: 'Slide 1', exact: true }).focus();
  await expect(hero.locator('.hero-copy')).toHaveAttribute('aria-live', 'polite'); await page.clock.runFor(14000);
  await expect(hero.getByRole('button', { name: 'Slide 3', exact: true })).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('Enter');
  await expect(hero.getByRole('button', { name: 'Slide 1', exact: true })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'Thư An — Trang chủ', exact: true }).focus(); await page.mouse.move(1, 1);
  await expect(hero.locator('.hero-copy')).toHaveAttribute('aria-live', 'off');
  await advanceTo(2); await expect(hero.getByRole('button', { name: /Phát slide|Dừng slide/ })).toHaveCount(0);
});
test('mobile menu closes outside and Escape returns focus; theme preference persists', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/catalog');
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  await menu.click(); await page.keyboard.press('Escape'); await expect(menu).toBeFocused();
  await menu.click();
  const panel = await page.locator('.storefront-mobile-menu').boundingBox();
  await page.mouse.click(8, panel!.y + panel!.height + 12); await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Chuyển sang sáng', exact: true }).click();
  await expect(page.locator('.storefront-shell')).toHaveAttribute('data-theme', 'light');
  await page.reload(); await expect(page.locator('.storefront-shell')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Chuyển sang tối', exact: true })).toBeVisible();
});

for (const theme of ['dark', 'light']) test(`customer pages have readable text and brighter surfaces in ${theme}`, async ({ page }, info) => {
  test.setTimeout(60_000); // Seven lazy routes, including guest authentication pages.
  await page.addInitScript(theme => localStorage.setItem('bookguard-theme', theme), theme);
  for (const path of ['/catalog', '/profile', '/cart', '/checkout', '/orders', '/login', '/forgot-password']) {
    await page.route('**/api/auth/me', route => path === '/login' || path === '/forgot-password'
      ? route.fulfill({ status: 401, json: { error: { message: 'Guest fixture' } } }) : route.fulfill({ json: { data: user } }));
    await page.goto(path, { waitUntil: 'domcontentloaded' }); await expect(page.locator('#main-content h1').first()).toBeVisible({ timeout: 15_000 });
    const results = await page.locator('#main-content h1, #main-content input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), #main-content textarea, .book-author, .catalog-count').evaluateAll(nodes => {
      const luminance = (rgb: string) => {
        const values = rgb.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
          const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
        });
        return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
      };
      return nodes.filter(node => node.getBoundingClientRect().width > 0).map(node => {
        let parent: Element | null = node; let background = 'rgba(0, 0, 0, 0)';
        while (parent && background === 'rgba(0, 0, 0, 0)') { background = getComputedStyle(parent).backgroundColor; parent = parent.parentElement; }
        const fg = luminance(getComputedStyle(node).color), bg = luminance(background);
        return { text: node.textContent?.slice(0, 40) || node.tagName, contrast: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05), background: bg };
      });
    });
    for (const result of results) { expect(result.contrast, `${path}: ${result.text}`).toBeGreaterThanOrEqual(4.5); expect(result.background, `${path}: ${result.text}`).toBeGreaterThan(theme === 'light' ? .5 : .015); }
    if (path === '/login' || path === '/profile') await page.screenshot({ path: `../../reports/ui-layout/palette-${info.project.name}-${theme}-${path.slice(1)}.png` });
  }
});

async function sixCategories(page: Page) {
  const names = ['Văn học', 'Công nghệ', 'Kinh doanh', 'Kỹ năng', 'Lịch sử - xã hội', 'Thiếu nhi'];
  await page.route('**/api/books/categories', route => route.fulfill({ json: { data: names.map((name, index) => ({ id: index + 1, name, slug: 'many-' + index })) } }));
  await page.route('**/api/books?**', route => route.fulfill({ json: { data: books.map((book, index) => index === 11 ? { ...book, categoryId: 6, categoryName: 'Thiếu nhi' } : book), meta: { total: 12 } } }));
}
for (const width of [320, 390, 768]) test(`compact catalog puts books near the top and keeps six categories on one row at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 844 }); await sixCategories(page); await page.goto('/catalog');
  await expect(page.locator('.book-card:not([aria-hidden])')).toHaveCount(12);
  const first = await page.locator('.book-card:not([aria-hidden])').first().boundingBox();
  console.log(JSON.stringify({ compactWidth: width, firstCardTop: first!.y }));
  expect(first!.y).toBeLessThanOrEqual(280);
  const buttons = await page.locator('.catalog-categories button').evaluateAll(elements => elements.map(button => button.getBoundingClientRect().top));
  expect(Math.max(...buttons) - Math.min(...buttons)).toBeLessThanOrEqual(1);
  const last = page.locator('.catalog-categories').getByRole('button', { name: 'Thiếu nhi', exact: true });
  await last.click(); await expect(last).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/category=many-5/); await expect(page.locator('.book-card:not([aria-hidden])')).toHaveCount(1);
  await viewportBounds(page);
  await page.screenshot({ path: `../../reports/ui-layout/compact-${info.project.name}-${width}.png`, fullPage: false });
});
test('category selection is visible after a deep link, reload and keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await sixCategories(page);
  await page.goto('/catalog?category=many-5');
  const row = page.locator('.catalog-categories'), last = row.getByRole('button', { name: 'Thiếu nhi', exact: true });
  await expect(last).toHaveAttribute('aria-pressed', 'true');
  const visible = () => last.evaluate(button => { const r = button.getBoundingClientRect(), bounds = button.parentElement!.getBoundingClientRect(); return r.left >= bounds.left - 1 && r.right <= bounds.right + 1; });
  await expect.poll(visible).toBe(true); await page.reload(); await expect.poll(visible).toBe(true);
  await row.getByRole('button', { name: 'Tất cả', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.book-card:not([aria-hidden])')).toHaveCount(12);
  for (let step = 0; step < 6; step++) await page.keyboard.press('Tab');
  await expect(last).toBeFocused(); await page.keyboard.press('Enter'); await expect(last).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.book-card:not([aria-hidden])')).toHaveCount(1);
});
