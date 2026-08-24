import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const statusColors = {
  pending: '#737373',
  assigned: '#3B82F6',
  in_progress: '#FF6B35',
  completed: '#14B8A6'
};

const typeColors = {
  food: '#F59E0B',
  water: '#38BDF8',
  medicine: '#F43F5E',
  shelter: '#A78BFA'
};

function label(value) {
  return value.replace('_', ' ');
}

function KpiCard({ labelText, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-24px_rgba(15,23,42,0.45)]">
      <p className="text-sm font-medium text-slate-500">{labelText}</p>
      <p className={`mt-2 text-[28px] font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function CustomTooltip({ active, payload, label: tooltipLabel }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-relief-border bg-white px-3 py-2 text-sm text-slate-700 shadow-lg">
      <p className="font-semibold capitalize text-slate-900">{label(tooltipLabel || payload[0].name)}</p>
      <p>{payload[0].value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const maxRetries = 3;

    async function loadDashboard(attempt = 0) {
      setError('');

      try {
        const response = await fetch('/api/dashboard', { cache: 'no-store' });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Unable to load dashboard');
        }
        const payload = await response.json();
        if (active) {
          setData(payload);
        }
      } catch (loadError) {
        if (!active) return;

        if (attempt < maxRetries) {
          window.setTimeout(() => {
            loadDashboard(attempt + 1).catch(() => {});
          }, 1200 * (attempt + 1));
          return;
        }

        setError(loadError.message);
      }
    }

    const handleDataChange = () => {
      loadDashboard(0).catch(() => {});
    };

    const handleFocus = () => {
      loadDashboard(0).catch(() => {});
    };

    loadDashboard(0).catch(() => {});

    window.addEventListener('data:changed', handleDataChange);
    window.addEventListener('focus', handleFocus);
    const intervalId = window.setInterval(() => {
      loadDashboard(0).catch(() => {});
    }, 15000);

    return () => {
      active = false;
      window.removeEventListener('data:changed', handleDataChange);
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(intervalId);
    };
  }, []);

  if (error) {
    return <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>;
  }

  if (!data) {
    return <div className="rounded-lg border border-relief-border bg-relief-surface p-4 text-sm text-neutral-400">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-orange-50/80 to-teal-50/70 p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.28)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-relief-teal">Social impact overview</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">Keep every response effort coordinated and human-centered.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">This command center helps volunteers, donors, and field teams act quickly while staying connected to the communities affected by crisis.</p>
          </div>
          <div className="rounded-full border border-orange-100 bg-white/90 px-3 py-1 text-sm font-semibold text-relief-orange shadow-sm">Live coordination</div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard labelText="Open Requests" value={data.kpis.openRequests} tone="text-relief-orange" />
        <KpiCard labelText="Available Volunteers" value={data.kpis.availableVolunteers} tone="text-relief-teal" />
        <KpiCard labelText="Low Stock Items" value={data.kpis.lowStockItems} tone="text-amber-300" />
        <KpiCard labelText="Requests Completed Today" value={data.kpis.completedToday} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-relief-border bg-relief-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Requests by Status</h2>
            <span className="rounded-full border border-relief-border bg-slate-50 px-3 py-1 text-xs text-slate-500">Live DB</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byStatus} layout="vertical" margin={{ left: 30, right: 20 }}>
                <CartesianGrid stroke="#2a2a2a" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="#737373" />
                <YAxis dataKey="name" type="category" tickFormatter={label} stroke="#a3a3a3" width={95} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#222222' }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {data.byStatus.map((entry) => (
                    <Cell key={entry.name} fill={statusColors[entry.name]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-relief-border bg-relief-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Requests by Type</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.byType}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={66}
                  outerRadius={104}
                  paddingAngle={3}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {data.byType.map((entry) => (
                    <Cell key={entry.name} fill={typeColors[entry.name]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-relief-border bg-relief-surface shadow-sm">
          <div className="border-b border-relief-border p-4">
            <h2 className="text-lg font-semibold text-slate-900">Most Recent Requests</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-relief-border">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Urgency</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-relief-border">
                {data.recentRequests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-4 py-3 text-sm text-neutral-200">{request.location}</td>
                    <td className="px-4 py-3 text-sm capitalize text-neutral-300">{request.urgency}</td>
                    <td className="px-4 py-3 text-sm capitalize text-neutral-300">{label(request.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-relief-border bg-relief-surface p-5 shadow-sm">
            <p className="text-sm text-slate-500">Average response time</p>
            <p className="mt-2 text-[28px] font-semibold text-slate-900">{data.averageResponseHours}h</p>
            <p className="mt-1 text-sm text-slate-500">Pending to completed</p>
          </div>

          <div className="rounded-2xl border border-relief-border bg-relief-surface shadow-sm">
            <div className="border-b border-relief-border p-4">
              <h2 className="text-lg font-semibold text-slate-900">Area-wise Impact</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-relief-border">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Area</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Requests</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">People</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-relief-border">
                  {data.areaImpact.map((area) => (
                    <tr key={area.area}>
                      <td className="px-4 py-3 text-sm text-neutral-200">{area.area}</td>
                      <td className="px-4 py-3 text-right text-sm text-neutral-300">{area.request_count}</td>
                      <td className="px-4 py-3 text-right text-sm text-neutral-300">{area.people_impacted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
