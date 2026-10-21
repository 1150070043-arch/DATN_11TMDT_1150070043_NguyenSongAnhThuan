import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('wishlist persists after reload and account sections remain accessible', async ({page}) => {
  await login(page);
  const loaded = page.waitForResponse(response => response.url().endsWith('/api/profile/wishlist') && response.ok());
  await page.goto('/books/clean-code', {waitUntil:'domcontentloaded'});
  await loaded;
  const heart = page.getByRole('button', { name:/^(Lưu sách yêu thích|Bỏ yêu thích)$/ });
  await expect(heart).toBeVisible();
  await expect(heart).toBeEnabled();
  // Wait for the current saved state before toggling; restore it at the end.
  const originallySaved = await heart.getAttribute('aria-pressed') === 'true';
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed',String(!originallySaved));
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('header').getByRole('button',{name:'Đăng xuất',exact:true})).toBeVisible();
  await expect(heart).toBeEnabled();
  await expect(heart).toHaveAttribute('aria-pressed',String(!originallySaved));
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed',String(originallySaved));
  await page.goto('/profile', {waitUntil:'domcontentloaded'});
  for (const tab of ['Mật khẩu','Địa chỉ','Bảo mật','Đơn hàng']) {
    await page.locator('main').getByRole('button',{name:tab,exact:true}).click();
    await expect(page.getByRole('heading',{name:'Cài đặt',exact:true})).toBeVisible();
  }
  await expect(page.locator('main').getByRole('button', { name: 'Thông báo', exact: true })).toHaveCount(0);
});
