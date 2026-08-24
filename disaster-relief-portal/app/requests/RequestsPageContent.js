'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Activity } from 'lucide-react';
import RequestsTable from '../components/RequestsTable';

const RequestForm = dynamic(() => import('../components/RequestForm'), { ssr: false });

export default function RequestsPageContent() {
  const [requests, setRequests] = useState([]);
  const [filters, setFilters] = useState({ status: '', type: '', urgency: '' });
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
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
    loadRequests().catch((e) => setError(e.message));
  }, [query]);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-[#E2E8F0]/60 bg-white p-6 lg:p-8 shadow-card">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-orange-50/60 via-transparent to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#64748B]">
              <Activity className="h-3 w-3 text-[#FF7A30]" />
              Relief Coordination
            </div>
            <h2 className="mt-3 text-[28px] font-bold tracking-tight text-[#0F172A] leading-tight">
              Create, assign & track relief requests
            </h2>
            <p className="mt-1 text-[15px] leading-relaxed text-[#64748B] max-w-xl">
              Submit new requests, assign volunteers and resources, and monitor progress through the fulfillment pipeline.
            </p>
          </div>
        </div>
      </section>

      <RequestForm onCreated={loadRequests} />
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <RequestsTable requests={requests} filters={filters} onFiltersChange={setFilters} onRefresh={loadRequests} />
    </div>
  );
}
