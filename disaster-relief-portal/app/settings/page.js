'use client';

import { Cpu, Database, Globe, Server, Settings, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [eventName, setEventName] = useState('IMPACTSTER Flood Response');

  useEffect(() => {
    const stored = localStorage.getItem('eventName');
    if (stored) setEventName(stored);
  }, []);

  return (
    <div className="max-w-3xl">
      <div className="rounded-2xl border border-[#E2E8F0]/80 bg-white shadow-card overflow-hidden">
        {/* Header */}
        <div className="border-b border-[#E2E8F0]/60 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-[#FF7A30]">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#0F172A]">Portal Settings</h2>
              <p className="text-sm text-[#94A3B8]">System configuration & status</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Event name */}
          <div>
            <label className="block text-sm font-medium text-[#475569] mb-1.5">Active Event Name</label>
            <input
              value={eventName}
              onChange={(e) => { setEventName(e.target.value); localStorage.setItem('eventName', e.target.value); }}
              className="h-[46px] w-full max-w-sm rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white"
            />
            <p className="mt-1 text-xs text-[#94A3B8]">Displayed in sidebar and page headers</p>
          </div>

          {/* System info grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0]/60 bg-[#F8FAFC]/50 p-4">
              <Globe className="h-5 w-5 text-[#0EA5E9] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">Deployment</p>
                <p className="text-xs text-[#64748B] mt-0.5">IMPACTSTER operations desk</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0]/60 bg-[#F8FAFC]/50 p-4">
              <Zap className="h-5 w-5 text-[#F59E0B] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">Runtime</p>
                <p className="text-xs text-[#64748B] mt-0.5">Bun + Next.js 15</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0]/60 bg-[#F8FAFC]/50 p-4">
              <Database className="h-5 w-5 text-[#10B981] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">Database</p>
                <p className="text-xs text-[#64748B] mt-0.5">SQLite (WAL mode)</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0]/60 bg-[#F8FAFC]/50 p-4">
              <Server className="h-5 w-5 text-[#6366F1] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">Port</p>
                <p className="text-xs text-[#64748B] mt-0.5">3000</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
