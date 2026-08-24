'use client';

import dynamic from 'next/dynamic';

const VolunteersPanel = dynamic(() => import('../components/VolunteersPanel'), { ssr: false, loading: () => <div className="h-96 rounded-[28px] bg-slate-100 shimmer animate-pulse" /> });

export default function VolunteersPage() {
  return <VolunteersPanel />;
}
