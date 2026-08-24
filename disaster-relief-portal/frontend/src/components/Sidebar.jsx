import { Box, Home, ListChecks, Map, Settings, Users } from 'lucide-react';

const items = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'requests', label: 'Relief Requests', icon: ListChecks },
  { id: 'volunteers', label: 'Volunteers', icon: Users },
  { id: 'inventory', label: 'Inventory', icon: Box },
  { id: 'map', label: 'Live Map', icon: Map },
  { id: 'settings', label: 'Settings', icon: Settings }
];

export default function Sidebar({ activePage, onNavigate, isOpen, onClose }) {
  return (
    <>
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-slate-200/80 bg-white/95 shadow-[20px_0_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="border-b border-slate-200/80 bg-gradient-to-br from-orange-50 via-white to-teal-50 px-5 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-relief-orange to-orange-400 text-lg font-black text-white shadow-lg shadow-orange-500/20">
            IM
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-900">IMPACTSTER Command Desk</p>
          <p className="mt-1 text-xs text-slate-500">IMPACTSTER Relief Network</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  onClose?.();
                }}
                className={`flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-medium transition ${
                  active
                    ? 'bg-gradient-to-r from-relief-orange to-orange-400 text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${active ? 'bg-white/15' : 'bg-slate-100 text-slate-500'}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-200/80 px-4 py-4 text-xs text-slate-500">
          SQLite local data store
        </div>
      </aside>
    </>
  );
}
