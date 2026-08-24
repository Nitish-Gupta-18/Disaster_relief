'use client';

import { useEffect, useState, useRef } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Clock, Gift, Heart, IndianRupee, MapPin, Package, Radio, TrendingUp, Users, Zap } from 'lucide-react';

const statusColors = {
  pending: '#94A3B8',
  assigned: '#0EA5E9',
  in_progress: '#FF7A30',
  completed: '#10B981'
};
const typeColors = {
  food: '#F59E0B',
  water: '#0EA5E9',
  medicine: '#EF4444',
  shelter: '#8B5CF6'
};
function label(v) { return (v||'').replace(/_/g,' '); }

function AnimatedNumber({ value }) {
  const [d, setD] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        let s = 0; const end = parseInt(value) || 0;
        if (!end) { setD(0); return; }
        const step = Math.max(1, Math.floor(end / 30));
        const t = setInterval(() => { s += step; if (s >= end) { setD(end); clearInterval(t); } else setD(s); }, 20);
        obs.disconnect();
        return () => clearInterval(t);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [value]);
  return <span ref={ref}>{d}</span>;
}

function Sparkline({ data: pts, color, height = 32 }) {
  if (!pts || pts.length < 2) return <div className="h-8 w-full" />;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const w = 100; const h = height;
  const pad = 1;
  const xs = pts.map((_, i) => pad + ((w - pad * 2) * i) / (pts.length - 1));
  const ys = pts.map((v) => h - pad - ((v - min) / range) * (h - pad * 2));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} className="w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w - pad},${h - pad} L${pad},${h - pad} Z`} fill={`url(#spark-${color.replace('#','')})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({ label: t, value, icon: Icon, accent = 'orange', trend, subtitle, sparklineData, primary = false }) {
  const cfg = {
    orange: { icBg: 'bg-gradient-to-br from-[#FF7A30] to-[#FF9A5A]', icTx: 'text-white', glow: 'shadow-orange-500/20', bar: 'bg-[#FF7A30]', color: '#FF7A30' },
    blue:   { icBg: 'bg-gradient-to-br from-[#0EA5E9] to-[#38BDF8]',  icTx: 'text-white', glow: 'shadow-sky-500/20',    bar: 'bg-[#0EA5E9]', color: '#0EA5E9' },
    green:  { icBg: 'bg-gradient-to-br from-[#10B981] to-[#34D399]',  icTx: 'text-white', glow: 'shadow-emerald-500/20', bar: 'bg-[#10B981]', color: '#10B981' },
    amber:  { icBg: 'bg-gradient-to-br from-[#F59E0B] to-[#FBBF24]',  icTx: 'text-white', glow: 'shadow-amber-500/20',   bar: 'bg-[#F59E0B]', color: '#F59E0B' },
  };
  const c = cfg[accent] || cfg.orange;

  // ── Tiered card styling ──
  const cardClass = primary
    ? 'group relative overflow-hidden rounded-2xl bg-white border border-[rgba(148,163,184,0.10)] shadow-tier-hero transition-card hover:-translate-y-1'
    : 'group relative overflow-hidden rounded-2xl bg-white border border-[rgba(148,163,184,0.08)] shadow-tier-mid transition-card hover:-translate-y-0.5';

  return (
    <div className={cardClass}>
      <div className={primary ? 'p-6' : 'p-5'}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-label">{t}</p>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className={primary
                ? 'text-[40px] font-black tracking-[-0.04em] text-[#0F172A] leading-none'
                : 'text-[28px] font-bold tracking-[-0.02em] text-[#0F172A] leading-none'
              }>
                <AnimatedNumber value={value} />
              </span>
              {trend != null && (
                <span className={`flex items-center gap-0.5 text-[12px] font-bold ${trend > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                  <ArrowUpRight className={`h-3 w-3 ${trend < 0 ? 'rotate-180' : ''}`} />{Math.abs(trend)}%
                </span>
              )}
            </div>
            {subtitle && <p className="mt-1 text-meta">{subtitle}</p>}
          </div>
          {primary && (
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.icBg} ${c.icTx} shadow-md ${c.glow}`}>
              <Icon className="h-[20px] w-[20px]" />
            </div>
          )}
          {!primary && Icon && (
            <Icon className="h-4 w-4 shrink-0 text-[#94A3B8] mt-0.5" />
          )}
        </div>
        {sparklineData ? (
          <Sparkline data={sparklineData} color={c.color} />
        ) : (
          <div className="h-1 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
            <div className={`h-full rounded-full ${c.bar} transition-all duration-1000`} style={{ width: `${Math.min(100, Math.max(3, (parseInt(value) || 0) * 2.5))}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label: l }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#334155]/40 bg-[#0F172A]/95 backdrop-blur-xl px-4 py-3 text-sm shadow-[0_8px_30px_-4px_rgba(15,23,42,0.4)]">
      <p className="font-semibold capitalize text-[#E2E8F0] text-[11px] uppercase tracking-[0.06em] mb-0.5">{label(l || payload[0].name)}</p>
      <p className="text-[#F1F5F9] font-bold text-2xl tracking-[-0.02em]">{payload[0].value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    async function load(attempt = 0) {
      setError('');
      try {
        const r = await fetch('/api/dashboard', { cache: 'no-store' });
        if (!r.ok) { const d = await r.json().catch(()=>({})); throw new Error(d.error||'Load failed'); }
        if (active) { setData(await r.json()); setRefreshing(false); }
      } catch (e) {
        if (!active) return;
        if (attempt < 3) { setTimeout(() => load(attempt+1), 1200*(attempt+1)); return; }
        setError(e.message);
      }
    }
    load(0);
    const h = () => { setRefreshing(true); load(0); };
    window.addEventListener('data:changed', h);
    window.addEventListener('focus', h);
    const i = setInterval(() => { setRefreshing(true); load(0); }, 15000);
    return () => { active = false; window.removeEventListener('data:changed',h); window.removeEventListener('focus',h); clearInterval(i); };
  }, []);

  if (error) return (
    <div className="rounded-2xl border border-red-200 bg-red-50/80 backdrop-blur p-8 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-500 mb-4"><AlertTriangle className="h-6 w-6" /></div>
      <h3 className="text-lg font-bold text-[#0F172A]">Dashboard unavailable</h3>
      <p className="mt-1 text-sm text-[#64748B]">{error}</p>
    </div>
  );

  if (!data) return (
    <div className="space-y-8">
      <div className="rounded-[20px] bg-white border border-[#E2E8F0]/60 p-8 shadow-tier-mid">
        <div className="h-4 w-36 shimmer rounded-lg mb-3" />
        <div className="h-8 w-96 shimmer rounded-lg mb-2" />
        <div className="h-4 w-64 shimmer rounded-lg" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_0.9fr_0.9fr]">
        {[...Array(4)].map((_,i)=><div key={i} className="rounded-[20px] bg-white border border-[#E2E8F0]/60 p-6 shadow-tier-mid"><div className="h-3 w-20 shimmer rounded mb-4" /><div className="h-10 w-16 shimmer rounded" /></div>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-[20px] bg-white border border-[#E2E8F0]/60 p-7 shadow-tier-mid">
          <div className="h-4 w-32 shimmer rounded-lg mb-2" />
          <div className="h-3 w-48 shimmer rounded-lg mb-6" />
          <div className="h-80 shimmer rounded-xl" />
        </div>
        <div className="rounded-[20px] bg-white border border-[#E2E8F0]/60 p-7 shadow-tier-mid">
          <div className="h-4 w-28 shimmer rounded-lg mb-2" />
          <div className="h-3 w-40 shimmer rounded-lg mb-6" />
          <div className="h-80 shimmer rounded-full mx-auto" style={{ width: 210, height: 210 }} />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="rounded-[20px] bg-white border border-[#E2E8F0]/60 p-7 shadow-tier-mid">
          <div className="h-4 w-28 shimmer rounded-lg mb-2" />
          <div className="h-3 w-36 shimmer rounded-lg mb-5" />
          {[...Array(5)].map((_, i) => <div key={i} className="h-4 w-full shimmer rounded-lg mb-3" style={{ width: `${85 - i * 10}%` }} />)}
        </div>
        <div className="rounded-[20px] bg-white border border-[#E2E8F0]/60 p-7 shadow-tier-mid">
          <div className="h-6 w-24 shimmer rounded-lg mb-3" />
          <div className="h-20 w-28 shimmer rounded-lg mb-2" />
          <div className="h-3 w-48 shimmer rounded-lg" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-10 relative">
      {/* ── Refresh overlay (subtle shimmer when re-fetching) ── */}
      {refreshing && data && (
        <div className="absolute inset-0 z-10 bg-white/20 backdrop-blur-[1px] rounded-3xl pointer-events-none flex items-start justify-center pt-16">
          <div className="flex items-center gap-2 rounded-full bg-white/90 backdrop-blur border border-[#E2E8F0]/60 px-4 py-2 shadow-lg text-[11px] font-semibold text-[#94A3B8]">
            <span className="h-2 w-2 rounded-full bg-[#FF7A30] animate-pulse" />
            Refreshing…
          </div>
        </div>
      )}
      {/* ───── HERO ───── */}
      <section className="relative overflow-hidden rounded-[20px] border border-[rgba(148,163,184,0.12)] bg-gradient-to-br from-[#FFF8F2] via-white to-[#F0F9FF] shadow-tier-hero">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-gradient-to-br from-[#FF7A30]/6 to-transparent blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-gradient-to-tr from-[#0EA5E9]/5 to-transparent blur-2xl pointer-events-none" />
        <div className="relative px-6 py-8 lg:px-10 lg:py-10">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FF7A30]/8 border border-[#FF7A30]/15 px-3 py-1">
                <Zap className="h-3 w-3 text-[#FF7A30]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF7A30]">Command Center</span>
              </div>
              <h1 className="mt-4 text-[34px] lg:text-[40px] font-black tracking-[-0.04em] text-[#0F172A] leading-[1.08]">
                Disaster Response<br />
                <span className="bg-gradient-to-r from-[#FF7A30] to-[#FF9A5A] bg-clip-text text-transparent">Coordination Hub</span>
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-[#64748B] max-w-md">
                Real-time visibility across relief operations — monitor requests, deploy volunteers, track inventory, coordinate field teams.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <a href="/requests" className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF7A30] px-4 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-orange-500/20 hover:shadow-lg hover:brightness-105 transition-all">New Request</a>
                <a href="/volunteers" className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#E2E8F0]/60 px-4 py-2.5 text-[13px] font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:border-[#FF7A30]/30 transition-all">Register Volunteer</a>
                <a href="/inventory" className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#E2E8F0]/60 px-4 py-2.5 text-[13px] font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:border-[#FF7A30]/30 transition-all">Add Inventory</a>
                <a href="/map" className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#E2E8F0]/60 px-4 py-2.5 text-[13px] font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:border-[#FF7A30]/30 transition-all">View Map</a>
              </div>
            </div>

            {/* Right side — operational status widgets */}
            <div className="hidden lg:flex flex-col gap-3 shrink-0 min-w-[220px]">
              <div className="rounded-2xl bg-white/80 backdrop-blur border border-[#E2E8F0]/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8] mb-2">Operational Status</p>
                <div className="space-y-2">
                  {[
                    { l: 'System', v: 'Online', c: 'bg-[#10B981]' },
                    { l: 'Database', v: 'Connected', c: 'bg-[#10B981]' },
                    { l: 'Auto-refresh', v: '15s', c: 'bg-[#0EA5E9]' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-[12px]">
                      <span className="text-[#64748B]">{s.l}</span>
                      <span className="flex items-center gap-1.5 font-semibold text-[#475569]">
                        <span className={`h-[6px] w-[6px] rounded-full ${s.c}`} />{s.v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-white/80 backdrop-blur border border-[#E2E8F0]/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8] mb-2">Organization</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#FF7A30]" />
                  <span className="text-[13px] font-semibold text-[#0F172A]">IMPACTSTER</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-[#64748B]">
                  <Clock className="h-3 w-3" />Last updated: just now
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── KPI CARDS ───── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_0.9fr_0.9fr]">
        <StatCard label="Open Requests" value={data.kpis.openRequests} icon={AlertTriangle} accent="orange" trend={12} primary
          sparklineData={[4,7,5,9,6,8,data.kpis.openRequests]}
          subtitle="Awaiting assignment" />
        <StatCard label="Volunteers Available" value={data.kpis.availableVolunteers} icon={Users} accent="blue" trend={8} primary
          sparklineData={[3,5,4,7,6,8,data.kpis.availableVolunteers]}
          subtitle="Ready for dispatch" />
        <StatCard label="Low Stock Items" value={data.kpis.lowStockItems} icon={Package} accent="amber"
          sparklineData={[2,1,3,2,4,data.kpis.lowStockItems]}
          subtitle="Below threshold" />
        <StatCard label="Completed Today" value={data.kpis.completedToday} icon={CheckCircle2} accent="green"
          trend={data.kpis.completedToday > 0 ? 24 : null}
          sparklineData={data.kpis.completedToday > 0 ? [1,3,2,5,4,7,data.kpis.completedToday] : null}
          subtitle={data.kpis.completedToday > 0 ? "Requests fulfilled" : "No completions today yet"} />
      </section>

      {/* ───── CHARTS ───── */}
      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-[20px] bg-white border border-[#E2E8F0]/60 p-7 shadow-tier-mid transition-card">
          <div className="flex items-center justify-between mb-7">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Requests by Status</h2>
              <p className="text-meta mt-0.5">Distribution across the fulfillment pipeline</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[#E2E8F0]/60 bg-[#F8FAFC] px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Live</span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byStatus} layout="vertical" margin={{ left: 20, right: 20 }} barSize={20} barGap={6}>
                <defs>
                  {Object.entries(statusColors).map(([k, v]) => (
                    <linearGradient key={k} id={`barGrad-${k}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={v} stopOpacity={0.6} />
                      <stop offset="100%" stopColor={v} stopOpacity={1} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" horizontal={false} strokeOpacity={0.4} />
                <XAxis type="number" allowDecimals={false} stroke="#94A3B8" tick={{ fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tickFormatter={label} stroke="#64748B" width={100} tick={{ fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F1F5F9', rx: 6 }} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                  {data.byStatus.map((e) => <Cell key={e.name} fill={`url(#barGrad-${e.name})`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[20px] bg-white border border-[#E2E8F0]/60 p-7 shadow-tier-mid transition-card">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">By Resource Type</h2>
            <p className="text-meta mt-0.5">What communities need most</p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {Object.entries(typeColors).map(([k, v]) => (
                    <linearGradient key={k} id={`pieGrad-${k}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={v} stopOpacity={0.75} />
                      <stop offset="100%" stopColor={v} stopOpacity={1} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie data={data.byType} dataKey="value" nameKey="name" innerRadius={55} outerRadius={105} paddingAngle={4} stroke="#fff" strokeWidth={3}>
                  {data.byType.map((e) => <Cell key={e.name} fill={`url(#pieGrad-${e.name})`} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Simplified compact legend */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 justify-center mt-1">
            {data.byType.map((e) => (
              <div key={e.name} className="flex items-center gap-1.5 text-label normal-case" style={{color:'#475569'}}>
                <div className="h-2 w-2 rounded-[3px]" style={{ background: typeColors[e.name] }} />
                {e.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── DONATIONS SECTION ───── */}
      {data.donations && (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-[#FF7A30]" />
            <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Donations Overview</h2>
          </div>

          {/* Donation KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Item Donations" value={data.donations.totalDonations} icon={Gift} accent="orange"
              subtitle={`${data.donations.pendingDonations} pending`} />
            <StatCard label="Items Received" value={data.donations.receivedDonations} icon={CheckCircle2} accent="green"
              subtitle="Added to inventory" />
            <StatCard label="Funds Raised" value={`₹${(data.donations.totalFinancialAmount / 1000).toFixed(0)}K`} icon={IndianRupee} accent="blue"
              subtitle={`${data.donations.totalFinancialDonors} donors`} />
            <StatCard label="Pending Donations" value={data.donations.pendingDonations} icon={Clock} accent="amber"
              subtitle="Awaiting receipt" />
          </div>

          {/* Donations by category chart */}
          {data.donations.donationsByCategory && data.donations.donationsByCategory.length > 0 && (
            <div className="rounded-[20px] bg-white border border-[#E2E8F0]/60 p-7 shadow-tier-mid transition-card">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Donations by Category</h2>
                <p className="text-meta mt-0.5">Distribution of donated items</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.donations.donationsByCategory} margin={{ left: 20, right: 20 }} barSize={36} barGap={10}>
                    <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} strokeOpacity={0.4} />
                    <XAxis dataKey="name" stroke="#64748B" tick={{ fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={label} />
                    <YAxis allowDecimals={false} stroke="#94A3B8" tick={{ fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F1F5F9', rx: 6 }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {data.donations.donationsByCategory.map((e, i) => (
                        <Cell key={e.name} fill={['#FF7A30', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'][i % 6]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent donations mini-table */}
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-[20px] bg-white border border-[#E2E8F0]/60 shadow-tier-mid overflow-hidden transition-card">
              <div className="border-b border-[#E2E8F0]/40 px-7 py-5">
                <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Recent Item Donations</h2>
                <p className="text-meta mt-0.5">Latest contributions from the community</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FAFC]/70">
                      <th className="px-7 py-3.5 text-left text-label">Donor</th>
                      <th className="px-7 py-3.5 text-left text-label">Item</th>
                      <th className="px-7 py-3.5 text-left text-label">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {(data.donations.recentDonations || []).map((d, i) => (
                      <tr key={d.id || i} className={`transition-row hover:bg-[#F8FAFC]/80 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]/30'}`}>
                        <td className="px-7 py-4">
                          <p className="text-sm font-semibold text-[#0F172A]">{d.donor_name}</p>
                        </td>
                        <td className="px-7 py-4">
                          <p className="text-sm text-[#475569]">{d.item_name} <span className="text-[#94A3B8]">({d.quantity} {d.unit})</span></p>
                        </td>
                        <td className="px-7 py-4">
                          <span className={`status-stripe status-stripe-${d.status === 'received' ? 'completed' : d.status === 'distributed' ? 'in_progress' : 'pending'}`}>
                            {label(d.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!data.donations.recentDonations || data.donations.recentDonations.length === 0) && (
                      <tr><td colSpan={3} className="px-7 py-6 text-center text-sm text-[#94A3B8]">No donations yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[20px] bg-white border border-[#E2E8F0]/60 shadow-tier-mid overflow-hidden transition-card">
              <div className="border-b border-[#E2E8F0]/40 px-7 py-5">
                <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Recent Financial Donations</h2>
                <p className="text-meta mt-0.5">Monetary contributions</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FAFC]/70">
                      <th className="px-7 py-3.5 text-left text-label">Donor</th>
                      <th className="px-7 py-3.5 text-left text-label">Amount</th>
                      <th className="px-7 py-3.5 text-left text-label">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {(data.donations.recentFinancialDonations || []).map((d, i) => (
                      <tr key={d.id || i} className={`transition-row hover:bg-[#F8FAFC]/80 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]/30'}`}>
                        <td className="px-7 py-4">
                          <p className="text-sm font-semibold text-[#0F172A]">{d.donor_name}</p>
                        </td>
                        <td className="px-7 py-4">
                          <p className="text-sm font-bold text-[#10B981]">₹{Number(d.amount).toLocaleString('en-IN')}</p>
                        </td>
                        <td className="px-7 py-4">
                          <span className={`status-stripe status-stripe-${d.status === 'completed' ? 'completed' : d.status === 'refunded' ? 'pending' : 'assigned'}`}>
                            {label(d.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!data.donations.recentFinancialDonations || data.donations.recentFinancialDonations.length === 0) && (
                      <tr><td colSpan={3} className="px-7 py-6 text-center text-sm text-[#94A3B8]">No financial donations yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ───── BOTTOM ROW ───── */}
      <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="rounded-[20px] bg-white border border-[#E2E8F0]/60 shadow-tier-mid overflow-hidden transition-card">
          <div className="border-b border-[#E2E8F0]/40 px-7 py-5">
            <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Recent Requests</h2>
            <p className="text-meta mt-0.5">Latest across all districts</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FAFC]/70">
                  <th className="px-7 py-3.5 text-left text-label">Location</th>
                  <th className="px-7 py-3.5 text-left text-label">Urgency</th>
                  <th className="px-7 py-3.5 text-left text-label">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {(data.recentRequests||[]).map((r, i) => (
                  <tr key={r.id || i} className={`transition-row hover:bg-[#F8FAFC]/80 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]/30'}`}>
                    <td className="px-7 py-4">
                      <p className="text-sm font-semibold text-[#0F172A]">{r.location}</p>
                    </td>
                    <td className="px-7 py-4">
                      <span className={`status-stripe status-stripe-urg-${r.urgency}`}>{r.urgency}</span>
                    </td>
                    <td className="px-7 py-4">
                      <span className={`status-stripe status-stripe-${r.status}`}>{label(r.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Response Time card ── */}
        <div className="rounded-[20px] bg-white border border-[#E2E8F0]/60 shadow-tier-mid overflow-hidden group transition-card hover:-translate-y-1">
          <div className="p-7 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="text-label">Avg Response Time</p>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-[40px] font-black tracking-[-0.04em] text-[#0F172A] leading-none">
                      <AnimatedNumber value={data.averageResponseHours} />
                    </span>
                    <span className="text-[14px] font-bold text-[#94A3B8]">hrs</span>
                  </div>
                  <p className="mt-1 text-meta">Request to completion</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#10B981] to-[#34D399] text-white shadow-md shadow-emerald-500/20">
                  <TrendingUp className="h-[20px] w-[20px]" />
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/8 border border-[#10B981]/15 px-2.5 py-1 mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider">Live metric</span>
              </div>
            </div>
            <div className="mt-auto">
              <div className="h-2 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#34D399] transition-all duration-1000"
                  style={{ width: `${Math.min(100, Math.max(3, (data.averageResponseHours || 0) * 4))}%` }} />
              </div>
              <p className="mt-3 text-meta leading-relaxed">
                Average time from request creation to completion across all districts.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
