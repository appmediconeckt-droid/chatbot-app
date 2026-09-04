import React, { useState, useEffect, useRef } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import api from '../api/axios'
import Logo from './Logo'
import './ProtectedRoute.css'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('admin_token')
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('admin_theme') === 'dark'
  })
  const [drawerOpen, setDrawerOpen] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) return false
    return localStorage.getItem('admin_drawer') !== 'closed'
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem('admin_theme', 'dark')
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
      localStorage.setItem('admin_theme', 'light')
    }
  }, [darkMode])

  useEffect(() => {
    localStorage.setItem('admin_drawer', drawerOpen ? 'open' : 'closed')
  }, [drawerOpen])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!token) {
    return <Navigate to="/login" />
  }

  const toggleDrawer = () => {
    if (window.innerWidth <= 768) {
      setMobileOpen(v => !v)
    } else {
      setDrawerOpen(v => !v)
    }
  }

  return (
    <div className={`md-app ${drawerOpen ? 'drawer-open' : 'drawer-closed'} ${mobileOpen ? 'mobile-open' : ''}`}>
      <Sidebar open={drawerOpen} mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      {mobileOpen && <div className="md-drawer-scrim" onClick={() => setMobileOpen(false)} />}
      <div className="md-main">
        <AppBar
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          toggleDrawer={toggleDrawer}
        />
        <div className="md-content">
          {children}
        </div>
      </div>
    </div>
  )
}

