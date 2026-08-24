'use client';

import dynamic from 'next/dynamic';
import { Shield } from 'lucide-react';

const AdminPanel = dynamic(() => import('../components/AdminPanel'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-[#E2E8F0]/80 bg-white p-8 shadow-tier-mid">
      <div className="space-y-4">
        <div className="h-5 w-48 shimmer rounded-lg" />
        <div className="h-4 w-96 shimmer rounded-lg" />
        <div className="h-80 shimmer rounded-xl mt-4" />
      </div>
    </div>
  )
});

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF7A30] to-[#F97316] shadow-md shadow-orange-500/20">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0F172A]">Admin Control Panel</h1>
          <p className="text-meta">Assign volunteers to tasks, track progress, manage the relief operation</p>
        </div>
      </div>
      <AdminPanel />
    </div>
  );
}
