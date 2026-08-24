import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Trash2, UserPlus } from 'lucide-react';

const statuses = ['pending', 'assigned', 'in_progress', 'completed'];
const types = ['food', 'water', 'medicine', 'shelter'];
const urgencies = ['low', 'medium', 'high', 'critical'];

const urgencyClasses = {
  critical: 'bg-red-500/20 text-red-200 border-red-500/40',
  high: 'bg-orange-500/20 text-orange-200 border-orange-500/40',
  medium: 'bg-yellow-500/20 text-yellow-100 border-yellow-500/40',
  low: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
};

const statusClasses = {
  pending: 'bg-neutral-500/20 text-neutral-200 border-neutral-500/40',
  assigned: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
  in_progress: 'bg-orange-500/20 text-orange-200 border-orange-500/40',
  completed: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
};

function label(value) {
  return value.replace('_', ' ');
}

function Badge({ value, classes }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${classes[value]}`}>
      {label(value)}
    </span>
  );
}

function StatusStepper({ status }) {
  const currentIndex = statuses.indexOf(status);
  return (
    <div className="flex min-w-[340px] items-center">
      {statuses.map((step, index) => {
        const reached = index <= currentIndex;
        return (
          <div key={step} className="flex flex-1 items-center">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                reached ? 'border-relief-orange bg-relief-orange text-white' : 'border-neutral-700 bg-neutral-950 text-neutral-500'
              }`}
            >
              {index + 1}
            </div>
            <span className={`ml-2 hidden text-xs capitalize xl:inline ${reached ? 'text-neutral-200' : 'text-neutral-600'}`}>
              {label(step)}
            </span>
            {index < statuses.length - 1 && (
              <div className={`mx-2 h-px flex-1 ${index < currentIndex ? 'bg-relief-orange' : 'bg-neutral-800'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RequestsTable({ requests, filters, onFiltersChange, onRefresh }) {
  const [selectedId, setSelectedId] = useState(null);
  const [volunteers, setVolunteers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [assignment, setAssignment] = useState({ volunteerId: '', inventoryId: '', quantity: 1 });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedId),
    [requests, selectedId]
  );

  useEffect(() => {
    async function loadOptions() {
      const [volunteerResponse, inventoryResponse] = await Promise.all([
        fetch('/api/volunteers'),
        fetch('/api/inventory')
      ]);
      setVolunteers(await volunteerResponse.json());
      setInventory(await inventoryResponse.json());
    }
    loadOptions().catch(() => setError('Unable to load assignment options'));
  }, []);

  useEffect(() => {
    if (requests.length && !requests.some((request) => request.id === selectedId)) {
      setSelectedId(null);
    }
  }, [requests, selectedId]);

  const changeFilter = (field, value) => {
    onFiltersChange({ ...filters, [field]: value });
  };

  async function patchStatus(requestId, status) {
    setError('');
    setNotice('');
    const response = await fetch(`/api/requests/${requestId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Unable to update status');
      return;
    }
    setNotice('Request status updated successfully.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    onRefresh();
  }

  async function assignVolunteer() {
    if (!selectedRequest || !assignment.volunteerId) return;
    setError('');
    setNotice('');
    const response = await fetch(`/api/requests/${selectedRequest.id}/assign-volunteer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volunteerId: Number(assignment.volunteerId) })
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Unable to assign volunteer');
      return;
    }
    setAssignment((current) => ({ ...current, volunteerId: '' }));
    setNotice('Volunteer assigned and the request pipeline has been updated.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    onRefresh();
  }

  async function assignResource() {
    if (!selectedRequest || !assignment.inventoryId) return;
    setError('');
    setNotice('');
    const response = await fetch(`/api/requests/${selectedRequest.id}/assign-resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventoryId: Number(assignment.inventoryId),
        quantity: Number(assignment.quantity)
      })
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Unable to assign resource');
      return;
    }
    setAssignment((current) => ({ ...current, inventoryId: '', quantity: 1 }));
    setNotice('Resource allocation recorded successfully.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    onRefresh();
  }

  async function deleteRequest(requestId) {
    setError('');
    setNotice('');
    const response = await fetch(`/api/requests/${requestId}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Unable to delete request');
      return;
    }
    if (selectedId === requestId) setSelectedId(null);
    setNotice('Request removed from the prototype queue.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    onRefresh();
  }

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.28)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 p-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Relief Requests</h2>
          <p className="mt-1 text-sm text-slate-500">{requests.length} requests in the current view</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filters.status}
            onChange={(event) => changeFilter('status', event.target.value)}
            className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-relief-orange"
          >
            <option value="">All status</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </select>
          <select
            value={filters.type}
            onChange={(event) => changeFilter('type', event.target.value)}
            className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-relief-orange"
          >
            <option value="">All type</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={filters.urgency}
            onChange={(event) => changeFilter('urgency', event.target.value)}
            className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-relief-orange"
          >
            <option value="">All urgency</option>
            {urgencies.map((urgency) => (
              <option key={urgency} value={urgency}>
                {urgency}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {notice && <div className="mx-4 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}

      <div className="overflow-x-auto scrollbar-thin">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Location</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Urgency</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Pipeline</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Family</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {requests.map((request) => (
              <tr
                key={request.id}
                onClick={() => setSelectedId(request.id)}
                className={`cursor-pointer transition duration-200 hover:bg-slate-50 ${
                  selectedId === request.id ? 'bg-orange-50/70' : 'bg-white/60'
                }`}
              >
                <td className="max-w-[260px] px-4 py-4">
                  <p className="font-medium text-slate-900">{request.location}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">{request.description || 'No description'}</p>
                </td>
                <td className="px-4 py-4 text-sm capitalize text-slate-600">{request.type}</td>
                <td className="px-4 py-4">
                  <Badge value={request.urgency} classes={urgencyClasses} />
                </td>
                <td className="px-4 py-4">
                  <Badge value={request.status} classes={statusClasses} />
                </td>
                <td className="px-4 py-4">
                  <StatusStepper status={request.status} />
                </td>
                <td className="px-4 py-4 text-sm text-slate-600">{request.family_size}</td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                    <select
                      value={request.status}
                      onChange={(event) => patchStatus(request.id, event.target.value)}
                      className="h-9 rounded-2xl border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 outline-none transition focus:border-relief-orange"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {label(status)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => deleteRequest(request.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:border-red-300 hover:text-red-500"
                      title="Delete request"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRequest && (
        <div className="grid gap-4 border-t border-slate-200 bg-slate-50/80 p-4 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="text-sm font-semibold text-slate-900">Request #{selectedRequest.id}</p>
            <p className="mt-1 text-sm text-slate-500">{selectedRequest.description || selectedRequest.location}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedRequest.assigned_volunteers?.map((volunteer) => (
                <span key={volunteer.id} className="rounded-full border border-blue-500/20 bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                  {volunteer.name}
                </span>
              ))}
              {selectedRequest.assigned_resources?.map((resource) => (
                <span key={`${resource.inventory_id}-${resource.assigned_at}`} className="rounded-full border border-relief-orange/20 bg-orange-50 px-2.5 py-1 text-xs text-orange-700">
                  {resource.quantity} {resource.unit} {resource.item_name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={assignment.volunteerId}
              onChange={(event) => setAssignment((current) => ({ ...current, volunteerId: event.target.value }))}
              className="h-10 min-w-0 flex-1 rounded-lg border border-relief-border bg-neutral-950 px-3 text-sm text-neutral-200 outline-none focus:border-relief-orange"
            >
              <option value="">Assign volunteer</option>
              {volunteers.map((volunteer) => (
                <option key={volunteer.id} value={volunteer.id}>
                  {volunteer.name} {volunteer.is_available ? '(available)' : '(busy)'}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={assignVolunteer}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r from-relief-orange to-orange-400 text-white shadow-sm transition hover:shadow-md"
              title="Assign volunteer"
            >
              <UserPlus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={assignment.inventoryId}
              onChange={(event) => setAssignment((current) => ({ ...current, inventoryId: event.target.value }))}
              className="h-10 min-w-0 flex-1 rounded-lg border border-relief-border bg-neutral-950 px-3 text-sm text-neutral-200 outline-none focus:border-relief-orange"
            >
              <option value="">Assign resource</option>
              {inventory.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_name} ({item.quantity} {item.unit})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={assignment.quantity}
              onChange={(event) => setAssignment((current) => ({ ...current, quantity: event.target.value }))}
              className="h-10 w-20 rounded-2xl border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none transition focus:border-relief-orange"
            />
            <button
              type="button"
              onClick={assignResource}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r from-relief-teal to-teal-500 text-white shadow-sm transition hover:shadow-md"
              title="Assign resource"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
