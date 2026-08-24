'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight } from 'lucide-react';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const router = useRouter();

  const items = [
    { group: 'Navigate', items: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊', action: () => router.push('/') },
      { id: 'requests', label: 'Relief Requests', icon: '📋', action: () => router.push('/requests') },
      { id: 'volunteers', label: 'Volunteers', icon: '👥', action: () => router.push('/volunteers') },
      { id: 'inventory', label: 'Inventory', icon: '📦', action: () => router.push('/inventory') },
      { id: 'map', label: 'Live Map', icon: '🗺️', action: () => router.push('/map') },
      { id: 'settings', label: 'Settings', icon: '⚙️', action: () => router.push('/settings') },
    ]},
    { group: 'Quick Actions', items: [
      { id: 'new-request', label: 'New Relief Request', icon: '➕', action: () => { router.push('/requests'); setOpen(false); } },
      { id: 'new-volunteer', label: 'Register Volunteer', icon: '👤', action: () => { router.push('/volunteers'); setOpen(false); } },
      { id: 'new-inventory', label: 'Add Inventory Item', icon: '📦', action: () => { router.push('/inventory'); setOpen(false); } },
    ]},
  ];

  const filtered = items.map(g => ({
    ...g,
    items: g.items.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
  })).filter(g => g.items.length > 0);

  const allFiltered = filtered.flatMap(g => g.items);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const handleKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen(prev => !prev);
      setQuery('');
    }
    if (e.key === 'Escape' && open) {
      setOpen(false);
    }
  }, [open]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
    }
  }, [open]);

  const paletteKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, allFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allFiltered[activeIdx]) {
      allFiltered[activeIdx].action();
      setOpen(false);
    }
  };

  if (!open) return null;

  let globalIdx = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border border-[#E2E8F0]/80 bg-white shadow-[0_20px_60px_-12px_rgba(15,23,42,0.25)] overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
        onKeyDown={paletteKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-[#E2E8F0]/50 px-4 py-3">
          <Search className="h-4 w-4 text-[#94A3B8] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, create new..."
            className="flex-1 bg-transparent text-sm text-[#0F172A] placeholder-[#94A3B8] outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-[10px] font-semibold text-[#94A3B8]">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.map(group => (
            <div key={group.group}>
              <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">{group.group}</p>
              {group.items.map(item => {
                const idx = globalIdx++;
                const active = idx === activeIdx;
                return (
                  <button
                    key={item.id}
                    onClick={() => { item.action(); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                      active ? 'bg-[#F1F5F9] text-[#0F172A]' : 'text-[#475569] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <span className="text-base shrink-0 w-5 text-center">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {active && <ArrowRight className="h-3.5 w-3.5 text-[#94A3B8]" />}
                  </button>
                );
              })}
            </div>
          ))}
          {allFiltered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-[#94A3B8]">No results found</p>
          )}
        </div>
        <div className="border-t border-[#E2E8F0]/50 px-4 py-2 flex items-center gap-4 text-[10px] text-[#94A3B8]">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1 py-0.5 font-semibold">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1 py-0.5 font-semibold">↵</kbd> Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1 py-0.5 font-semibold">esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
