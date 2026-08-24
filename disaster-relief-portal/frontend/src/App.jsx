import { useEffect, useMemo, useState } from 'react';
import { Menu, Settings, X } from 'lucide-react';
import Sidebar from './components/Sidebar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import RequestsPage from './pages/RequestsPage.jsx';
import VolunteersPage from './pages/VolunteersPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import MapPage from './pages/MapPage.jsx';

const pageTitles = {
  dashboard: 'Command Center',
  requests: 'Relief Requests',
  volunteers: 'Volunteers',
  inventory: 'Inventory',
  map: 'Live Disaster Map',
  settings: 'Settings'
};

function SettingsPage() {
  return (
    <div className="max-w-3xl rounded-lg border border-relief-border bg-relief-surface p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <Settings className="h-5 w-5 text-relief-orange" />
        <h2 className="text-lg font-semibold text-slate-900">Portal Settings</h2>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-slate-500">Deployment</p>
          <p className="mt-1 font-medium text-slate-700">IMPACTSTER operations desk</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Backend port</p>
          <p className="mt-1 font-medium text-slate-700">5001</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [eventName, setEventName] = useState(() => localStorage.getItem('eventName') || 'IMPACTSTER Flood Response');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('eventName', eventName);
  }, [eventName]);

  const page = useMemo(() => {
    switch (activePage) {
      case 'requests':
        return <RequestsPage />;
      case 'volunteers':
        return <VolunteersPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'map':
        return <MapPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  }, [activePage]);

  return (
    <div className="min-h-screen bg-transparent text-slate-800">
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => {
          setActivePage(page);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <main className="min-h-screen lg:pl-60">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Open navigation"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                onClick={() => setSidebarOpen((current) => !current)}
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-relief-orange">Disaster Relief Coordination Portal</p>
                <h1 className="truncate text-base font-semibold text-slate-900 sm:text-xl">{pageTitles[activePage]}</h1>
              </div>
            </div>
            <label className="flex min-w-0 max-w-[240px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm sm:max-w-[320px]">
              <span className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:inline">Event</span>
              <input
                value={eventName}
                onChange={(event) => setEventName(event.target.value)}
                className="h-9 w-full border-0 bg-transparent px-0 text-sm font-medium text-slate-900 outline-none"
              />
            </label>
          </div>
        </header>
        <div className={activePage === 'map' ? 'h-[calc(100vh-4rem)]' : 'mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6'}>{page}</div>
      </main>
    </div>
  );
}
