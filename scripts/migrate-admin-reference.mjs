// Mechanical migration: keep existing API actions/dialogs; replace layout with ZIP components.
import fs from 'node:fs';
const file = 'apps/web/src/pages/AdminPage.tsx';
let source = fs.readFileSync(file, 'utf8');
source = source.replace('useEffect, useMemo, useState', 'useEffect, useState');
source = source.replace('import { AdminCharts, type DashboardInsights }', 'import { type DashboardInsights }');
source = source.replace('import { InventoryPanel } from "../components/admin/InventoryPanel";', 'import { InventoryPanel } from "../components/admin/InventoryPanel";\nimport * as D from "../design/Reference";\nimport { toDesign } from "../design/Runtime";');
for (const name of ['book', 'order', 'user']) source = source.replace(new RegExp(`  const \\[${name}Query, set${name[0].toUpperCase()+name.slice(1)}Query\\] = useState\\(""\\);\\r?\\n`), '');
source = source.replace(/  const visibleBooks = useMemo\([\s\S]*?  async function updateStatus/, '  async function updateStatus');
source = source.replace('if (loading) return <div className="page-loading">Đang tải trang quản trị…</div>;', 'if (loading) return <div className="pt-32 px-8">Đang tải trang quản trị…</div>;');
const start = source.indexOf('    <div className="container py-5 admin-page">');
const end = source.indexOf('      {showBookForm && (', start);
if (start < 0 || end < 0) throw Error('Expected admin layout boundaries');
source = source.slice(0, start) + `    <D.DataCtx.Provider value={{
      books: books.map(toDesign),
      categories: categories.map(category => ({ id: category.slug, name: category.name, count: category.bookCount, img: '', color: '' })),
      orders: orders.map(order => ({ id: order.id, customer: order.customerName, date: dateTime.format(new Date(order.createdAt)), status: statusLabel[order.status], total: Number(order.totalAmount), items: order.items?.map(item => item.bookTitle + ' × ' + item.quantity).join(', ') ?? 'Xem chi tiết đơn hàng' })),
      accounts: users.map(user => ({ name: user.fullName, email: user.email, role: user.role, verified: user.emailVerified, status: user.isActive ? 'Hoạt động' : 'Đã khóa', created: user.createdAt })),
      events: events.map(event => ({ time: dateTime.format(new Date(event.createdAt)), event: event.eventType, id: event.requestId, level: event.severity, request: [event.method, event.path].filter(Boolean).join(' '), detail: event.details ?? '' }))
    }}>
      <D.AdminPanel activeTab={({ users: 'accounts', coupons: 'offers', comparison: 'security-compare', security: 'security-events' } as Record<string, D.AdminTab>)[tab] ?? tab as D.AdminTab} onTabChange={next => setTab((({ accounts: 'users', offers: 'coupons', 'security-compare': 'comparison', 'security-events': 'security' } as Record<string, typeof tab>)[next] ?? next) as typeof tab)} syncLabel={error ? 'Có lỗi đồng bộ' : refreshing ? 'Đang đồng bộ…' : 'Dữ liệu đã đồng bộ'}>
        {error && <div role="alert" className="border border-red-900 bg-red-900/20 text-red-300 p-4 mb-6">{error}</div>}
        {tab === 'overview' && <D.AdminOverview summary={dashboard?.summary} />}
        {tab === 'orders' && <D.AdminOrders onOpen={id => void openOrder(id)} />}
        {tab === 'books' && <D.AdminBooks onCreate={openCreateBook} onEdit={id => { const book = books.find(item => item.id === id); if (book) openEditBook(book); }} />}
        {tab === 'inventory' && <InventoryPanel referenceLayout onChanged={loadAll} />}
        {tab === 'categories' && <D.AdminCategories onCreate={openCreateCategory} onEdit={slug => { const category = categories.find(item => item.slug === slug); if (category) openEditCategory(category); }} onRemove={slug => { const category = categories.find(item => item.slug === slug); if (category) void removeCategory(category); }} />}
        {tab === 'users' && <D.AdminAccounts onStatus={email => { const user = users.find(item => item.email === email); if (user) void setUserStatus(user); }} />}
        {tab === 'security' && <D.AdminSecurityEvents />}
        {tab === 'audit' && <>{auditEvents.length === 0 ? <D.AdminAudit /> : <div><h2 className="font-display text-3xl text-[#ede7dc] font-medium mb-8">Nhật ký quản trị</h2><div className="bg-[#131110] border border-[#22201d] rounded-sm overflow-auto"><div className="min-w-[600px]">{auditEvents.map(event => <div key={event.id} className="table-row grid grid-cols-4 gap-4 px-6 py-4 text-xs text-[#7a6f64] font-mono"><div>{dateTime.format(new Date(event.createdAt))}</div><div>{event.adminName}</div><div className="text-[#ede7dc]">{event.action}</div><div>{event.entityType} {event.entityId}</div></div>)}</div></div></div>}</>}
        <div className="legacy-ui">
          {tab === 'coupons' && <CouponsPanel />}
          {tab === 'experiments' && <ExperimentDashboard />}
          {tab === 'comparison' && <SecurityComparison report={securityReport} />}
        </div>
      </D.AdminPanel>
      <div className="legacy-ui reference-dialogs">
` + source.slice(end);
const footer = source.indexOf('\nfunction OrdersTable(');
const compare = source.indexOf('\nfunction SecurityComparison(');
source = source.slice(0,footer).replace('    </div>\n  );\n}', '    </div>\n    </D.DataCtx.Provider>\n  );\n}') + source.slice(compare);
// Handle original Windows line endings at the outer closing tag.
if (!source.includes('</D.DataCtx.Provider>')) source = source.replace('    </div>\r\n  );\r\n}', '    </div>\r\n    </D.DataCtx.Provider>\r\n  );\r\n}');
fs.writeFileSync(file, source);
