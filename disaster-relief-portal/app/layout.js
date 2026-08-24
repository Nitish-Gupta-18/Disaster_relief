'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, Bell, Box, ChevronLeft, ChevronRight, Globe, Heart, Home, IndianRupee, Layers, ListChecks, LogIn, LogOut, Map, Menu, Radio, Settings, Shield, UserPlus, Users, X } from 'lucide-react';
import { AuthProvider, useAuth } from './components/AuthContext';
import './globals.css';

const pageTitles = {
  dashboard: 'Command Center',
  requests: 'Relief Requests',
  volunteers: 'Volunteers',
  inventory: 'Inventory',
  donations: 'Donations',
  donate: 'Public Donation Page',
  map: 'Live Disaster Map',
  admin: 'Admin Control Panel',
  settings: 'Settings'
};

// ─── Inner app shell that consumes AuthContext ───
function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout, isAdmin } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [eventName, setEventName] = useState('IMPACTSTER Flood Response');
  const [stats, setStats] = useState({ requests: 0, volunteers: 0, inventory: 0 });
  const [liveKpis, setLiveKpis] = useState(null);
  const [statsBarDismissed, setStatsBarDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('eventName');
    if (stored) setEventName(stored);
    const collapsed = localStorage.getItem('sidebarCollapsed');
    if (collapsed === 'true') setSidebarCollapsed(true);
    const dismissed = localStorage.getItem('statsBarDismissed');
    if (dismissed === 'true') setStatsBarDismissed(true);
  }, []);

  // ── Protect admin route ──
  useEffect(() => {
    if (loading) return;
    if (pathname.startsWith('/admin') && !isAdmin) {
      if (!user) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      } else {
        router.replace('/');
      }
    }
  }, [pathname, loading, isAdmin, user, router]);

  // ── Live KPI polling ──
  useEffect(() => {
    let active = true;
    async function load() {
      try { const r = await fetch('/api/dashboard'); if (r.ok && active) setLiveKpis(await r.json()); } catch {}
    }
    load();
    const h = () => load();
    window.addEventListener('data:changed', h);
    window.addEventListener('focus', h);
    const i = setInterval(load, 15000);
    return () => { active = false; window.removeEventListener('data:changed', h); window.removeEventListener('focus', h); clearInterval(i); };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [r, v, i] = await Promise.all([fetch('/api/requests'), fetch('/api/volunteers'), fetch('/api/inventory')]);
        setStats({ requests: r.ok ? (await r.json()).length : 0, volunteers: v.ok ? (await v.json()).length : 0, inventory: i.ok ? (await i.json()).length : 0 });
      } catch {}
    };
    load();
    const interval = setInterval(load, 45000);
    return () => clearInterval(interval);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => { localStorage.setItem('sidebarCollapsed', !prev); return !prev; });
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const activePage = pathname === '/' ? 'dashboard' : pathname.replace('/', '') || 'dashboard';
  const title = pageTitles[activePage] || 'Command Center';

  // ── Public pages (no sidebar) ──
  const isPublicPage = pathname.startsWith('/donate') || pathname.startsWith('/login') || pathname.startsWith('/signup');

  // ── Build nav groups dynamically based on role ──
  const navGroups = [
    {
      label: 'Operations',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/' },
        { id: 'requests', label: 'Requests', icon: ListChecks, href: '/requests' },
        { id: 'volunteers', label: 'Volunteers', icon: Users, href: '/volunteers' },
        { id: 'inventory', label: 'Inventory', icon: Box, href: '/inventory' },
        { id: 'donations', label: 'Donations', icon: Heart, href: '/donations' },
      ]
    },
    // Admin section — only visible to admin users
    ...(isAdmin ? [{
      label: 'Admin',
      items: [
        { id: 'admin', label: 'Admin Panel', icon: Shield, href: '/admin' },
      ]
    }] : []),
    {
      label: 'Tools',
      items: [
        { id: 'map', label: 'Live Map', icon: Map, href: '/map' },
        { id: 'donate', label: 'Public Donate', icon: IndianRupee, href: '/donate' },
        { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
      ]
    }
  ];

  // ── Show loading spinner while auth loads ──
  if (loading) {
    return (
      <html lang="en">
        <body>
          <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF7A30] border-t-transparent" />
              <span className="text-sm text-[#94A3B8]">Loading...</span>
            </div>
          </div>
        </body>
      </html>
    );
  }

  // ── If protected admin route but not admin, show nothing (redirect happening) ──
  if (pathname.startsWith('/admin') && !isAdmin) {
    return (
      <html lang="en">
        <body>
          <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF7A30] border-t-transparent" />
              <span className="text-sm text-[#94A3B8]">Redirecting...</span>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        {isPublicPage ? (
          children
        ) : (
        <div className="flex min-h-screen">
          {sidebarOpen && (
            <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
          )}

          {/* ─── SIDEBAR ─── */}
          <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#E2E8F0]/30 bg-white/92 backdrop-blur-2xl transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] lg:sticky lg:top-0 lg:h-screen lg:shrink-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } ${sidebarCollapsed ? 'w-[72px]' : 'w-[240px]'}`}>

            {/* Logo */}
            <div className={`flex items-center border-b border-[#E2E8F0]/30 ${sidebarCollapsed ? 'justify-center px-0 py-5' : 'px-5 py-5 gap-3'}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF7A30] to-[#FF9A5A] text-sm font-black text-white shadow-lg shadow-orange-500/20">IM</div>
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold tracking-tight text-[#0F172A] leading-tight">IMPACTSTER Command Desk</p>
                  <input value={eventName} onChange={(e) => { setEventName(e.target.value); localStorage.setItem('eventName', e.target.value); }}
                    className="mt-0.5 w-full bg-transparent text-[11px] font-medium text-[#94A3B8] outline-none border-b border-transparent hover:border-[#E2E8F0]/60 focus:border-[#FF7A30] transition leading-tight" title="Edit event name" />
                </div>
              )}
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              {navGroups.map((group) => (
                <div key={group.label}>
                  {!sidebarCollapsed && (
                    <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">{group.label}</p>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = activePage === item.id;
                      const isAdminItem = group.label === 'Admin';
                      return (
                        <Link key={item.id} href={item.href} title={sidebarCollapsed ? item.label : undefined}
                          className={`group relative flex items-center rounded-xl text-[13px] font-semibold transition-all duration-300 ${
                            sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2.5'
                          } ${
                            active
                              ? isAdminItem
                                ? 'bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] text-white shadow-[0_8px_24px_-4px_rgba(139,92,246,0.3)]'
                                : 'bg-gradient-to-r from-[#FF7A30] to-[#FF9A5A] text-white shadow-[0_8px_24px_-4px_rgba(255,122,48,0.3)]'
                              : 'text-[#475569] hover:bg-[#F1F5F9]/80 hover:text-[#0F172A]'
                          }`}>
                          <Icon className={`shrink-0 ${sidebarCollapsed ? 'h-[18px] w-[18px]' : 'h-[16px] w-[16px]'} ${active ? 'text-white' : 'text-[#94A3B8] group-hover:text-[#64748B]'}`} />
                          {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                          {active && !sidebarCollapsed && <div className="ml-auto h-[5px] w-[5px] rounded-full bg-white/80" />}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Stats */}
            {!sidebarCollapsed && (
              <div className="mx-3 mb-3 grid grid-cols-2 gap-2">
                {[
                  { v: stats.requests, l: 'Requests', c: 'text-[#FF7A30]', bg: 'from-[#FF7A30]/5 to-[#FF9A5A]/5', b: 'border-[#FF7A30]/10' },
                  { v: stats.volunteers, l: 'Volunteers', c: 'text-[#0EA5E9]', bg: 'from-[#0EA5E9]/5 to-[#38BDF8]/5', b: 'border-[#0EA5E9]/10' },
                ].map((s, i) => (
                  <div key={i} className={`rounded-xl bg-gradient-to-br ${s.bg} border ${s.b} px-3 py-2.5`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{s.l}</p>
                    <p className={`mt-0.5 text-lg font-bold ${s.c}`}>{s.v}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className={`border-t border-[#E2E8F0]/30 ${sidebarCollapsed ? 'px-2 py-3 flex justify-center' : 'px-4 py-3'}`}>
              {!sidebarCollapsed ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="h-[6px] w-[6px] rounded-full bg-[#10B981] shadow-[0_0_4px_rgba(16,185,129,0.4)] animate-pulse" />
                    <span className="text-[11px] font-medium text-[#94A3B8]">{user ? 'Online' : 'Guest'}</span>
                  </div>
                  <button onClick={toggleCollapsed} className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button onClick={toggleCollapsed} className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </aside>

          {/* ─── MAIN ─── */}
          <div className="flex flex-1 flex-col min-w-0">
            {/* Header */}
            <header className="sticky top-0 z-30 flex h-[56px] items-center gap-4 border-b border-[#E2E8F0]/30 bg-white/85 backdrop-blur-xl px-5 lg:px-8">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-lg p-2 text-[#475569] hover:bg-[#F1F5F9] lg:hidden transition" aria-label="Toggle sidebar">
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              <h1 className="text-lg font-bold tracking-tight text-[#0F172A] truncate">{title}</h1>
              <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-[#FF7A30]/8 border border-[#FF7A30]/15 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF7A30] animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF7A30]">Live</span>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <span className="hidden md:flex items-center gap-1.5 text-[12px] text-[#94A3B8]">
                  <Globe className="h-3.5 w-3.5" />{eventName}
                </span>

                <button className="relative rounded-xl p-2 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition" title="Notifications">
                  <Bell className="h-[18px] w-[18px]" />
                  <span className="absolute top-1.5 right-1.5 h-[7px] w-[7px] rounded-full bg-[#FF7A30] ring-2 ring-white" />
                </button>

                {/* ── User badge / Auth buttons ── */}
                {user ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]/50 pl-2 pr-3 py-1.5">
                      <div className={`flex h-[26px] w-[26px] items-center justify-center rounded-lg text-[10px] font-bold text-white ${
                        isAdmin ? 'bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA]' : 'bg-gradient-to-br from-[#0EA5E9] to-[#38BDF8]'
                      }`}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="hidden sm:block">
                        <span className="text-[12px] font-semibold text-[#475569]">{user.name.split(' ')[0]}</span>
                        {isAdmin && <span className="ml-1 text-[10px] font-bold text-[#8B5CF6] bg-[#8B5CF6]/10 px-1.5 py-0.5 rounded-md">ADMIN</span>}
                      </div>
                    </div>
                    <button onClick={logout} className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-red-50 hover:text-red-500 transition"
                      title="Sign out">
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Link href={`/login?redirect=${encodeURIComponent(pathname)}`}
                      className="flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475569] hover:border-[#FF7A30] hover:text-[#FF7A30] transition-all">
                      <LogIn className="h-3.5 w-3.5" /> Sign In
                    </Link>
                    <Link href="/signup"
                      className="hidden sm:flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF7A30] to-[#F97316] px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm shadow-orange-500/20 hover:brightness-105 transition-all">
                      <UserPlus className="h-3.5 w-3.5" /> Register
                    </Link>
                  </div>
                )}
              </div>
            </header>

            <main className="flex-1 p-5 lg:p-8 animate-fade-in-up">
              {children}
            </main>

            {/* ── Live Stats Bar ── */}
            {!statsBarDismissed && liveKpis && (
              <div className="sticky bottom-0 z-30 border-t border-[#E2E8F0]/50 bg-white/85 backdrop-blur-xl px-5 lg:px-8 py-2 flex items-center justify-center gap-4 text-[12px] font-semibold text-[#475569] flex-wrap relative">
                <span className="flex items-center gap-1.5"><span className="h-[7px] w-[7px] rounded-full bg-[#EF4444]" /><span className="text-[#94A3B8]">Pending</span><span className="font-bold text-[#0F172A]">{liveKpis.kpis.openRequests}</span></span>
                <span className="text-[#CBD5E1] hidden sm:inline">·</span>
                <span className="flex items-center gap-1.5"><span className="h-[7px] w-[7px] rounded-full bg-[#10B981]" /><span className="text-[#94A3B8]">Available</span><span className="font-bold text-[#0F172A]">{liveKpis.kpis.availableVolunteers}</span></span>
                <span className="text-[#CBD5E1] hidden sm:inline">·</span>
                <span className="flex items-center gap-1.5"><span className="h-[7px] w-[7px] rounded-full bg-[#F59E0B]" /><span className="text-[#94A3B8]">Low stock</span><span className="font-bold text-[#0F172A]">{liveKpis.kpis.lowStockItems}</span></span>
                <span className="text-[#CBD5E1] hidden sm:inline">·</span>
                <span className="flex items-center gap-1.5"><span className="h-[7px] w-[7px] rounded-full bg-[#10B981] animate-pulse" /><span className="text-[#94A3B8]">Completed today</span><span className="font-bold text-[#0F172A]">{liveKpis.kpis.completedToday}</span></span>
                <button onClick={() => { setStatsBarDismissed(true); localStorage.setItem('statsBarDismissed', 'true'); }}
                  className="ml-2 rounded-lg p-1 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition shrink-0" title="Dismiss">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            )}
            {statsBarDismissed && (
              <button onClick={() => { setStatsBarDismissed(false); localStorage.setItem('statsBarDismissed', 'false'); }}
                className="sticky bottom-0 z-30 mx-auto mb-2 rounded-full border border-[#E2E8F0]/60 bg-white/90 backdrop-blur-xl px-4 py-1.5 text-[11px] font-semibold text-[#94A3B8] hover:text-[#475569] hover:border-[#CBD5E1] transition shadow-sm">
                Show stats bar
              </button>
            )}
          </div>
        </div>
        )}
      </body>
    </html>
  );
}

// ─── Root layout wraps everything in AuthProvider ───
export default function RootLayout({ children }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}

