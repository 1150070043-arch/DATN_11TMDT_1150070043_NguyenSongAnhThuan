import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, assetUrl, setCsrfToken } from '../lib/api';
import { useAuth as useSession } from '../context/AuthContext';
import type { UserSession, User, Order } from '../types';
import { useToast, useTheme, SectionLabel, statusColor, fmt } from './Reference';
export function SettingsPage({ onBack }: { onBack: () => void }) {
  const { user, refreshUser, logout } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const avatarInput = useRef<HTMLInputElement>(null)
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [address, setAddress] = useState(user?.addressLine ?? '')
  const [editingAddress, setEditingAddress] = useState(false)
  const [passwords, setPasswords] = useState(['', '', ''])
  useEffect(() => {
    void api<UserSession[]>('/api/auth/sessions').then(result => setSessions(result.data)).catch(() => {})
    void api<Order[]>('/api/orders').then(result => setOrders(result.data)).catch(() => {})
  }, [])
  const ORDERS = orders.map(order => ({ id: order.id, customer: order.customerName, date: new Date(order.createdAt).toLocaleString('vi-VN'), status: ({ pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipping: 'Đang giao', completed: 'Đã giao', cancelled: 'Đã hủy' })[order.status], total: Number(order.totalAmount), items: `Đơn sách #${order.id}` }))
  type SettingsTab = 'profile' | 'password' | 'address' | 'security' | 'orders'
  const [tab, setTab] = useState<SettingsTab>('profile')
  const [saved, setSaved] = useState(false)
  const [profile, setProfile] = useState({ name: user?.fullName ?? '', email: user?.email ?? '', phone: user?.phone ?? '', bio: localStorage.getItem(`bookguard-bio-${user?.id}`) ?? '' })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (tab === 'password') {
        if (passwords[1] !== passwords[2]) { toast('Mật khẩu xác nhận không khớp', 'error'); return }
        const result = await api<{ csrfToken?: string }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: passwords[0], newPassword: passwords[1] }) })
        setCsrfToken(result.data.csrfToken); setPasswords(['', '', ''])
      } else {
        await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ fullName: profile.name, phone: profile.phone, addressLine: address }) })
        localStorage.setItem(`bookguard-bio-${user?.id}`, profile.bio)
        await refreshUser(); setEditingAddress(false)
      }
      setSaved(true); window.setTimeout(() => setSaved(false), 2500)
    } catch (error) { toast(error instanceof Error ? error.message : 'Không thể lưu thay đổi', 'error') }
  }
  async function uploadAvatar(file: File) {
    const body = new FormData(); body.append('avatar', file)
    try { await api('/api/profile/avatar', { method: 'POST', body }); await refreshUser(); toast('Đã cập nhật ảnh đại diện', 'success') }
    catch (error) { toast(error instanceof Error ? error.message : 'Không thể tải ảnh lên', 'error') }
  }

  const menu: [SettingsTab, string, string][] = [
    ['profile', 'Hồ sơ', 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'],
    ['password', 'Mật khẩu', 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'],
    ['address', 'Địa chỉ', 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'],
    ['security', 'Bảo mật', 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'],
    ['orders', 'Đơn hàng', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'],
  ]

  return (
    <div className="min-h-screen pt-16">
      <div className="border-b border-[#22201d] bg-[#0f0d0b]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-2 text-[#7a6f64] hover:text-[#ede7dc] transition-colors text-sm group">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="group-hover:-translate-x-0.5 transition-transform"><path d="m15 18-6-6 6-6"/></svg>
            Quay lại
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10">
          <SectionLabel>Tài khoản</SectionLabel>
          <h1 className="font-display text-4xl text-[#ede7dc] font-medium">Cài đặt</h1>
        </div>

        <div className="grid md:grid-cols-[220px_minmax(0,1fr)] gap-8">
          {/* Sidebar */}
          <div className="space-y-1">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3 p-4 mb-4 bg-[#131110] border border-[#22201d] rounded-sm">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-[#c8a94d] to-[#bf6c3e] flex items-center justify-center text-[#0b0907] font-display font-bold text-2xl">{user?.avatarUrl ? <img src={assetUrl(user.avatarUrl)} alt="Ảnh đại diện" className="w-full h-full object-cover" /> : profile.name.slice(0, 1)}</div>
              <div className="text-center">
                <div className="text-sm text-[#ede7dc] font-medium">{profile.name}</div>
                <div className="text-xs text-[#7a6f64] font-mono truncate max-w-[150px]">{profile.email}</div>
              </div>
            </div>

            {menu.map(([t, label, icon]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`sidebar-link w-full flex items-center gap-3 px-4 py-3 text-sm rounded-sm transition-colors text-left ${tab === t ? 'active text-[#ede7dc] bg-[#1c1815]' : 'text-[#7a6f64] hover:text-[#ede7dc] hover:bg-[#1c1815]/50'}`}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="min-w-0 break-words bg-[#131110] border border-[#22201d] rounded-sm p-6 md:p-8">

            {tab === 'profile' && (
              <form onSubmit={save}>
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-6">Hồ sơ cá nhân</div>
                <div className="space-y-5">
                  <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[#22201d]">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#c8a94d] to-[#bf6c3e] flex items-center justify-center text-[#0b0907] font-display font-bold text-3xl shrink-0">{user?.avatarUrl ? <img src={assetUrl(user.avatarUrl)} alt="Ảnh đại diện" className="w-full h-full object-cover" /> : profile.name.slice(0, 1)}</div>
                    <div>
                      <input ref={avatarInput} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file) }} />
                      <button type="button" onClick={() => avatarInput.current?.click()} className="text-xs text-[#c8a94d] border border-[#c8a94d]/40 px-4 py-2 rounded-sm hover:bg-[#c8a94d]/10 transition-colors">Đổi ảnh đại diện</button>
                      <p className="text-[10px] text-[#7a6f64] mt-1.5">PNG, JPG · tối đa 2MB</p>
                    </div>
                  </div>
                  {[['name', 'Họ và tên', 'text'], ['email', 'Email', 'email'], ['phone', 'Số điện thoại', 'tel']].map(([k, l, t]) => (
                    <div key={k}>
                      <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">{l}</label>
                      <input aria-label={l} disabled={k === 'email'} type={t} value={(profile as Record<string, string>)[k]}
                        onChange={e => setProfile(p => ({ ...p, [k]: e.target.value }))}
                        className="w-full bg-[#1c1815] border border-[#2b2520] text-[#ede7dc] px-4 py-3 text-sm rounded-sm focus:outline-none focus:border-[#c8a94d]/60" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Giới thiệu bản thân</label>
                    <textarea rows={3} value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                      placeholder="Viết vài dòng về bản thân..."
                      className="w-full bg-[#1c1815] border border-[#2b2520] text-[#ede7dc] px-4 py-3 text-sm rounded-sm focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] resize-none" />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button type="submit" className={`px-6 py-2.5 rounded-sm text-sm font-semibold transition-all ${saved ? 'bg-emerald-700 text-white' : 'btn-gold text-[#0b0907]'}`}>
                      {saved ? '✓ Đã lưu' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {tab === 'password' && (
              <form onSubmit={save}>
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-6">Đổi mật khẩu</div>
                <div className="space-y-5 max-w-md">
                  {[['Mật khẩu hiện tại'], ['Mật khẩu mới'], ['Xác nhận mật khẩu mới']].map(([l], index) => (
                    <div key={l}>
                      <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">{l}</label>
                      <input aria-label={l} type="password" placeholder="••••••••" required value={passwords[index]} onChange={event => setPasswords(current => current.map((value, i) => index === i ? event.target.value : value))}
                        className="w-full bg-[#1c1815] border border-[#2b2520] text-[#ede7dc] px-4 py-3 text-sm rounded-sm focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64]" />
                    </div>
                  ))}
                  <div className="bg-[#1c1815] rounded-sm p-4 text-xs text-[#7a6f64] space-y-1">
                    {['Ít nhất 10 ký tự', 'Chứa chữ hoa và chữ thường', 'Chứa ít nhất một số'].map(r => (
                      <div key={r} className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-[#7a6f64]" />
                        {r}
                      </div>
                    ))}
                  </div>
                  <button type="submit" className={`px-6 py-2.5 rounded-sm text-sm font-semibold transition-all ${saved ? 'bg-emerald-700 text-white' : 'btn-gold text-[#0b0907]'}`}>
                    {saved ? '✓ Đã cập nhật' : 'Cập nhật mật khẩu'}
                  </button>
                </div>
              </form>
            )}

            {tab === 'address' && (
              <div>
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-6">Địa chỉ giao hàng</div>
                {[{ label: 'Nhà riêng', addr: address || 'Chưa có địa chỉ', default: true }].map(a => (
                  <div key={a.label} className="mb-4 p-5 border border-[#22201d] rounded-sm hover:border-[#2b2520] transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#ede7dc] font-medium">{a.label}</span>
                        {a.default && <span className="badge bg-[#c8a94d]/20 text-[#c8a94d] border border-[#c8a94d]/30">Mặc định</span>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingAddress(true)} className="text-xs text-[#7a6f64] hover:text-[#c8a94d] transition-colors">Sửa</button>
                        {!a.default && <button className="text-xs text-[#7a6f64] hover:text-red-400 transition-colors">Xóa</button>}
                      </div>
                    </div>
                    <p className="text-sm text-[#b5a99b]">{a.addr}</p>
                  </div>
                ))}
                {editingAddress && <form onSubmit={save} className="space-y-4 mb-4"><textarea aria-label="Địa chỉ giao hàng" className="w-full p-3 bg-[#1c1815] border border-[#2b2520] rounded-sm" value={address} onChange={event => setAddress(event.target.value)} /><button className="btn-gold text-[#0b0907] px-5 py-3">Lưu địa chỉ</button></form>}
                <button onClick={() => setEditingAddress(true)} className="flex items-center gap-2 text-sm text-[#c8a94d] border border-[#c8a94d]/30 px-4 py-2.5 rounded-sm hover:bg-[#c8a94d]/10 transition-colors mt-2">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                  Thêm địa chỉ mới
                </button>
              </div>
            )}

            {tab === 'security' && (
              <div>
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-6">Bảo mật tài khoản</div>
                <div className="space-y-6">
                  {/* Active sessions */}
                  <div>
                    <div className="text-xs text-[#7a6f64] uppercase tracking-wider font-mono mb-4">Phiên đang hoạt động</div>
                    {sessions.filter(session => session.isActive).map(session => ({ id: session.id, device: session.userAgent?.includes('Windows') ? 'Trình duyệt · Windows' : 'Trình duyệt', location: session.ipAddress ?? '', time: new Date(session.lastSeenAt).toLocaleString('vi-VN'), current: session.isCurrent })).map(s => (
                      <div key={s.device} className="flex items-center justify-between py-4 border-b border-[#22201d] last:border-b-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${s.current ? 'bg-emerald-400' : 'bg-[#2b2520]'}`} />
                          <div>
                            <div className="text-sm text-[#ede7dc]">{s.device}</div>
                            <div className="text-xs text-[#7a6f64] font-mono">{s.location} · {s.time}</div>
                          </div>
                        </div>
                        {!s.current && (
                          <button onClick={() => { void api(`/api/auth/sessions/${s.id}`, { method: 'DELETE' }).then(() => setSessions(current => current.filter(session => session.id !== s.id))).catch(error => toast(error.message, 'error')) }} className="text-xs text-red-400/70 hover:text-red-400 border border-red-900/40 hover:border-red-700/60 px-3 py-1.5 rounded-sm transition-colors">
                            Đăng xuất
                          </button>
                        )}
                        {s.current && <span className="badge bg-emerald-900/30 text-emerald-400 border border-emerald-800/40">Thiết bị này</span>}
                      </div>
                    ))}
                    <button onClick={() => { void Promise.all(sessions.filter(session => session.isActive && !session.isCurrent).map(session => api(`/api/auth/sessions/${session.id}`, { method: 'DELETE' }))).then(() => setSessions(current => current.filter(session => session.isCurrent))).catch(error => toast(error.message, 'error')) }} className="mt-4 text-xs text-red-400/70 hover:text-red-400 transition-colors">Đăng xuất tất cả thiết bị khác</button>
                    <button onClick={() => { void logout().then(() => navigate('/login')) }} className="block mt-4 text-xs text-[#c8a94d]">Đăng xuất tài khoản</button>
                  </div>

                  {/* Danger zone */}
                  <div className="border border-red-900/30 rounded-sm p-5">
                    <div className="text-xs text-red-400 uppercase tracking-wider font-mono mb-3">Vùng nguy hiểm</div>
                    <p className="text-sm text-[#7a6f64] mb-4">Xóa tài khoản sẽ xóa vĩnh viễn tất cả dữ liệu, đơn hàng và lịch sử của bạn.</p>
                    <button onClick={() => toast('Vui lòng liên hệ quản trị viên để yêu cầu xóa tài khoản.', 'info')} className="text-xs text-red-400/70 hover:text-red-400 border border-red-900/40 hover:border-red-700/60 px-4 py-2 rounded-sm transition-colors">
                      Xóa tài khoản
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'orders' && (
              <div>
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-6">Lịch sử đơn hàng</div>
                <div className="space-y-0">
                  {ORDERS.map(o => (
                    <div key={o.id} role="button" tabIndex={0} onClick={() => navigate('/orders', { state: { selectedOrderId: o.id } })} onKeyDown={event => { if (event.key === 'Enter') navigate('/orders', { state: { selectedOrderId: o.id } }) }} className="reference-order-row py-5 flex items-center gap-5 cursor-pointer border-b border-[#22201d] last:border-b-0 hover:bg-[#16223b] px-3 rounded transition-colors">
                      <div className="w-10 h-10 rounded-sm bg-[#1c1815] border border-[#22201d] flex items-center justify-center text-[#c8a94d] font-mono text-xs font-bold shrink-0">
                        #{o.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[#ede7dc] font-medium truncate">{o.items}</div>
                        <div className="text-xs text-[#7a6f64] font-mono mt-0.5">{o.date}</div>
                      </div>
                      <span className={`badge ${statusColor(o.status)} shrink-0`}>{o.status}</span>
                      <div className="text-sm font-mono text-[#c8a94d] shrink-0 w-28 text-right">{fmt(o.total)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}


export function LoginPage({ onLogin, onRegister, onForgot }: { onLogin: (user?: User) => void; onRegister: () => void; onForgot: () => void }) {
  const { login } = useSession()
  const light = useTheme() === 'light'
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { toast('Vui lòng nhập đầy đủ thông tin', 'error'); return }
    setLoading(true)
    try { const loggedUser = await login(email, password); toast('Đăng nhập thành công!', 'success'); onLogin(loggedUser) }
    catch (error) { toast(error instanceof Error ? error.message : 'Đăng nhập thất bại', 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-sm bg-[#c8a94d] flex items-center justify-center mx-auto mb-5">
            <span className="font-display font-bold text-[#0b0907] text-2xl">T</span>
          </div>
          <h1 className={`font-display text-3xl font-medium mb-2 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Đăng nhập</h1>
          <p className="text-sm text-[#7a6f64]">Chào mừng trở lại với Thư An</p>
        </div>

        <div className={`rounded-sm border p-8 ${light ? 'bg-white border-[#d5cfc4]' : 'bg-[#131110] border-[#22201d]'}`}>
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Email</label>
              <input aria-label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@example.com" autoComplete="email"
                className={`w-full px-4 py-3 text-sm rounded-sm border focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] ${light ? 'bg-[#f8f4ef] border-[#d5cfc4] text-[#1a1410]' : 'bg-[#1c1815] border-[#2b2520] text-[#ede7dc]'}`} />
            </div>
            <div>
              <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Mật khẩu</label>
              <div className="relative">
                <input aria-label="Mật khẩu" type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                  className={`w-full px-4 py-3 pr-11 text-sm rounded-sm border focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] ${light ? 'bg-[#f8f4ef] border-[#d5cfc4] text-[#1a1410]' : 'bg-[#1c1815] border-[#2b2520] text-[#ede7dc]'}`} />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a6f64] hover:text-[#c8a94d] transition-colors">
                  {showPwd ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
              <div className="flex justify-end mt-1.5">
                <button type="button" onClick={onForgot} className="text-xs text-[#c8a94d] hover:underline">Quên mật khẩu?</button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full btn-gold text-[#0b0907] font-semibold py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <><svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Đang đăng nhập…</> : 'Đăng nhập'}
            </button>

            <div className="relative flex items-center gap-3">
              <div className={`flex-1 h-px ${light ? 'bg-[#d5cfc4]' : 'bg-[#22201d]'}`} />
              <span className="text-xs text-[#7a6f64]">hoặc</span>
              <div className={`flex-1 h-px ${light ? 'bg-[#d5cfc4]' : 'bg-[#22201d]'}`} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setEmail('customer.a@bookguard.local'); setPassword('Customer@123') }}
                className={`w-full border py-2.5 rounded-sm text-xs font-medium transition-colors cursor-pointer ${light ? 'border-[#d5cfc4] text-[#5a4f44] hover:bg-[#f0e9de]' : 'border-[#2b2520] text-[#b5a99b] hover:bg-[#1c1815]'}`}>
                Khách demo
              </button>
              <button type="button" onClick={() => { setEmail('admin@bookguard.local'); setPassword('Admin@12345') }}
                className="w-full border border-[#c8a94d]/40 py-2.5 rounded-sm text-xs font-medium text-[#c8a94d] hover:bg-[#c8a94d]/10 transition-colors cursor-pointer">
                Admin demo
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-[#7a6f64] mt-6">
          Chưa có tài khoản?{' '}
          <button onClick={onRegister} className="text-[#c8a94d] hover:underline">Đăng ký ngay</button>
        </p>
      </div>
    </div>
  )
}


export function RegisterPage({ onLogin, onBack }: { onLogin: () => void; onBack: () => void }) {
  const { register } = useSession()
  const light = useTheme() === 'light'
  const toast = useToast()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) { toast('Vui lòng điền đầy đủ', 'error'); return }
    if (form.password !== form.confirm) { toast('Mật khẩu xác nhận không khớp', 'error'); return }
    if (form.password.length < 8) { toast('Mật khẩu tối thiểu 8 ký tự', 'error'); return }
    setLoading(true)
    try { await register(form.name, form.email, form.password); setDone(true) }
    catch (error) { toast(error instanceof Error ? error.message : 'Không thể tạo tài khoản', 'error') }
    finally { setLoading(false) }
  }

  if (done) return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" fill="none" stroke="#4ade80" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        </div>
        <h2 className={`font-display text-2xl font-medium mb-3 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Kiểm tra hộp thư</h2>
        <p className="text-sm text-[#7a6f64] mb-2">Chúng tôi đã gửi email xác minh đến</p>
        <p className={`text-sm font-medium font-mono mb-6 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>{form.email}</p>
        <p className="text-xs text-[#7a6f64] mb-8">Mở email và nhấp vào liên kết xác minh để kích hoạt tài khoản.</p>
        <button onClick={onLogin} className="btn-gold text-[#0b0907] font-semibold px-8 py-3 rounded-sm text-sm">Đến trang đăng nhập</button>
        <p className="text-xs text-[#7a6f64] mt-4">Không nhận được email? <button onClick={() => void api('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email: form.email }) }).then(() => toast('Đã yêu cầu gửi lại email xác minh', 'success')).catch(error => toast(error.message, 'error'))} className="text-[#c8a94d] hover:underline">Gửi lại</button></p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16 pb-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-sm bg-[#c8a94d] flex items-center justify-center mx-auto mb-5">
            <span className="font-display font-bold text-[#0b0907] text-2xl">T</span>
          </div>
          <h1 className={`font-display text-3xl font-medium mb-2 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Tạo tài khoản</h1>
          <p className="text-sm text-[#7a6f64]">Tham gia cộng đồng độc giả Thư An</p>
        </div>

        <div className={`rounded-sm border p-8 ${light ? 'bg-white border-[#d5cfc4]' : 'bg-[#131110] border-[#22201d]'}`}>
          <form onSubmit={submit} className="space-y-4">
            {[['name', 'Họ và tên', 'text', 'Nguyễn Minh An'], ['email', 'Email', 'email', 'ban@example.com'], ['password', 'Mật khẩu', 'password', '••••••••'], ['confirm', 'Xác nhận mật khẩu', 'password', '••••••••']].map(([k, l, t, ph]) => (
              <div key={k}>
                <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">{l}</label>
                <input aria-label={l} type={t} placeholder={ph} value={(form as Record<string, string>)[k]}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className={`w-full px-4 py-3 text-sm rounded-sm border focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] ${light ? 'bg-[#f8f4ef] border-[#d5cfc4] text-[#1a1410]' : 'bg-[#1c1815] border-[#2b2520] text-[#ede7dc]'}`} />
              </div>
            ))}
            <button type="submit" disabled={loading}
              className="w-full btn-gold text-[#0b0907] font-semibold py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-60 mt-2">
              {loading ? <><svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Đang tạo…</> : 'Tạo tài khoản'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#7a6f64] mt-6">
          Đã có tài khoản?{' '}
          <button onClick={onBack} className="text-[#c8a94d] hover:underline">Đăng nhập</button>
        </p>
      </div>
    </div>
  )
}


export function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const light = useTheme() === 'light'
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { toast('Vui lòng nhập email', 'error'); return }
    setLoading(true)
    try { await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); setSent(true) }
    catch (error) { toast(error instanceof Error ? error.message : 'Không thể gửi email', 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#7a6f64] hover:text-[#c8a94d] transition-colors mb-8">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
          Quay lại đăng nhập
        </button>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#c8a94d]/20 border border-[#c8a94d]/40 flex items-center justify-center mx-auto mb-6">
              <svg width="28" height="28" fill="none" stroke="#c8a94d" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </div>
            <h2 className={`font-display text-2xl font-medium mb-3 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Đã gửi email</h2>
            <p className="text-sm text-[#7a6f64] mb-2">Kiểm tra hộp thư tại</p>
            <p className={`text-sm font-mono font-medium mb-6 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>{email}</p>
            <p className="text-xs text-[#7a6f64]">Link đặt lại mật khẩu có hiệu lực trong 30 phút.</p>
          </div>
        ) : (
          <>
            <h1 className={`font-display text-3xl font-medium mb-2 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Quên mật khẩu</h1>
            <p className="text-sm text-[#7a6f64] mb-8">Nhập email tài khoản, chúng tôi sẽ gửi link đặt lại mật khẩu.</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@example.com"
                  className={`w-full px-4 py-3 text-sm rounded-sm border focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] ${light ? 'bg-[#f8f4ef] border-[#d5cfc4] text-[#1a1410]' : 'bg-[#1c1815] border-[#2b2520] text-[#ede7dc]'}`} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full btn-gold text-[#0b0907] font-semibold py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <><svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Đang gửi…</> : 'Gửi link đặt lại'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
