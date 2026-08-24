import { useEffect, useMemo, useState } from 'react';
import RequestForm from '../components/RequestForm.jsx';
import RequestsTable from '../components/RequestsTable.jsx';

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [filters, setFilters] = useState({ status: '', type: '', urgency: '' });
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  async function loadRequests() {
    setError('');
    const response = await fetch(`/api/requests${query ? `?${query}` : ''}`);
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Unable to load requests');
    }
    setRequests(await response.json());
  }

  useEffect(() => {
    loadRequests().catch((loadError) => setError(loadError.message));
  }, [query]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-orange-50/80 to-teal-50/70 p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.28)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-relief-teal">Prototype demo flow</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">Create a request, assign support, and see the coordination hub respond in real time.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">This walkthrough helps your team experience the core relief-response journey in a calm, credible, and highly organized way.</p>
          </div>
          <div className="rounded-full border border-orange-100 bg-white/90 px-3 py-1 text-sm font-semibold text-relief-orange shadow-sm">Live demo</div>
        </div>
      </section>
      <RequestForm onCreated={loadRequests} />
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <RequestsTable requests={requests} filters={filters} onFiltersChange={setFilters} onRefresh={loadRequests} />
    </div>
  );
}