function Sidebar({ open, mobileOpen, onNavigate }) {
  const navigate = useNavigate()
  const location = useLocation()

  const navGroups = [
    {
      title: 'Overview',
      links: [
        { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' }
      ]
    },
    {
      title: 'Management',
      links: [
        { path: '/support', icon: 'support_agent', label: 'Support Inbox' },
        { path: '/users', icon: 'group', label: 'Users' },
        { path: '/counselors', icon: 'psychology', label: 'Consultants' },
        { path: '/reviews', icon: 'reviews', label: 'Reviews' },
        { path: '/location-history', icon: 'location_on', label: 'Location History' }
      ]
    },
    {
      title: 'Finance',
      links: [
        { path: '/wallet-payments', icon: 'credit_card', label: 'Wallet Payments' },
        { path: '/refunds', icon: 'currency_rupee', label: 'User Refunds' },
        { path: '/counselor-revenue', icon: 'payments', label: 'Consultant Revenue' },
        { path: '/revenue', icon: 'trending_up', label: 'Platform Revenue' },
        { path: '/payouts', icon: 'account_balance_wallet', label: 'Payouts' }
      ]
    },
    {
      title: 'System',
      links: [
        { path: '/audit-logs', icon: 'receipt_long', label: 'Audit Logs' },
        { path: '/admin-settings', icon: 'tune', label: 'System Settings' },
        { path: '/settings', icon: 'settings', label: 'Account Settings' }
      ]
    }
  ]

  const go = (path) => {
    navigate(path)
    if (onNavigate) onNavigate()
  }

  return (
    <aside className={`md-drawer ${open ? 'open' : 'collapsed'} ${mobileOpen ? 'mobile-visible' : ''}`}>
      <div className="md-drawer-header">
        <button className="md-brand" onClick={() => go('/dashboard')} title="Humaeli Admin">
          <div className="md-brand-mark">
            <Logo variant="horizontal" width={198} height={198} className="md-brand-logo-full" />
            <Logo size={44} className="md-brand-logo-compact" />
          </div>
          <div className="md-brand-text">
            <div className="md-brand-sub">Admin Console</div>
          </div>
        </button>
      </div>

      <nav className="md-nav" aria-label="Primary">
        {navGroups.map((group) => (
          <div key={group.title} className="md-nav-group">
            <div className="md-nav-group-title">{group.title}</div>
            {group.links.map((link) => {
              const active = location.pathname === link.path
              return (
                <button
                  key={link.path}
                  onClick={() => go(link.path)}
                  className={`md-nav-item ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  data-tooltip={link.label}
                >
                  <span className="md-nav-indicator" aria-hidden />
                  <span className="material-symbols-outlined md-nav-icon">{link.icon}</span>
                  <span className="md-nav-label">{link.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="md-drawer-footer">
        <div className="md-version">v1.0.0 · Material</div>
      </div>
    </aside>
  )
}

function AppBar({ darkMode, setDarkMode, toggleDrawer }) {
  const navigate = useNavigate()
  const location = useLocation()
  const email = localStorage.getItem('admin_email') || 'Admin'
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_email')
    navigate('/login')
  }

  const pageTitle = {
    '/dashboard': 'Dashboard',
    '/users': 'Users',
    '/counselors': 'Consultants',
    '/counselor-revenue': 'Consultant Revenue',
    '/revenue': 'Platform Revenue',
    '/payouts': 'Payouts',
    '/wallet-payments': 'Wallet Payments',
    '/refunds': 'User Refunds',
    '/support': 'Support Inbox',
    '/reviews': 'Reviews',
    '/audit-logs': 'Audit Logs',
    '/admin-settings': 'System Settings',
    '/settings': 'Account Settings'
  }[location.pathname] || 'Admin'

  const initials = (email[0] || 'A').toUpperCase()

  return (
    <header className="md-appbar">
      <div className="md-appbar-left">
        <button className="md-icon-btn" onClick={toggleDrawer} title="Toggle menu" aria-label="Toggle navigation">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h2 className="md-appbar-title">{pageTitle}</h2>
      </div>

      <GlobalSearch />


      <div className="md-appbar-right">
        <button
          className="md-icon-btn"
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          <span className="material-symbols-outlined">
            {darkMode ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        <NotificationBell />


        <div className="md-user-menu">
          <button
            className="md-avatar"
            onClick={() => setMenuOpen(o => !o)}
            title={email}
            aria-label="User menu"
          >
            {initials}
          </button>
          {menuOpen && (
            <>
              <div className="md-menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="md-menu" role="menu">
                <div className="md-menu-header">
                  <div className="md-avatar md-avatar-lg">{initials}</div>
                  <div className="md-menu-info">
                    <div className="md-menu-name">Administrator</div>
                    <div className="md-menu-email">{email}</div>
                  </div>
                </div>
                <div className="md-menu-divider" />
                <button className="md-menu-item" onClick={() => { setMenuOpen(false); navigate('/settings') }}>
                  <span className="material-symbols-outlined">person</span>
                  My Account
                </button>
                <button className="md-menu-item" onClick={() => { setMenuOpen(false); navigate('/admin-settings') }}>
                  <span className="material-symbols-outlined">tune</span>
                  System Settings
                </button>
                <div className="md-menu-divider" />
                <button className="md-menu-item md-menu-item-danger" onClick={handleLogout}>
                  <span className="material-symbols-outlined">logout</span>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ total: 0, groups: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const containerRef = useRef(null)
  const [dismissedAt, setDismissedAt] = useState(() => {
    const stored = localStorage.getItem('admin_notifications_seen')
    return stored ? parseInt(stored, 10) : 0
  })

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      setError(false)
      const res = await api.get('/dashboard/notifications')
      setData(res.data?.data || { total: 0, groups: [] })
    } catch (err) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      const now = Date.now()
      setDismissedAt(now)
      localStorage.setItem('admin_notifications_seen', String(now))
    }
  }

  const goTo = (link) => {
    setOpen(false)
    navigate(link)
  }

  const newestAt = data.groups.reduce((acc, g) => {
    const t = g.items?.[0]?.at ? new Date(g.items[0].at).getTime() : 0
    return Math.max(acc, t)
  }, 0)
  const hasUnseen = data.total > 0 && newestAt > dismissedAt

  const formatAt = (at) => {
    if (!at) return ''
    const diff = Date.now() - new Date(at).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    return `${d}d ago`
  }

  const sevClass = (s) => ({
    warning: 'md-notif-warning',
    danger: 'md-notif-danger',
    info: 'md-notif-info',
    success: 'md-notif-success'
  })[s] || ''

  return (
    <div className="md-notif-wrap" ref={containerRef}>
      <button
        className="md-icon-btn"
        title="Notifications"
        aria-label={`Notifications${data.total ? ` — ${data.total} pending` : ''}`}
        onClick={toggle}
      >
        <span className="material-symbols-outlined">notifications</span>
        {data.total > 0 && (
          <span className={`md-notif-badge ${hasUnseen ? 'pulse' : ''}`}>
            {data.total > 99 ? '99+' : data.total}
          </span>
        )}
      </button>

      {open && (
        <div className="md-notif-panel" role="dialog" aria-label="Notifications">
          <div className="md-notif-header">
            <div>
              <div className="md-notif-title">Notifications</div>
              <div className="md-notif-sub">
                {data.total === 0 ? 'You’re all caught up' : `${data.total} item${data.total === 1 ? '' : 's'} need attention`}
              </div>
            </div>
            <button
              className="md-icon-btn"
              title="Refresh"
              onClick={fetchNotifications}
              style={{ width: 32, height: 32 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
            </button>
          </div>

          <div className="md-notif-body">
            {loading && data.groups.length === 0 && (
              <div className="md-notif-empty"><span className="md-spinner" /> Loading…</div>
            )}

            {error && (
              <div className="md-notif-empty">
                <span className="material-symbols-outlined">cloud_off</span>
                Couldn&rsquo;t load notifications
              </div>
            )}

            {!loading && !error && data.groups.length === 0 && (
              <div className="md-notif-empty">
                <span className="material-symbols-outlined">check_circle</span>
                Nothing pending right now
              </div>
            )}

            {data.groups.map(g => (
              <div key={g.key} className={`md-notif-group ${sevClass(g.severity)}`}>
                <button className="md-notif-group-head" onClick={() => goTo(g.link)}>
                  <span className="material-symbols-outlined md-notif-group-icon">{g.icon}</span>
                  <span className="md-notif-group-title">{g.title}</span>
                  <span className="md-notif-group-count">{g.count}</span>
                </button>
                <div className="md-notif-items">
                  {g.items.map(item => (
                    <button key={item.id} className="md-notif-item" onClick={() => goTo(g.link)}>
                      <div className="md-notif-item-text">
                        <div className="md-notif-item-label">{item.label}</div>
                        <div className="md-notif-item-meta">{item.meta}</div>
                      </div>
                      <div className="md-notif-item-time">{formatAt(item.at)}</div>
                    </button>
                  ))}
                  {g.count > g.items.length && (
                    <button className="md-notif-more" onClick={() => goTo(g.link)}>
                      View all {g.count} →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function GlobalSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const [usersRes, counselorsRes] = await Promise.all([
          api.get('/users', { params: { search: q, limit: 5, page: 1 } }),
          api.get('/counselors', { params: { search: q, limit: 5, page: 1 } })
        ])
        const users = (usersRes.data?.data || []).slice(0, 5)
        const counselors = (counselorsRes.data?.data || []).slice(0, 5)
        setResults({ users, counselors })
      } catch (err) {
        setResults({ users: [], counselors: [], error: true })
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const flat = results
    ? [
        ...results.users.map(u => ({ kind: 'user', id: u._id, label: u.fullName, meta: u.email, path: '/users' })),
        ...results.counselors.map(c => ({ kind: 'counselor', id: c._id, label: c.fullName, meta: c.email, path: '/counselors' }))
      ]
    : []

  const go = (item) => {
    setOpen(false)
    setQuery('')
    navigate(item.path)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(flat.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(0, i - 1))
    } else if (e.key === 'Enter' && activeIdx >= 0 && flat[activeIdx]) {
      e.preventDefault()
      go(flat[activeIdx])
    }
  }

  const kindIcon = { user: 'group', counselor: 'psychology' }

  let idx = -1

  return (
    <div className="md-appbar-search-wrap" ref={containerRef}>
      <div className={`md-appbar-search ${open ? 'is-open' : ''}`}>
        <span className="material-symbols-outlined">search</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search users, consultants…"
          aria-label="Search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(-1) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <kbd className="md-kbd">Ctrl K</kbd>
      </div>

      {open && query.trim().length >= 2 && (
        <div className="md-search-dropdown" role="listbox">
          {loading && <div className="md-search-empty"><span className="md-spinner" /> Searching…</div>}

          {!loading && results && flat.length === 0 && (
            <div className="md-search-empty">
              <span className="material-symbols-outlined">search_off</span>
              No matches for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && results && results.users.length > 0 && (
            <div className="md-search-group">
              <div className="md-search-group-title">Users</div>
              {results.users.map(u => {
                idx++
                const isActive = idx === activeIdx
                return (
                  <button key={`u-${u._id}`} className={`md-search-item ${isActive ? 'active' : ''}`} onClick={() => go({ path: '/users' })}>
                    <span className="material-symbols-outlined md-search-icon">{kindIcon.user}</span>
                    <span className="md-search-text">
                      <span className="md-search-label">{u.fullName || 'Unnamed'}</span>
                      <span className="md-search-meta">{u.email}</span>
                    </span>
                    {u.isActive === false && <span className="badge danger" style={{ minHeight: 22, padding: '2px 8px', fontSize: 11 }}>Inactive</span>}
                  </button>
                )
              })}
            </div>
          )}

          {!loading && results && results.counselors.length > 0 && (
            <div className="md-search-group">
              <div className="md-search-group-title">Consultants</div>
              {results.counselors.map(c => {
                idx++
                const isActive = idx === activeIdx
                return (
                  <button key={`c-${c._id}`} className={`md-search-item ${isActive ? 'active' : ''}`} onClick={() => go({ path: '/counselors' })}>
                    <span className="material-symbols-outlined md-search-icon">{kindIcon.counselor}</span>
                    <span className="md-search-text">
                      <span className="md-search-label">{c.fullName || 'Unnamed'}</span>
                      <span className="md-search-meta">{c.email}</span>
                    </span>
                    {c.isVerified && <span className="badge success" style={{ minHeight: 22, padding: '2px 8px', fontSize: 11 }}>Verified</span>}
                  </button>
                )
              })}
            </div>
          )}

          <div className="md-search-hint">
            <kbd className="md-kbd">↑</kbd><kbd className="md-kbd">↓</kbd> navigate
            <kbd className="md-kbd">↵</kbd> open
            <kbd className="md-kbd">Esc</kbd> close
          </div>
        </div>
      )}
    </div>
  )
}

export default ProtectedRoute
