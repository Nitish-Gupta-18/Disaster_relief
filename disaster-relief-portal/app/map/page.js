'use client';

import dynamic from 'next/dynamic';

const LiveMap = dynamic(() => import('../components/LiveMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-100 shimmer animate-pulse" />
});

export default function MapPage() {
  return (
    <div className="h-full">
      <LiveMap />
    </div>
  );
}
