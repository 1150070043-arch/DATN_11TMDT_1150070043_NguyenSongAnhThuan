import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BOOKGUARD_WEB_URL ?? 'http://localhost:5174';
const dir = 'UI/figma-match';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const report = { errors: [], failedRequests: [], pages: [], comparisons: [] };
async function makePage() {
  const context = await browser.newContext({ viewport:{width:1440,height:900}, reducedMotion:'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 400 && !response.url().includes('/auth/me') && !response.url().includes('/auth/refresh')) report.failedRequests.push({url:response.url(),status:response.status()}); });
  return page;
}
async function shot(page, name, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.screenshot({ path:dir + '/' + name + '.png', fullPage });
  const info = await page.evaluate(() => ({
    overflow:document.documentElement.scrollWidth > innerWidth + 1,
    headings:[...document.querySelectorAll('h1,h2')].filter(el => el.checkVisibility() && el.getBoundingClientRect().top < innerHeight).map(el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { text:el.textContent, x:r.x, y:r.y, width:r.width, height:r.height, font:s.fontFamily, size:s.fontSize, weight:s.fontWeight, color:s.color }; }),
    brokenImages:[...document.images].filter(img => img.complete && !img.naturalWidth && getComputedStyle(img).display !== 'none').map(img => img.src)
  }));
  report.pages.push({name,...info}); console.log(name, JSON.stringify(info.headings), 'overflow', info.overflow);
}
async function open(page, path, name, full=false) {
  if (page.url().startsWith(base+'/')) await page.evaluate(path => { history.pushState(null,'',path); dispatchEvent(new PopStateEvent('popstate')); }, path);
  else await page.goto(base + path, {waitUntil:'domcontentloaded'});
  if (path === '/catalog') await page.locator('.book-card').first().waitFor({state:'visible'});
  await shot(page,name,full);
}
async function login(page, role='customer') {
  await page.goto(base + '/login', {waitUntil:'domcontentloaded'});
  await page.getByLabel('Email',{exact:true}).fill(role === 'admin' ? 'admin@bookguard.local' : 'customer.a@bookguard.local');
  await page.getByLabel('Mật khẩu',{exact:true}).fill(role === 'admin' ? 'Admin@12345' : 'Customer@123');
  await page.locator('form').getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await page.waitForURL(base + '/');
}
try {
  const actual = await makePage();
  for (const [path,name] of [['/','home'],['/login','login'],['/register','register'],['/forgot-password','forgot'],['/catalog','catalog'],['/books/clean-code','detail'],['/verify-email','verify'],['/reset-password','reset'],['/not-found','404']]) await open(actual,path,'actual-'+name);
  const reference = await makePage();
  await reference.goto('http://127.0.0.1:4175', {waitUntil:'domcontentloaded'}); await shot(reference,'reference-home');
  await reference.locator('header').getByRole('button',{name:'Đăng nhập',exact:true}).click(); await shot(reference,'reference-login');
  await reference.getByRole('button',{name:'Đăng ký ngay',exact:true}).click(); await shot(reference,'reference-register');
  await reference.locator('header').getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await reference.getByRole('button',{name:'Quên mật khẩu?',exact:true}).click(); await shot(reference,'reference-forgot');
  await reference.locator('header').getByRole('button',{name:'Sách',exact:true}).click(); await shot(reference,'reference-catalog');
  await reference.locator('.book-card').filter({hasText:'Clean Code'}).click({position:{x:30,y:30}}); await reference.evaluate(()=>window.scrollTo(0,0)); await shot(reference,'reference-detail');
  await reference.locator('header').getByRole('button',{name:'Quản trị',exact:true}).click(); await shot(reference,'reference-admin-overview');
  for (const [label,name] of [['Đơn hàng','orders'],['Sách','books'],['Tồn kho','inventory'],['Thể loại','categories'],['Tài khoản','accounts'],['Sự kiện bảo mật','security'],['Nhật ký','audit']]) {
    await reference.locator('aside').getByRole('button',{name:label,exact:true}).click(); await shot(reference,'reference-admin-'+name);
  }
  const admin = await makePage(); await login(admin,'admin'); await open(admin,'/admin','actual-admin-overview');
  for (const [label,name] of [['Đơn hàng','orders'],['Sách','books'],['Tồn kho','inventory'],['Thể loại','categories'],['Tài khoản','accounts'],['Sự kiện bảo mật','security'],['Nhật ký','audit']]) {
    await admin.locator('aside').getByRole('button',{name:label,exact:true}).click(); await shot(admin,'actual-admin-'+name);
  }
  await admin.locator('aside').getByRole('button',{name:'Sách',exact:true}).click();
  await admin.getByRole('button',{name:'+ Thêm đầu sách',exact:true}).click(); await shot(admin,'actual-admin-book-form');
  await admin.getByRole('button',{name:'Đóng',exact:true}).click();
  const customer = await makePage(); await login(customer);
  await open(customer,'/profile','actual-profile');
  for (const [label,name] of [['Mật khẩu','password'],['Địa chỉ','address'],['Thông báo','notifications'],['Bảo mật','sessions'],['Đơn hàng','orders']]) {
    await customer.locator('main').getByRole('button',{name:label,exact:true}).click(); await shot(customer,'actual-profile-'+name);
  }
  await open(customer,'/orders','actual-orders');
  await open(customer,'/wishlist','actual-wishlist');
  await customer.goto(base+'/books/clean-code', {waitUntil:'domcontentloaded'});
  await customer.getByRole('button',{name:'Thêm vào giỏ hàng',exact:true}).click();
  await customer.getByText(/Đã thêm "Clean Code"/).waitFor();
  await open(customer,'/cart','actual-cart'); await open(customer,'/checkout','actual-checkout',true);
  await customer.setViewportSize({width:390,height:844});
  for (const [path,name] of [['/','home'],['/catalog','catalog'],['/books/clean-code','detail'],['/cart','cart'],['/checkout','checkout'],['/profile','profile'],['/orders','orders']]) await open(customer,path,'mobile-'+name);
  await admin.setViewportSize({width:390,height:844}); await open(admin,'/admin','mobile-admin');
  for (const name of ['home','login','register','forgot','catalog','detail','admin-overview','admin-books','admin-categories','admin-accounts','admin-inventory','admin-security']) {
    const a = report.pages.find(p=>p.name==='actual-'+name), r=report.pages.find(p=>p.name==='reference-'+name);
    report.comparisons.push({name, actual:a?.headings, reference:r?.headings});
  }
} finally { await writeFile(dir+'/report.json', JSON.stringify(report,null,2)); await browser.close(); }
