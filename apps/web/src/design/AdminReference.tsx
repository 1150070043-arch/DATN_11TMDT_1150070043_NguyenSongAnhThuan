import { useState, useEffect, useContext, useMemo, type ReactNode } from 'react'
import { useAuth as useSession } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'

import { DataCtx, fmt, statusColor, levelColor, type AdminTab } from './Reference'
export { DataCtx, type AdminTab } from './Reference'

export function AdminPanel({ activeTab, onTabChange, children, syncLabel = 'Dữ liệu đã đồng bộ' }: { activeTab?: AdminTab; onTabChange?: (tab: AdminTab) => void; children?: ReactNode; syncLabel?: string }) {
  const [internalTab, setInternalTab] = useState<AdminTab>('overview')
  const tab = activeTab ?? internalTab
  const setTab = onTabChange ?? setInternalTab
  const { user, logout } = useSession()
  const navigate = useNavigate()

  const [theme, setTheme] = useState<'dark' | 'light' | 'midnight'>(() => {
    return (localStorage.getItem('bookguard_admin_theme') as 'dark' | 'light' | 'midnight') || 'dark'
  })

  useEffect(() => {
    localStorage.setItem('bookguard_admin_theme', theme)
    document.documentElement.setAttribute('data-admin-theme', theme)
  }, [theme])

  const businessTabs: [AdminTab, string, string][] = [
    ['overview', 'Tổng quan', 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'],
    ['orders', 'Đơn hàng', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'],
    ['books', 'Kho sách', 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'],
    ['inventory', 'Tồn kho', 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'],
    ['categories', 'Thể loại', 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z'],
    ['offers', 'Ưu đãi & Voucher', 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z'],
    ['accounts', 'Người dùng', 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'],
  ]

  const securityTabs: [AdminTab, string, string, string?][] = [
    ['security-compare', 'Đối chiếu an ninh', 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', 'BÁO CÁO'],
    ['security-events', 'Sự kiện bảo mật', 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', 'LIVE'],
    ['audit', 'Nhật ký kiểm toán', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'],
    ['experiments', 'Đo tải & Benchmark', 'M13 10V3L4 14h7v7l9-11h-7z'],
  ]

  return (
    <div className={`reference-admin theme-${theme} h-screen w-screen overflow-hidden flex flex-col font-opensans relative`}>
      {/* Dynamic Ambient Aurora Background (Breathing motion and multi-layered depth) */}
      <div className="admin-ambient-aurora">
        <div className="aurora-orb-1" />
        <div className="aurora-orb-2" />
        <div className="aurora-orb-3" />
      </div>

      {/* Top Dedicated Admin Header: 64px, modern sleek obsidian/light bar */}
      <header className="h-16 shrink-0 border-b border-slate-800/80 bg-[#0b101c] px-6 flex items-center justify-between z-30 shadow-md relative">
        <div className="flex items-center gap-4">
          <BrandMark />
          <div>
            <div className="font-bold text-base text-white leading-tight flex items-center gap-2">
              <span>Thất Tịnh</span>
              <span className="text-slate-600 font-normal">/</span>
              <span className="text-slate-400 font-medium text-xs">Admin Portal</span>
            </div>
          </div>
          <span className="ml-3 hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase">
            {import.meta.env.VITE_SECURITY_MODE === 'secure' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                SECURE · 6 LỚP
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                BASELINE · ĐỐI CHỨNG
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* THEME TOGGLE: DARK / LIGHT / MIDNIGHT (Equal pure icon buttons) */}
          <div className="flex items-center bg-[#060a14]/90 border border-slate-800 rounded-xl p-1 gap-1 theme-switcher-group shadow-inner">
            <button
              type="button"
              title="Giao diện Tối"
              aria-label="Giao diện Tối"
              onClick={() => setTheme('dark')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer text-sm shrink-0 ${
                theme === 'dark'
                  ? 'bg-amber-400/20 text-amber-300 font-bold border border-amber-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-sm select-none" aria-hidden="true">🌙</span>
            </button>
            <button
              type="button"
              title="Giao diện Sáng"
              aria-label="Giao diện Sáng"
              onClick={() => setTheme('light')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer text-sm shrink-0 ${
                theme === 'light'
                  ? 'bg-amber-500/20 text-amber-500 font-bold border border-amber-500/40 shadow-sm active-light'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-sm select-none" aria-hidden="true">☀️</span>
            </button>
            <button
              type="button"
              title="Giao diện Cyber"
              aria-label="Giao diện Cyber"
              onClick={() => setTheme('midnight')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer text-sm shrink-0 ${
                theme === 'midnight'
                  ? 'bg-sky-400/20 text-sky-300 font-bold border border-sky-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-sm select-none" aria-hidden="true">🌌</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium text-slate-300">{syncLabel}</span>
          </div>

          <div className="flex items-center gap-3.5 pl-4 border-l border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-slate-850 border border-slate-700/80 flex items-center justify-center font-mono text-xs font-bold text-amber-400">
              AD
            </div>
            <span className="text-sm font-semibold text-slate-200 hidden sm:inline">{user?.fullName || 'Quản trị viên'}</span>
            <button
              type="button"
              onClick={() => { void logout().then(() => navigate('/login')) }}
              className="text-xs font-mono text-slate-400 hover:text-rose-400 transition-colors cursor-pointer ml-1 font-semibold"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* Body: Slim Fixed Sidebar + Scrollable Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Sidebar: 256px wide, sleek dark obsidian */}
        <aside className="w-64 h-full shrink-0 border-r border-slate-800/80 bg-[#0b101c] flex flex-col overflow-y-auto select-none">
          <nav className="flex-1 py-4 space-y-6">
            {/* Section 1: Business Operations */}
            <div>
              <div className="px-4 mb-2 text-[11px] tracking-wider text-slate-500 uppercase font-mono font-bold">
                Vận hành
              </div>
              <div className="space-y-1">
                {businessTabs.map(([t, label, icon]) => (
                  <button
                    key={t}
                    aria-current={tab === t ? 'page' : undefined}
                    onClick={() => setTab(t)}
                    className={`sidebar-link w-full flex items-center gap-3 px-3.5 py-2 text-sm transition-all text-left cursor-pointer rounded-lg mx-2 ${
                      tab === t
                        ? 'active text-white bg-[#162036] font-semibold'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                    }`}
                  >
                    <svg
                      className={`shrink-0 transition-colors ${tab === t ? 'text-amber-400' : 'text-slate-400'}`}
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Section 2: Security & Defense Center */}
            <div className="pt-4 border-t border-slate-800/80">
              <div className="px-4 mb-2 flex items-center justify-between text-[11px] tracking-wider text-slate-500 uppercase font-mono font-bold">
                <span>An ninh & Kiểm toán</span>
              </div>
              <div className="space-y-1">
                {securityTabs.map(([t, label, icon, badge]) => (
                  <button
                    key={t}
                    aria-current={tab === t ? 'page' : undefined}
                    onClick={() => setTab(t)}
                    className={`sidebar-link w-full flex items-center justify-between px-3.5 py-2 text-sm transition-all text-left cursor-pointer rounded-lg mx-2 ${
                      tab === t
                        ? 'active text-white bg-[#162036] font-semibold'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <svg
                        className={`shrink-0 transition-colors ${tab === t ? 'text-amber-400' : 'text-slate-400'}`}
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                      </svg>
                      <span className="truncate">{label}</span>
                    </div>
                    {badge && (
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold flex items-center gap-1.5 ${
                        badge.includes('10/10')
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : badge === 'LIVE'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        {badge === 'LIVE' && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                          </span>
                        )}
                        {badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </nav>
        </aside>

        {/* Main Content Area: SCROLLABLE INDEPENDENTLY & FULL WIDTH with Tab Animation */}
        <main className="flex-1 h-full overflow-y-auto bg-[#090d16] relative z-10">
          <div key={tab} className="admin-tab-content p-6 md:p-8 lg:p-10 w-full max-w-none">
            {children ?? <>
            {tab === 'overview' && <AdminOverview />}
            {tab === 'orders' && <AdminOrders />}
            {tab === 'books' && <AdminBooks />}
            {tab === 'categories' && <AdminCategories />}
            {tab === 'accounts' && <AdminAccounts />}
            {tab === 'security-events' && <AdminSecurityEvents />}
            {tab === 'inventory' && <AdminInventory />}
            {tab === 'audit' && <AdminAudit />}
            </>}
          </div>
        </main>
      </div>
    </div>
  )
}

export function AdminOverview({ summary, onOpenOrder }: { summary?: { orders: number; revenue: number; books: number; customers: number; pendingOrders: number }; onOpenOrder?: (id: number) => void }) {
  const { orders: ORDERS, categories } = useContext(DataCtx)
  const stats = [
    { label: 'Tổng đơn hàng', value: String(summary?.orders ?? 0), delta: `${summary?.pendingOrders ?? 0} chờ xử lý`, color: 'text-white' },
    { label: 'Doanh thu', value: fmt(Number(summary?.revenue ?? 0)), delta: 'Đã hoàn tất', color: 'text-amber-400' },
    { label: 'Đầu sách', value: String(summary?.books ?? 0), delta: `${categories.length} danh mục`, color: 'text-white' },
    { label: 'Khách hàng', value: String(summary?.customers ?? 0), delta: 'Đã đăng ký', color: 'text-white' },
  ]
  return (
    <div className="w-full space-y-6 text-slate-100 font-opensans">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Tổng quan kinh doanh</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {stats.map(s => (
          <div key={s.label} className="admin-card-hover bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/90 rounded-xl p-4 shadow-sm cursor-default">
            <div className="text-[11px] text-slate-400 font-mono mb-1.5 uppercase tracking-wider font-semibold">{s.label}</div>
            <div className={`text-xl sm:text-2xl 2xl:text-3xl font-bold font-mono mb-1 tracking-tight truncate whitespace-nowrap leading-snug ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-slate-500 font-mono">{s.delta}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-3.5 border-b border-slate-800/80 bg-[#090d16] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Giao dịch gần đây</h3>
          <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-800">
            {ORDERS.length} đơn hàng
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#090d16] text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-3 px-4 w-24">Mã đơn</th>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4 w-36">Thời gian</th>
                <th className="py-3 px-4 w-32 text-center">Trạng thái</th>
                <th className="py-3 px-4 w-36 text-right">Tổng tiền</th>
                <th className="py-3 px-4 w-24 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {ORDERS.slice(0, 6).map(o => (
                <tr
                  key={o.id}
                  onClick={() => onOpenOrder?.(o.id)}
                  className="hover:bg-slate-900/50 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4 font-mono font-bold text-amber-400">
                    <span className="bg-amber-400/10 border border-amber-400/25 px-1.5 py-0.5 rounded text-[11px]">#{o.id}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-100 font-medium text-xs sm:text-sm">{o.customer}</td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-400 whitespace-nowrap">{o.date}</td>
                  <td className="py-3 px-4 text-center"><span className={`badge ${statusColor(o.status)}`}>{o.status}</span></td>
                  <td className="py-3 px-4 text-right font-mono text-xs sm:text-sm font-bold text-amber-400 whitespace-nowrap">{fmt(o.total)}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onOpenOrder?.(o.id) }}
                      className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:border-amber-400 transition-colors cursor-pointer"
                    >
                      Chi tiết →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function AdminOrders({ onOpen }: { onOpen?: (id: number) => void }) {
  const { orders: ORDERS } = useContext(DataCtx)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [modalOrder, setModalOrder] = useState<typeof ORDERS[0] | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'details' | 'grid'>('details')
  const [sortBy, setSortBy] = useState<'id' | 'total' | 'date'>('id')
  const [sortAsc, setSortAsc] = useState(false)

  const statusOptions = [
    { key: 'all', label: 'Tất cả' },
    { key: 'Chờ xác nhận', label: 'Chờ xác nhận' },
    { key: 'Đang xử lý', label: 'Đang xử lý' },
    { key: 'Đang giao', label: 'Đang giao' },
    { key: 'Hoàn tất', label: 'Hoàn tất' },
    { key: 'Đã hủy', label: 'Đã hủy' },
  ]

  const totalRevenue = useMemo(() => {
    return ORDERS.filter(o => o.status !== 'Đã hủy').reduce((acc, o) => acc + o.total, 0)
  }, [ORDERS])

  const pendingCount = useMemo(() => {
    return ORDERS.filter(o => o.status === 'Chờ xác nhận' || o.status === 'Đang xử lý').length
  }, [ORDERS])

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = ORDERS.filter(o => {
      const matchStatus = statusFilter === 'all' || o.status === statusFilter
      const matchQuery = !q || (
        String(o.id).includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.items.toLowerCase().includes(q) ||
        o.date.toLowerCase().includes(q)
      )
      return matchStatus && matchQuery
    })

    list.sort((a, b) => {
      if (sortBy === 'total') {
        return sortAsc ? a.total - b.total : b.total - a.total
      } else if (sortBy === 'date') {
        return sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
      } else {
        return sortAsc ? a.id - b.id : b.id - a.id
      }
    })

    return list
  }, [ORDERS, query, statusFilter, sortBy, sortAsc])

  const selectedOrder = useMemo(() => {
    return ORDERS.find(o => o.id === selectedId) || null
  }, [ORDERS, selectedId])

  const handleOpenDetail = (id: number) => {
    if (onOpen) {
      onOpen(id)
    } else {
      const found = ORDERS.find(o => o.id === id)
      if (found) setModalOrder(found)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Hoàn tất':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
      case 'Đang giao':
        return 'bg-sky-500/10 text-sky-400 border border-sky-500/25'
      case 'Đã xác nhận':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/25'
      case 'Đang xử lý':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/25'
      case 'Chờ xác nhận':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
      case 'Đã hủy':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
    }
  }

  return (
    <div className="w-full space-y-4 font-opensans text-slate-100 select-none">
      {/* 1. TOP BREADCRUMB ADDRESS BAR & SEARCH / CONTROLS */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Breadcrumbs */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            disabled={statusFilter === 'all' && !query}
            onClick={() => { setStatusFilter('all'); setQuery(''); }}
            title={statusFilter !== 'all' || query ? "Quay lại danh sách tất cả đơn" : "Đang ở thư mục gốc"}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              statusFilter !== 'all' || query
                ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 border border-amber-400/30 cursor-pointer shadow-sm font-bold'
                : 'text-slate-600 bg-slate-900/40 border border-slate-800/60 cursor-not-allowed opacity-40 font-bold'
            }`}
          >
            ←
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#090d16] border border-slate-800 rounded-lg text-xs font-medium flex-1 overflow-x-auto whitespace-nowrap scrollbar-none">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span>📁</span>
              <span>Đơn hàng</span>
            </span>
            <span className="text-slate-600 font-bold select-none">›</span>

            <button
              type="button"
              onClick={() => { setStatusFilter('all'); setQuery(''); }}
              className={`hover:text-amber-400 px-1 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'all' ? 'text-amber-400 font-semibold' : 'text-slate-300'
              }`}
            >
              <span>📦</span>
              <span>Tất cả đơn ({ORDERS.length})</span>
            </button>

            {statusFilter !== 'all' && (
              <>
                <span className="text-slate-600 font-bold select-none">›</span>
                <span className="text-amber-300 font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 flex items-center gap-1.5">
                  <span>🏷️</span>
                  <span className="truncate max-w-[200px]">{statusFilter}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Search + Status dropdown */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-60">
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Mã đơn, khách hàng..."
              className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#090d16] border border-slate-700/80 text-slate-200 px-2.5 py-1.5 text-xs rounded-lg focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            {statusOptions.map(st => {
              const count = st.key === 'all' ? ORDERS.length : ORDERS.filter(o => o.status === st.key).length
              return (
                <option key={st.key} value={st.key}>
                  {st.label} ({count})
                </option>
              )
            })}
          </select>
        </div>
      </div>

      {/* 2. SMART CONTEXT ACTION BAR (Hiển thị thao tác khi chọn đơn - Tuyệt đối không cần cột Thao tác) */}
      <div className={`rounded-xl border p-2.5 transition-all flex flex-wrap items-center justify-between gap-2.5 ${
        selectedOrder
          ? 'bg-amber-400/10 border-amber-400/40 shadow-md ring-1 ring-amber-400/20'
          : 'bg-[#0f172a]/50 border-slate-800'
      }`}>
        {selectedOrder ? (
          /* ACTIVE SELECTION ACTIONS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-xs">✓</span>
              <span className="text-xs text-slate-300">Đã chọn đơn:</span>
              <span className="text-xs font-mono font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30">
                #{selectedOrder.id}
              </span>
              <span className="text-xs font-semibold text-white">{selectedOrder.customer}</span>
              <span className="text-xs font-mono font-bold text-amber-400">{fmt(selectedOrder.total)}</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getStatusBadge(selectedOrder.status)}`}>
                {selectedOrder.status}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleOpenDetail(selectedOrder.id)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-all cursor-pointer shadow-md"
              >
                <span>🔍</span>
                <span>Xem chi tiết đơn hàng</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedId(null)}
                title="Bỏ chọn"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs ml-1"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* IDLE SUMMARY & CONTROLS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap text-xs text-slate-400">
            <div className="flex items-center gap-3 flex-wrap">
              <span>📦 Tổng <strong className="text-white font-mono">{filteredOrders.length}</strong> đơn</span>
              <span>💰 Doanh thu: <strong className="text-amber-400 font-mono">{fmt(totalRevenue)}</strong></span>
              <span>⏳ <strong className="text-amber-400 font-mono">{pendingCount}</strong> cần xử lý</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline italic">Nhấp dòng để chọn · Nhấp đúp để xem chi tiết</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Sort */}
              <button
                type="button"
                onClick={() => {
                  if (sortBy === 'id') {
                    if (!sortAsc) setSortAsc(true)
                    else { setSortBy('total'); setSortAsc(false); }
                  } else if (sortBy === 'total') {
                    if (!sortAsc) setSortAsc(true)
                    else { setSortBy('id'); setSortAsc(false); }
                  } else {
                    setSortBy('id'); setSortAsc(false);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer transition-colors text-xs"
                title="Đổi thứ tự sắp xếp"
              >
                <span>↕</span>
                <span>Sắp xếp:</span>
                <span className="text-amber-400 font-mono font-bold">
                  {sortBy === 'id' ? (sortAsc ? 'Mã đơn ↑' : 'Mới nhất') : (sortAsc ? 'Giá tăng dần' : 'Giá cao nhất')}
                </span>
              </button>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('details')}
                  className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                    viewMode === 'details' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Hiển thị dạng Danh sách"
                >
                  ▦ Danh sách
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                    viewMode === 'grid' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Hiển thị dạng Thẻ"
                >
                  ⊞ Thẻ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. MAIN CONTENT: TABLE OR GRID (NO ACTION COLUMN - ZERO RADIO DOTS) */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {viewMode === 'details' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#090d16] text-slate-400 font-semibold text-[11px] border-b border-slate-800 select-none">
                  <th className="py-2.5 px-4 w-24">Mã đơn</th>
                  <th className="py-2.5 px-4">Khách hàng & Sản phẩm</th>
                  <th className="py-2.5 px-4 w-36">Ngày đặt</th>
                  <th className="py-2.5 px-4 w-36 text-center">Trạng thái</th>
                  <th className="py-2.5 px-4 w-36 text-right">Tổng tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-14 text-center text-slate-500 font-mono">
                      Không tìm thấy đơn hàng nào phù hợp với điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(o => {
                    const isSelected = selectedId === o.id
                    return (
                      <tr
                        key={o.id}
                        onClick={() => setSelectedId(isSelected ? null : o.id)}
                        onDoubleClick={() => handleOpenDetail(o.id)}
                        className={`transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-amber-400/15 text-white border-l-4 border-amber-400 shadow-sm'
                            : 'hover:bg-slate-800/40 text-slate-200'
                        }`}
                        title="Nhấp để chọn · Nhấp đúp để mở chi tiết"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">
                          <button type="button" aria-label={`Chi tiết đơn ${o.id}`}
                            onClick={event => { event.stopPropagation(); handleOpenDetail(o.id); }}
                            className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-xs hover:border-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
                            #{o.id}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className={`font-semibold text-sm ${isSelected ? 'text-amber-300' : 'text-slate-100'}`}>
                            {o.customer}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-md">
                            {o.items}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {o.date}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-medium ${getStatusBadge(o.status)}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs sm:text-sm font-bold text-amber-400 whitespace-nowrap">
                          {fmt(o.total)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* GRID / CARDS VIEW */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredOrders.length === 0 ? (
              <div className="col-span-full py-14 text-center text-slate-500 font-mono">
                Không tìm thấy đơn hàng nào phù hợp với điều kiện lọc.
              </div>
            ) : (
              filteredOrders.map(o => {
                const isSelected = selectedId === o.id
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedId(isSelected ? null : o.id)}
                    onDoubleClick={() => handleOpenDetail(o.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400/15 border-amber-400 shadow-md ring-1 ring-amber-400/30'
                        : 'bg-[#090d16] border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                    title="Nhấp để chọn · Nhấp đúp để mở chi tiết"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="font-mono font-bold text-amber-400 text-xs bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                        #{o.id}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getStatusBadge(o.status)}`}>
                        {o.status}
                      </span>
                    </div>
                    <div className={`font-semibold text-sm mb-1 ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                      {o.customer}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-2 mb-3 min-h-[32px]">
                      {o.items}
                    </div>
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80">
                      <span className="text-[11px] font-mono text-slate-500">{o.date}</span>
                      <span className="font-mono text-sm font-bold text-amber-400">{fmt(o.total)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* 4. ORDER DETAIL MODAL (Fallback when onOpen is not provided) */}
      {modalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setModalOrder(null)}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl text-slate-100 my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between pb-4 mb-5 border-b border-slate-800">
              <div>
                <div className="text-xs sm:text-sm tracking-wider text-amber-400 uppercase font-semibold mb-1">Quản lý đơn hàng · Chi tiết giao dịch</div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white">Đơn #{modalOrder.id}</h3>
              </div>
              <button onClick={() => setModalOrder(null)} className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-amber-400 flex items-center justify-center transition-colors cursor-pointer text-base">
                ✕
              </button>
            </div>
            <div className="space-y-3.5 mb-5">
              {[['Trạng thái', modalOrder.status], ['Ngày đặt', modalOrder.date], ['Người nhận', modalOrder.customer]].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center bg-[#090d16] border border-slate-800 px-4 py-2.5 rounded-lg text-sm">
                  <span className="text-xs sm:text-sm text-slate-400 uppercase font-medium">{k}</span>
                  <span className={`text-sm sm:text-base font-semibold ${k === 'Trạng thái' ? '' : 'text-slate-100'}`}>
                    {k === 'Trạng thái' ? <span className={`px-3 py-1 rounded text-xs sm:text-sm font-semibold ${getStatusBadge(v)}`}>{v}</span> : v}
                  </span>
                </div>
              ))}
            </div>
            <div className="bg-[#090d16] border border-slate-800 rounded-xl p-4 mb-5">
              <div className="text-xs sm:text-sm text-slate-400 mb-2 uppercase tracking-wider font-semibold">Sản phẩm</div>
              <div className="flex justify-between items-center text-sm sm:text-base">
                <span className="text-slate-100 font-semibold">{modalOrder.items}</span>
                <span className="text-amber-400 font-bold text-base sm:text-lg">{fmt(modalOrder.total)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center font-medium text-base sm:text-lg pt-4 border-t border-slate-800">
              <span className="text-slate-300 font-semibold">Tổng cộng:</span>
              <span className="text-amber-400 text-2xl sm:text-3xl font-extrabold">{fmt(modalOrder.total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminBooks({ onCreate, onEdit }: { onCreate?: () => void; onEdit?: (id: number) => void }) {
  const { books: BOOKS, categories: CATEGORIES } = useContext(DataCtx)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'details' | 'grid'>('details')
  const [sortBy, setSortBy] = useState<'title' | 'price' | 'stock'>('title')
  const [sortAsc, setSortAsc] = useState(true)

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = BOOKS.filter(b => {
      const matchCat = categoryFilter === 'all' || b.category === categoryFilter
      const matchQ = !q || (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q)
      )
      return matchCat && matchQ
    })

    list.sort((a, b) => {
      if (sortBy === 'title') {
        return sortAsc ? a.title.localeCompare(b.title, 'vi') : b.title.localeCompare(a.title, 'vi')
      } else if (sortBy === 'price') {
        return sortAsc ? a.price - b.price : b.price - a.price
      } else {
        return sortAsc ? a.stock - b.stock : b.stock - a.stock
      }
    })

    return list
  }, [BOOKS, query, categoryFilter, sortBy, sortAsc])

  const selectedBook = useMemo(() => {
    return BOOKS.find(b => b.id === selectedId) || null
  }, [BOOKS, selectedId])

  return (
    <div className="w-full space-y-4 font-opensans text-slate-100 select-none">
      {/* 1. TOP BREADCRUMB ADDRESS BAR & QUICK CONTROLS */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Breadcrumb Navigation */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            disabled={categoryFilter === 'all' && !query}
            onClick={() => { setCategoryFilter('all'); setQuery(''); }}
            title={categoryFilter !== 'all' ? "Quay lại toàn bộ kho sách" : "Đang ở thư mục gốc"}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              categoryFilter !== 'all' || query
                ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 border border-amber-400/30 cursor-pointer shadow-sm font-bold'
                : 'text-slate-600 bg-slate-900/40 border border-slate-800/60 cursor-not-allowed opacity-40 font-bold'
            }`}
          >
            ←
          </button>

          {/* Breadcrumb Path */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#090d16] border border-slate-800 rounded-lg text-xs font-medium flex-1 overflow-x-auto whitespace-nowrap scrollbar-none">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span>📁</span>
              <span>Kho sách</span>
            </span>
            <span className="text-slate-600 font-bold select-none">›</span>

            <button
              type="button"
              onClick={() => { setCategoryFilter('all'); setQuery(''); }}
              className={`hover:text-amber-400 px-1 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'all' ? 'text-amber-400 font-semibold' : 'text-slate-300'
              }`}
            >
              <span>📘</span>
              <span>Toàn bộ đầu sách</span>
            </button>

            {categoryFilter !== 'all' && (
              <>
                <span className="text-slate-600 font-bold select-none">›</span>
                <span className="text-amber-300 font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 flex items-center gap-1.5">
                  <span>📂</span>
                  <span className="truncate max-w-[200px]">{categoryFilter}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Search box, Category filter & Add button */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-56">
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tên sách, tác giả, ISBN..."
              className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-[#090d16] border border-slate-700/80 text-slate-200 px-2.5 py-1.5 text-xs rounded-lg focus:outline-none focus:border-amber-400"
          >
            <option value="all">Tất cả ({BOOKS.length})</option>
            {CATEGORIES.map(c => (
              <option key={c.id} value={c.name}>{c.name} ({c.count})</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onCreate?.()}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            <span>+</span>
            <span>Thêm sách</span>
          </button>
        </div>
      </div>

      {/* 2. SMART CONTEXT ACTION BAR (Thao tác khi chọn dòng - Không cần cột Thao tác) */}
      <div className={`rounded-xl border p-2.5 transition-all flex flex-wrap items-center justify-between gap-2.5 ${
        selectedBook
          ? 'bg-amber-400/10 border-amber-400/40 shadow-md ring-1 ring-amber-400/20'
          : 'bg-[#0f172a]/50 border-slate-800'
      }`}>
        {selectedBook ? (
          /* ACTIVE SELECTION ACTIONS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-xs">✓</span>
              <span className="text-xs text-slate-300">Đã chọn:</span>
              <span className="text-xs font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30">
                {selectedBook.title}
              </span>
              <span className="text-xs text-slate-400 font-mono">({selectedBook.author})</span>
              <span className="text-xs text-amber-400 font-mono font-bold">{fmt(selectedBook.price)}</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onEdit?.(selectedBook.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-amber-400/40"
              >
                <span>✏️</span>
                <span>Chỉnh sửa thông tin sách</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedId(null)}
                title="Bỏ chọn"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs ml-1"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* IDLE SUMMARY & CONTROLS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span>📚 Tổng số <strong className="text-white font-mono">{filteredBooks.length}</strong> đầu sách</span>
              <span>📂 <strong className="text-amber-400 font-mono">{CATEGORIES.length}</strong> thể loại</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline italic">Nhấp dòng để chọn · Nhấp đúp để chỉnh sửa</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Sort */}
              <button
                type="button"
                onClick={() => {
                  if (sortBy === 'title') {
                    if (sortAsc) setSortAsc(false)
                    else { setSortBy('price'); setSortAsc(true); }
                  } else if (sortBy === 'price') {
                    if (sortAsc) setSortAsc(false)
                    else { setSortBy('stock'); setSortAsc(false); }
                  } else {
                    setSortBy('title'); setSortAsc(true);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer transition-colors text-xs"
                title="Đổi thứ tự sắp xếp"
              >
                <span>↕</span>
                <span>Sắp xếp:</span>
                <span className="text-amber-400 font-mono font-bold">
                  {sortBy === 'title' ? (sortAsc ? 'Tên A → Z' : 'Tên Z → A') : sortBy === 'price' ? (sortAsc ? 'Giá tăng dần' : 'Giá giảm dần') : 'Tồn kho'}
                </span>
              </button>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('details')}
                  className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                    viewMode === 'details' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Hiển thị dạng Danh sách"
                >
                  ▦ Danh sách
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                    viewMode === 'grid' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Hiển thị dạng Lưới"
                >
                  ⊞ Lưới
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. MAIN CONTENT: TABLE OR GRID (NO ACTION COLUMN) */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {viewMode === 'details' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#090d16] text-slate-400 font-semibold text-[11px] border-b border-slate-800 select-none">
                  <th className="py-2.5 px-4">Sách & Tác giả</th>
                  <th className="py-2.5 px-4 w-36">Thể loại</th>
                  <th className="py-2.5 px-4 w-32 font-mono">ISBN</th>
                  <th className="py-2.5 px-4 w-28 text-center">Tồn kho</th>
                  <th className="py-2.5 px-4 w-36 text-right">Giá bán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredBooks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-14 text-center text-slate-500 font-mono">
                      Không tìm thấy đầu sách nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredBooks.map(b => {
                    const isSelected = selectedId === b.id
                    return (
                      <tr
                        key={b.id}
                        onClick={() => setSelectedId(isSelected ? null : b.id)}
                        onDoubleClick={() => onEdit?.(b.id)}
                        className={`transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-amber-400/15 text-white border-l-4 border-amber-400 shadow-sm'
                            : 'hover:bg-slate-800/40 text-slate-200'
                        }`}
                        title="Nhấp để chọn · Nhấp đúp để chỉnh sửa sách"
                      >
                        {/* Cover + Title & Author */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-12 shrink-0 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 relative flex items-center justify-center">
                              {b.cover ? (
                                <img
                                  src={b.cover}
                                  alt={b.title}
                                  className="w-full h-full object-cover relative z-10"
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                              ) : null}
                              <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-amber-400/60 select-none pointer-events-none">
                                {b.title.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className={`font-semibold text-sm ${isSelected ? 'text-amber-300' : 'text-slate-100'}`}>
                                {b.title}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{b.author}</div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700/80">
                            {b.category}
                          </span>
                        </td>

                        {/* ISBN */}
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">
                          {b.isbn || '—'}
                        </td>

                        {/* Stock */}
                        <td className="py-3 px-4 text-center">
                          {b.stock <= 10 ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/25">
                              {b.stock} (Sắp hết)
                            </span>
                          ) : (
                            <span className="font-mono text-xs font-semibold text-slate-200">{b.stock}</span>
                          )}
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 text-right font-mono text-xs sm:text-sm font-bold text-amber-400 whitespace-nowrap">
                          {fmt(b.price)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {filteredBooks.map(b => {
              const isSelected = selectedId === b.id
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedId(isSelected ? null : b.id)}
                  onDoubleClick={() => onEdit?.(b.id)}
                  className={`flex flex-col p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-amber-400/15 border-amber-400 shadow-md ring-1 ring-amber-400'
                      : 'bg-[#090d16] border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
                  }`}
                  title="Nhấp để chọn · Nhấp đúp để chỉnh sửa"
                >
                  <div className="w-full h-36 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 relative mb-2.5 flex items-center justify-center">
                    {b.cover ? (
                      <img
                        src={b.cover}
                        alt={b.title}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : null}
                    <span className="absolute font-mono text-lg font-bold text-amber-400/50">
                      {b.title.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="font-semibold text-xs text-white line-clamp-1">{b.title}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{b.author}</div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60">
                    <span className="font-mono text-xs font-bold text-amber-400">{fmt(b.price)}</span>
                    <span className="text-[10px] font-mono text-slate-400">Tồn: {b.stock}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


export function AdminCategories({ onCreate, onEdit, onRemove }: { onCreate?: () => void; onEdit?: (slug: string) => void; onRemove?: (slug: string) => void }) {
  const { categories: CATEGORIES, books: BOOKS } = useContext(DataCtx)
  const [showModal, setShowModal] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [openedSlug, setOpenedSlug] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'details' | 'grid'>('details')
  const [sortBy, setSortBy] = useState<'name' | 'count'>('name')
  const [sortAsc, setSortAsc] = useState(true)

  // Filter and sort categories
  const filteredCategories = useMemo(() => {
    let list = [...CATEGORIES]
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
    }
    list.sort((a, b) => {
      if (sortBy === 'name') {
        return sortAsc ? a.name.localeCompare(b.name, 'vi') : b.name.localeCompare(a.name, 'vi')
      } else {
        return sortAsc ? a.count - b.count : b.count - a.count
      }
    })
    return list
  }, [CATEGORIES, query, sortBy, sortAsc])

  // Total books count
  const totalBooks = useMemo(() => {
    return CATEGORIES.reduce((acc, c) => acc + c.count, 0) || BOOKS.length
  }, [CATEGORIES, BOOKS])

  // Selected category object
  const selectedCategory = useMemo(() => {
    return CATEGORIES.find(c => c.id === selectedSlug) || null
  }, [CATEGORIES, selectedSlug])

  // Opened category object
  const openedCategory = useMemo(() => {
    return CATEGORIES.find(c => c.id === openedSlug) || null
  }, [CATEGORIES, openedSlug])

  // Books inside opened category
  const booksInOpenedCategory = useMemo(() => {
    if (!openedSlug) return []
    const cat = CATEGORIES.find(c => c.id === openedSlug)
    if (!cat) return []
    let list = BOOKS.filter(b => b.category === cat.name || b.category.toLowerCase() === openedSlug.toLowerCase())
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
    }
    return list
  }, [openedSlug, CATEGORIES, BOOKS, query])

  return (
    <div className="w-full space-y-4 font-opensans text-slate-100 select-none">
      {/* 1. TOP BREADCRUMB ADDRESS BAR & QUICK CONTROLS */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Breadcrumb Navigation */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Back button (active when inside a category) */}
          <button
            type="button"
            disabled={!openedSlug}
            onClick={() => { setOpenedSlug(null); setQuery(''); }}
            title={openedSlug ? "Quay lại danh sách thể loại" : "Đang ở thư mục gốc"}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              openedSlug
                ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 border border-amber-400/30 cursor-pointer shadow-sm font-bold'
                : 'text-slate-600 bg-slate-900/40 border border-slate-800/60 cursor-not-allowed opacity-40 font-bold'
            }`}
          >
            ←
          </button>

          {/* Breadcrumb Path */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#090d16] border border-slate-800 rounded-lg text-xs font-medium flex-1 overflow-x-auto whitespace-nowrap scrollbar-none">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span>📁</span>
              <span>Kho sách</span>
            </span>
            <span className="text-slate-600 font-bold select-none">›</span>

            <button
              type="button"
              onClick={() => { setOpenedSlug(null); setQuery(''); }}
              className={`hover:text-amber-400 px-1 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                !openedSlug ? 'text-amber-400 font-semibold' : 'text-slate-300'
              }`}
            >
              <span>📂</span>
              <span>Thể loại</span>
            </button>

            {openedCategory && (
              <>
                <span className="text-slate-600 font-bold select-none">›</span>
                <span className="text-amber-300 font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 flex items-center gap-1.5">
                  <span>📘</span>
                  <span className="truncate max-w-[200px]">{openedCategory.name}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Search box & Add button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative w-full sm:w-60">
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={openedCategory ? `Tìm trong ${openedCategory.name}...` : "Tìm thể loại..."}
              className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          <button
            type="button"
            onClick={() => onCreate ? onCreate() : setShowModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            <span>+</span>
            <span>Thêm thể loại</span>
          </button>
        </div>
      </div>

      {/* 2. SMART CONTEXT ACTION BAR (Thao tác xuất hiện khi chọn thư mục - Tuyệt đối không cần cột Thao tác) */}
      <div className={`rounded-xl border p-2.5 transition-all flex flex-wrap items-center justify-between gap-2.5 ${
        selectedCategory && !openedSlug
          ? 'bg-amber-400/10 border-amber-400/40 shadow-md ring-1 ring-amber-400/20'
          : 'bg-[#0f172a]/50 border-slate-800'
      }`}>
        {selectedCategory && !openedSlug ? (
          /* ACTIVE SELECTION ACTIONS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-xs">✓</span>
              <span className="text-xs text-slate-300">Đã chọn:</span>
              <span className="text-xs font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30">
                {selectedCategory.name}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">({selectedCategory.count} đầu sách)</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Mở thư mục xem sách */}
              <button
                type="button"
                onClick={() => setOpenedSlug(selectedCategory.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer border border-slate-700"
              >
                <span>📂</span>
                <span>Mở xem sách</span>
              </button>

              {/* Sửa / Đổi tên */}
              <button
                type="button"
                onClick={() => onEdit?.(selectedCategory.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-amber-400/40"
              >
                <span>✏️</span>
                <span>Đổi tên & Sửa</span>
              </button>

              {/* Xóa */}
              <button
                type="button"
                onClick={() => onRemove?.(selectedCategory.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-rose-500/40"
              >
                <span>🗑️</span>
                <span>Xóa</span>
              </button>

              {/* Bỏ chọn */}
              <button
                type="button"
                onClick={() => setSelectedSlug(null)}
                title="Bỏ chọn"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs ml-1"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* IDLE SUMMARY & CONTROLS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap text-xs text-slate-400">
            <div className="flex items-center gap-3">
              {openedSlug ? (
                <div className="flex items-center gap-2 text-slate-300">
                  <span>📘 Danh sách sách trong thể loại:</span>
                  <span className="font-bold text-white">{openedCategory?.name}</span>
                  <span className="text-[11px] font-mono text-amber-400">({booksInOpenedCategory.length} sách)</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span>📁 Tổng số <strong className="text-white font-mono">{filteredCategories.length}</strong> thể loại</span>
                  <span>📚 <strong className="text-amber-400 font-mono">{totalBooks}</strong> đầu sách</span>
                  <span className="text-[11px] text-slate-500 hidden sm:inline italic">Nhấp dòng để chọn · Nhấp đúp để mở xem sách</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!openedSlug && (
                <>
                  {/* Sort */}
                  <button
                    type="button"
                    onClick={() => {
                      if (sortBy === 'name') {
                        if (sortAsc) setSortAsc(false)
                        else { setSortBy('count'); setSortAsc(false); }
                      } else {
                        setSortBy('name'); setSortAsc(true);
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer transition-colors text-xs"
                    title="Đổi thứ tự sắp xếp"
                  >
                    <span>↕</span>
                    <span>Sắp xếp:</span>
                    <span className="text-amber-400 font-mono font-bold">
                      {sortBy === 'name' ? (sortAsc ? 'A → Z' : 'Z → A') : 'Số sách ↓'}
                    </span>
                  </button>

                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('details')}
                      className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                        viewMode === 'details' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Hiển thị dạng Danh sách"
                    >
                      ▦ Danh sách
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                        viewMode === 'grid' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Hiển thị dạng Lưới thư mục"
                    >
                      ⊞ Lưới
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. MAIN CONTENT: TABLE OR GRID (Clean, full width, no duplicated menus or columns) */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {openedSlug ? (
          /* INSIDE OPENED CATEGORY: LIST OF BOOKS */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#090d16] text-slate-400 font-semibold text-[11px] border-b border-slate-800 select-none">
                  <th className="py-2.5 px-4 w-10"></th>
                  <th className="py-2.5 px-4">Tên tác phẩm</th>
                  <th className="py-2.5 px-4 w-48">Tác giả</th>
                  <th className="py-2.5 px-4 w-32 text-right">Giá bán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {/* Back to parent folder row */}
                <tr
                  onClick={() => { setOpenedSlug(null); setQuery(''); }}
                  className="hover:bg-slate-800/60 transition-colors cursor-pointer text-slate-400 group"
                >
                  <td className="py-2.5 px-4 text-center">
                    <span className="text-amber-400 group-hover:-translate-x-1 inline-block transition-transform">←</span>
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-slate-300 group-hover:text-amber-300" colSpan={3}>
                    📁 .. Quay lại danh mục thể loại cha
                  </td>
                </tr>

                {booksInOpenedCategory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-14 text-center text-slate-500 font-mono">
                      Thể loại này hiện chưa có cuốn sách nào.
                    </td>
                  </tr>
                ) : (
                  booksInOpenedCategory.map(b => (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-800/40 transition-colors cursor-default"
                    >
                      <td className="py-2.5 px-4 text-center text-slate-500">
                        📘
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-200">
                        {b.title}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">
                        {b.author}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-amber-400 font-bold">
                        {fmt(b.price)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'details' ? (
          /* ROOT CATEGORIES LIST TABLE (NO ACTION COLUMN - ACTIONS ARE IN TOP CONTEXT BAR) */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#090d16] text-slate-400 font-semibold text-[11px] border-b border-slate-800 select-none">
                  <th className="py-2.5 px-4">Tên thể loại</th>
                  <th className="py-2.5 px-4 w-36 text-center">Số đầu sách</th>
                  <th className="py-2.5 px-4 w-44">Tỷ lệ lưu trữ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-14 text-center text-slate-500 font-mono">
                      Không tìm thấy thể loại nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map(c => {
                    const isSelected = selectedSlug === c.id
                    const percentage = totalBooks > 0 ? Math.round((c.count / totalBooks) * 100) : 0
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedSlug(isSelected ? null : c.id)}
                        onDoubleClick={() => setOpenedSlug(c.id)}
                        className={`transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-amber-400/15 text-white border-l-4 border-amber-400 shadow-sm'
                            : 'hover:bg-slate-800/40 text-slate-200'
                        }`}
                        title="Nhấp để chọn · Nhấp đúp để mở xem sách"
                      >
                        {/* Name + Folder Icon + Slug */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 text-base">
                              📁
                            </div>
                            <div>
                              <div className={`font-semibold text-sm ${isSelected ? 'text-amber-300' : 'text-slate-100'}`}>
                                {c.name}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                /{c.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Book Count */}
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                            c.count > 0
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-500'
                          }`}>
                            {c.count} sách
                          </span>
                        </td>

                        {/* Storage ratio progress bar */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-amber-400 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(c.count > 0 ? 5 : 0, percentage))}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 w-8 text-right">
                              {percentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* ROOT CATEGORIES GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {filteredCategories.map(c => {
              const isSelected = selectedSlug === c.id
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedSlug(isSelected ? null : c.id)}
                  onDoubleClick={() => setOpenedSlug(c.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer select-none text-center ${
                    isSelected
                      ? 'bg-amber-400/15 border-amber-400 shadow-md ring-1 ring-amber-400'
                      : 'bg-[#090d16] border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
                  }`}
                  title="Nhấp để chọn · Nhấp đúp để mở xem sách"
                >
                  <div className="text-3xl mb-2">📁</div>
                  <div className="font-semibold text-xs text-white line-clamp-1">{c.name}</div>
                  <div className="text-[11px] font-mono text-amber-400/80 mt-1">{c.count} đầu sách</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Fallback Standalone Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-2xl text-slate-100 my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between pb-4 mb-6 border-b border-slate-800">
              <div>
                <div className="text-xs tracking-wider text-amber-400 uppercase font-mono font-bold mb-1">Kho sách Thất Tịnh</div>
                <h3 className="text-2xl font-bold text-white">Thêm thể loại mới</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-amber-400 flex items-center justify-center transition-colors cursor-pointer text-sm">
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 font-mono uppercase tracking-wider mb-1.5">Tên thể loại</label>
                <input type="text" placeholder="Ví dụ: Công nghệ thông tin" className="w-full bg-[#090d16] border border-slate-700 text-slate-100 px-3.5 py-2 text-sm rounded-lg focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-mono uppercase tracking-wider mb-1.5">Slug định danh</label>
                <input type="text" placeholder="cong-nghe-thong-tin" className="w-full bg-[#090d16] border border-slate-700 text-amber-400 font-mono px-3.5 py-2 text-xs rounded-lg focus:outline-none focus:border-amber-400" />
                <p className="text-[11px] text-slate-500 font-mono mt-1">Dùng chữ thường, số và dấu gạch ngang.</p>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800 mt-5">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
                  Hủy
                </button>
                <button type="button" className="px-5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs font-mono rounded-lg shadow-md transition-all cursor-pointer">
                  Tạo thể loại
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminAccounts({ onStatus }: { onStatus?: (email: string) => void }) {
  const { accounts } = useContext(DataCtx)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return accounts.filter(a => {
      const matchRole = roleFilter === 'all' || a.role.toLowerCase() === roleFilter.toLowerCase()
      const matchQ = !q || `${a.name} ${a.email} ${a.role}`.toLowerCase().includes(q)
      return matchRole && matchQ
    })
  }, [accounts, query, roleFilter])

  return (
    <div className="w-full space-y-6 text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Quản lý tài khoản</h2>
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg font-medium self-start sm:self-auto">
          Tổng cộng <strong className="text-amber-400">{accounts.length}</strong> người dùng
        </div>
      </div>

      {/* Unified Table Card */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {/* Integrated Toolbar */}
        <div className="p-3.5 border-b border-slate-800/80 bg-[#090d16] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <input
              type="search"
              aria-label="Tìm tài khoản"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Họ tên, email hoặc vai trò..."
              className="w-full bg-[#090d16] border border-slate-700/80 text-slate-200 px-3.5 py-1.5 text-xs rounded-lg focus:outline-none focus:border-amber-400 placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {['all', 'admin', 'customer'].map(rf => (
              <button
                key={rf}
                type="button"
                onClick={() => setRoleFilter(rf)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  roleFilter === rf
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {rf === 'all' ? 'Tất cả' : rf === 'admin' ? 'Quản trị viên' : 'Khách hàng'}
              </button>
            ))}
          </div>
        </div>

        {/* Accounts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#090d16] text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-3 px-4">Người dùng</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4 w-32 text-center">Xác minh</th>
                <th className="py-3 px-4 w-28 text-center">Vai trò</th>
                <th className="py-3 px-4 w-32 text-center">Trạng thái</th>
                <th className="py-3 px-4 w-24 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs font-mono text-slate-400">
                    Không tìm thấy tài khoản nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(a => {
                  const initials = a.name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U'
                  const isAdmin = a.role.toLowerCase() === 'admin'
                  return (
                    <tr key={a.email} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[11px] font-bold ${
                            isAdmin ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30' : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            {initials}
                          </div>
                          <span className="text-slate-100 font-medium text-xs sm:text-sm">{a.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-400 truncate">{a.email}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono ${a.verified ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                          {a.verified ? '✓ Đã xác minh' : 'Chưa xác minh'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded font-mono font-semibold uppercase text-[11px] ${isAdmin ? 'bg-amber-400/15 text-amber-400 border border-amber-400/25' : 'bg-sky-500/10 text-sky-400 border border-sky-500/25'}`}>
                          {a.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono ${a.status === 'Hoạt động' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-rose-500/10 text-rose-400 border border-rose-500/25'}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isAdmin ? (
                          <button
                            onClick={() => onStatus?.(a.email)}
                            className={`text-xs font-mono font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                              a.status === 'Hoạt động'
                                ? 'border border-rose-500/30 text-rose-400 hover:border-rose-500 hover:text-white hover:bg-rose-950/40'
                                : 'border border-emerald-500/30 text-emerald-400 hover:border-emerald-500 hover:text-white hover:bg-emerald-950/40'
                            }`}
                          >
                            {a.status === 'Hoạt động' ? 'Khóa' : 'Mở khóa'}
                          </button>
                        ) : (
                          <span className="text-xs font-mono text-slate-500 font-medium">Cố định</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function AdminSecurityEvents() {
  const { events: SECURITY_EVENTS } = useContext(DataCtx)
  return (
    <div className="space-y-6 text-slate-100 font-opensans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Sự kiện bảo mật</h2>
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg">
          Tổng cộng <strong className="text-amber-400">{SECURITY_EVENTS.length}</strong> sự kiện
        </div>
      </div>

      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#090d16] text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-3 px-4 w-40">Thời gian</th>
                <th className="py-3 px-4">Sự kiện & Request ID</th>
                <th className="py-3 px-4 w-32 text-center">Mức độ</th>
                <th className="py-3 px-4">Request / Endpoint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {SECURITY_EVENTS.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-xs font-mono text-slate-400">
                    Chưa có sự kiện bảo mật nào được ghi nhận.
                  </td>
                </tr>
              ) : (
                SECURITY_EVENTS.map((e, i) => (
                  <tr key={i} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">{e.time}</td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-slate-100 font-mono font-bold">{e.event}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-[200px]">{e.id}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`badge ${levelColor(e.level)}`}>{e.level}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300 font-mono truncate">{e.request}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function AdminInventory({
  onSelect,
  books: propBooks,
  movements: propMovements,
}: {
  onSelect?: (id: number) => void
  books?: any[]
  movements?: any[]
}) {
  const { books: contextBooks } = useContext(DataCtx)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [openedBookId, setOpenedBookId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'details' | 'grid'>('details')
  const [sortBy, setSortBy] = useState<'stock' | 'title'>('stock')
  const [sortAsc, setSortAsc] = useState(true)

  // Normalize source books
  const allBooks = useMemo(() => {
    const raw = (propBooks && propBooks.length > 0) ? propBooks : contextBooks
    return raw.map((b: any) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      stock: Number(b.stock) || 0,
      category: b.category || b.categoryName || 'Sách',
      lastMovementAt: b.lastMovementAt,
    }))
  }, [propBooks, contextBooks])

  const stats = useMemo(() => {
    const totalTitles = allBooks.length
    const totalUnits = allBooks.reduce((sum, b) => sum + b.stock, 0)
    const lowStock = allBooks.filter(b => b.stock > 0 && b.stock <= 10).length
    const outOfStock = allBooks.filter(b => b.stock === 0).length
    return { totalTitles, totalUnits, lowStock, outOfStock }
  }, [allBooks])

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = allBooks.filter(b => {
      const matchFilter =
        filter === 'all' ||
        (filter === 'low' && b.stock > 0 && b.stock <= 10) ||
        (filter === 'out' && b.stock === 0)
      const matchQ = !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.category.toLowerCase().includes(q)
      return matchFilter && matchQ
    })

    list.sort((a, b) => {
      if (sortBy === 'stock') {
        return sortAsc ? a.stock - b.stock : b.stock - a.stock
      } else {
        return sortAsc ? a.title.localeCompare(b.title, 'vi') : b.title.localeCompare(a.title, 'vi')
      }
    })

    return list
  }, [allBooks, query, filter, sortBy, sortAsc])

  const selectedBook = useMemo(() => {
    return allBooks.find(b => b.id === selectedId) || null
  }, [allBooks, selectedId])

  const openedBook = useMemo(() => {
    return allBooks.find(b => b.id === openedBookId) || null
  }, [allBooks, openedBookId])

  const bookMovements = useMemo(() => {
    if (!openedBookId || !propMovements) return []
    return propMovements.filter((m: any) => m.bookId === openedBookId)
  }, [openedBookId, propMovements])

  const movementLabels: Record<string, string> = {
    opening: 'Số dư đầu',
    sale: 'Xuất bán',
    return: 'Hoàn kho',
    adjustment: 'Điều chỉnh',
  }

  return (
    <div className="w-full space-y-4 font-opensans text-slate-100 select-none">
      {/* 1. TOP BREADCRUMB ADDRESS BAR & QUICK CONTROLS */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Breadcrumb Navigation */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            disabled={!openedBookId}
            onClick={() => { setOpenedBookId(null); setQuery(''); }}
            title={openedBookId ? "Quay lại danh sách tồn kho" : "Đang ở danh mục kho"}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              openedBookId
                ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 border border-amber-400/30 cursor-pointer shadow-sm font-bold'
                : 'text-slate-600 bg-slate-900/40 border border-slate-800/60 cursor-not-allowed opacity-40 font-bold'
            }`}
          >
            ←
          </button>

          {/* Breadcrumb Path */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#090d16] border border-slate-800 rounded-lg text-xs font-medium flex-1 overflow-x-auto whitespace-nowrap scrollbar-none">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span>📁</span>
              <span>Kho sách</span>
            </span>
            <span className="text-slate-600 font-bold select-none">›</span>

            <button
              type="button"
              onClick={() => { setOpenedBookId(null); setQuery(''); }}
              className={`hover:text-amber-400 px-1 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                !openedBookId ? 'text-amber-400 font-semibold' : 'text-slate-300'
              }`}
            >
              <span>📦</span>
              <span>Quản lý tồn kho</span>
            </button>

            {openedBook && (
              <>
                <span className="text-slate-600 font-bold select-none">›</span>
                <span className="text-amber-300 font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 flex items-center gap-1.5">
                  <span>📋</span>
                  <span className="truncate max-w-[220px]">Sổ biến động: {openedBook.title}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Search box & Status filter pills */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-60">
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={openedBook ? "Tìm trong lịch sử..." : "Tìm tên sách, tác giả..."}
              className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          {!openedBookId && (
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-0.5">
              {[
                { key: 'all', label: 'Tất cả', count: stats.totalTitles },
                { key: 'low', label: 'Sắp hết', count: stats.lowStock, alert: stats.lowStock > 0 },
                { key: 'out', label: 'Hết hàng', count: stats.outOfStock, danger: stats.outOfStock > 0 },
              ].map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key as typeof filter)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filter === f.key
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[10px] font-mono px-1 rounded ${
                    filter === f.key
                      ? 'bg-slate-950/20 text-slate-950 font-bold'
                      : f.danger ? 'text-rose-400 bg-rose-500/10' : f.alert ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500'
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. SMART CONTEXT ACTION BAR (Thao tác xuất hiện khi chọn dòng - Tuyệt đối không cần cột Thao tác) */}
      <div className={`rounded-xl border p-2.5 transition-all flex flex-wrap items-center justify-between gap-2.5 ${
        selectedBook && !openedBookId
          ? 'bg-amber-400/10 border-amber-400/40 shadow-md ring-1 ring-amber-400/20'
          : 'bg-[#0f172a]/50 border-slate-800'
      }`}>
        {selectedBook && !openedBookId ? (
          /* ACTIVE SELECTION ACTIONS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-xs">✓</span>
              <span className="text-xs text-slate-300">Đã chọn:</span>
              <span className="text-xs font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30">
                {selectedBook.title}
              </span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                selectedBook.stock === 0
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : selectedBook.stock <= 10
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                Tồn: {selectedBook.stock} cuốn
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden md:inline">({selectedBook.category})</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Điều chỉnh tồn kho */}
              <button
                type="button"
                onClick={() => onSelect?.(selectedBook.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-all cursor-pointer shadow-md"
              >
                <span>⚡</span>
                <span>Điều chỉnh tồn kho</span>
              </button>

              {/* Xem sổ biến động */}
              {propMovements && propMovements.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOpenedBookId(selectedBook.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer border border-slate-700"
                >
                  <span>📋</span>
                  <span>Xem sổ biến động</span>
                </button>
              )}

              {/* Bỏ chọn */}
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                title="Bỏ chọn"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs ml-1"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* IDLE SUMMARY & CONTROLS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap text-xs text-slate-400">
            <div className="flex items-center gap-3">
              {openedBook ? (
                <div className="flex items-center gap-2 text-slate-300">
                  <span>📋 Lịch sử biến động:</span>
                  <span className="font-bold text-white">{openedBook.title}</span>
                  <span className="text-[11px] font-mono text-amber-400">({bookMovements.length} giao dịch)</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <span>📦 <strong className="text-white font-mono">{stats.totalTitles}</strong> đầu sách</span>
                  <span>📊 <strong className="text-amber-400 font-mono">{stats.totalUnits}</strong> cuốn trong kho</span>
                  <span>⚠️ <strong className="text-amber-400 font-mono">{stats.lowStock}</strong> sắp hết</span>
                  <span>🚫 <strong className="text-rose-400 font-mono">{stats.outOfStock}</strong> hết hàng</span>
                  <span className="text-[11px] text-slate-500 hidden lg:inline italic">Nhấp dòng để chọn · Nhấp đúp để điều chỉnh kho</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {openedBook && (
                <button
                  type="button"
                  onClick={() => onSelect?.(openedBook.id)}
                  className="flex items-center gap-1 px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs transition-all cursor-pointer shadow-sm"
                >
                  <span>⚡</span>
                  <span>Điều chỉnh ngay</span>
                </button>
              )}

              {!openedBookId && (
                <>
                  {/* Sort */}
                  <button
                    type="button"
                    onClick={() => {
                      if (sortBy === 'stock') {
                        if (sortAsc) setSortAsc(false)
                        else { setSortBy('title'); setSortAsc(true); }
                      } else {
                        setSortBy('stock'); setSortAsc(true);
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer transition-colors text-xs"
                    title="Đổi thứ tự sắp xếp"
                  >
                    <span>↕</span>
                    <span>Sắp xếp:</span>
                    <span className="text-amber-400 font-mono font-bold">
                      {sortBy === 'stock' ? (sortAsc ? 'Tồn ít nhất ↑' : 'Tồn nhiều nhất ↓') : 'Tên A → Z'}
                    </span>
                  </button>

                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('details')}
                      className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                        viewMode === 'details' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Hiển thị dạng Danh sách"
                    >
                      ▦ Danh sách
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                        viewMode === 'grid' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Hiển thị dạng Lưới"
                    >
                      ⊞ Lưới
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. MAIN CONTENT: TABLE OR GRID (Clean, full width, no "Thao tác" column) */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {openedBookId ? (
          /* DRILL-DOWN: MOVEMENT LEDGER FOR THE OPENED BOOK */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#090d16] text-slate-400 font-semibold text-[11px] border-b border-slate-800 select-none">
                  <th className="py-2.5 px-4 w-10"></th>
                  <th className="py-2.5 px-4 w-36">Loại biến động</th>
                  <th className="py-2.5 px-4 w-32 text-center">Biến động</th>
                  <th className="py-2.5 px-4 w-32 text-center">Tồn sau</th>
                  <th className="py-2.5 px-4">Ghi chú & Căn cứ</th>
                  <th className="py-2.5 px-4 w-44 text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {/* Back to inventory row */}
                <tr
                  onClick={() => { setOpenedBookId(null); setQuery(''); }}
                  className="hover:bg-slate-800/60 transition-colors cursor-pointer text-slate-400 group"
                >
                  <td className="py-2.5 px-4 text-center">
                    <span className="text-amber-400 group-hover:-translate-x-1 inline-block transition-transform font-bold">←</span>
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-slate-300 group-hover:text-amber-300" colSpan={5}>
                    📦 .. Quay lại danh mục quản lý tồn kho
                  </td>
                </tr>

                {bookMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-slate-500 font-mono">
                      Chưa có lịch sử biến động kho cho cuốn sách này.
                    </td>
                  </tr>
                ) : (
                  bookMovements.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-800/40 transition-colors cursor-default">
                      <td className="py-2.5 px-4 text-center text-slate-500">
                        {m.quantityDelta > 0 ? '🟢' : '🔴'}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-200">
                        {movementLabels[m.movementType] || m.movementType}
                        {m.referenceId ? ` (#${m.referenceId})` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold">
                        <span className={m.quantityDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono text-slate-300 font-bold">
                        {m.balanceAfter} cuốn
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">
                        {m.note || 'Không có ghi chú'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-400 text-[11px]">
                        {new Date(m.createdAt).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'details' ? (
          /* ROOT INVENTORY LIST TABLE (NO ACTION COLUMN - ACTIONS ARE IN TOP CONTEXT BAR) */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#090d16] text-slate-400 font-semibold text-[11px] border-b border-slate-800 select-none">
                  <th className="py-2.5 px-4">Đầu sách & Tác giả</th>
                  <th className="py-2.5 px-4 w-40 text-center">Tình trạng tồn</th>
                  <th className="py-2.5 px-4 w-32 text-center">Tồn kho</th>
                  <th className="py-2.5 px-4 w-48">Mức độ dự trữ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredBooks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-14 text-center text-slate-500 font-mono">
                      Không tìm thấy đầu sách nào phù hợp với bộ lọc tồn kho.
                    </td>
                  </tr>
                ) : (
                  filteredBooks.map(b => {
                    const isSelected = selectedId === b.id
                    // Safe inventory benchmark: 30 units = full bar
                    const percentage = Math.min(100, Math.round((b.stock / 30) * 100))
                    return (
                      <tr
                        key={b.id}
                        onClick={() => setSelectedId(isSelected ? null : b.id)}
                        onDoubleClick={() => onSelect?.(b.id)}
                        className={`transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-amber-400/15 text-white border-l-4 border-amber-400 shadow-sm'
                            : 'hover:bg-slate-800/40 text-slate-200'
                        }`}
                        title="Nhấp để chọn · Nhấp đúp để điều chỉnh tồn kho"
                      >
                        {/* Title & Author & Category */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 text-base">
                              {b.stock === 0 ? '🚫' : b.stock <= 10 ? '⚠️' : '📦'}
                            </div>
                            <div>
                              <button type="button" aria-label={`Điều chỉnh kho ${b.title}`}
                                onClick={event => { event.stopPropagation(); onSelect?.(b.id); }}
                                className={`font-semibold text-sm text-left underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${isSelected ? 'text-amber-300' : 'text-slate-100'}`}>
                                {b.title}
                              </button>
                              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                                <span>{b.author}</span>
                                <span className="text-slate-600">·</span>
                                <span className="font-mono text-slate-500">[{b.category}]</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4 text-center">
                          {b.stock === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              Hết hàng
                            </span>
                          ) : b.stock <= 10 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Sắp hết ({b.stock})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Sẵn hàng
                            </span>
                          )}
                        </td>

                        {/* Stock count */}
                        <td className="py-3 px-4 text-center">
                          <span className={`font-mono text-sm font-bold ${
                            b.stock === 0
                              ? 'text-rose-400'
                              : b.stock <= 10
                              ? 'text-amber-400'
                              : 'text-slate-100'
                          }`}>
                            {b.stock} cuốn
                          </span>
                        </td>

                        {/* Stock level visual bar */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  b.stock === 0
                                    ? 'bg-rose-500'
                                    : b.stock <= 10
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-400'
                                }`}
                                style={{ width: `${Math.max(b.stock > 0 ? 6 : 0, percentage)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 w-9 text-right">
                              {percentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* ROOT INVENTORY GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {filteredBooks.map(b => {
              const isSelected = selectedId === b.id
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedId(isSelected ? null : b.id)}
                  onDoubleClick={() => onSelect?.(b.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer select-none text-center ${
                    isSelected
                      ? 'bg-amber-400/15 border-amber-400 shadow-md ring-1 ring-amber-400'
                      : 'bg-[#090d16] border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
                  }`}
                  title="Nhấp để chọn · Nhấp đúp để điều chỉnh kho"
                >
                  <div className="text-3xl mb-2">
                    {b.stock === 0 ? '🚫' : b.stock <= 10 ? '⚠️' : '📦'}
                  </div>
                  <div className="font-semibold text-xs text-white line-clamp-1">{b.title}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{b.author}</div>
                  <div className={`mt-2 font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                    b.stock === 0
                      ? 'bg-rose-500/10 text-rose-400'
                      : b.stock <= 10
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    Tồn: {b.stock} cuốn
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function AdminAudit() {
  return (
    <div className="space-y-6 text-slate-100">
      <div>
        <div className="text-xs tracking-wider text-amber-400 uppercase font-mono font-bold mb-1">Bảo mật & Kiểm toán</div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Nhật ký quản trị</h2>
      </div>
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl p-16 text-center shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 text-amber-400 text-2xl">
          🛡️
        </div>
        <div className="text-lg font-bold text-white mb-2">Chưa có thao tác được ghi nhận</div>
        <div className="text-xs text-slate-400 font-mono">Các thao tác quản trị sẽ được ghi lại tự động tại đây.</div>
      </div>
    </div>
  )
}
