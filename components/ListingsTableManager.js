'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

function money(value) {
  return value == null ? '-' : `$${value}`;
}

export default function ListingsTableManager() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('true');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState({});

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        q: query,
        active
      });
      const response = await fetch(`/api/listings?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load listings.');
      setRows(data.rows || []);
      setTotal(data.total || 0);
      setSelected([]);
    } catch (error) {
      toast.error(error.message || 'Failed to load listings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [page, active]);

  async function searchNow() {
    setPage(1);
    await load();
  }

  function toggleSelect(id) {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function startEdit(row) {
    setEditingId(row.id);
    setDraft({
      listing_title: row.listing_title || '',
      company_name: row.company_name || '',
      industry: row.industry || '',
      city: row.city || '',
      state_province: row.state_province || '',
      country: row.country || '',
      asking_price: row.asking_price ?? '',
      revenue: row.revenue ?? '',
      ebitda: row.ebitda ?? '',
      listing_status: row.listing_status || 'active',
      is_active: row.is_active
    });
  }

  async function saveEdit() {
    const promise = (async () => {
      const response = await fetch(`/api/listings/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Update failed.');
      return data;
    })();

    toast.promise(promise, {
      loading: 'Saving listing...',
      success: 'Listing updated.',
      error: (error) => error.message || 'Update failed.'
    });
    await promise;
    setEditingId('');
    setDraft({});
    await load();
  }

  async function deleteOne(id) {
    const promise = (async () => {
      const response = await fetch(`/api/listings/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Delete failed.');
      return data;
    })();
    toast.promise(promise, {
      loading: 'Deleting listing...',
      success: 'Listing deleted.',
      error: (error) => error.message || 'Delete failed.'
    });
    await promise;
    await load();
  }

  async function runBulk(action) {
    if (!selected.length) return;
    const promise = (async () => {
      const response = await fetch('/api/listings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: selected })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Bulk action failed.');
      return data;
    })();

    toast.promise(promise, {
      loading: `Running ${action}...`,
      success: `Bulk ${action} completed.`,
      error: (error) => error.message || 'Bulk action failed.'
    });
    await promise;
    await load();
  }

  return (
    <div className="panel table-wrap">
      <div className="heading"><h2>Listings Table Actions</h2></div>
      <div className="grid" style={{ gap: 10, gridTemplateColumns: '2fr 1fr auto auto auto auto' }}>
        <input className="input" placeholder="Search listings..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="select" value={active} onChange={(e) => setActive(e.target.value)}>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
          <option value="">All</option>
        </select>
        <button className="button" type="button" onClick={searchNow}>Search</button>
        <button className="button" type="button" disabled={!selected.length} onClick={() => runBulk('activate')}>Bulk Activate</button>
        <button className="button" type="button" disabled={!selected.length} onClick={() => runBulk('deactivate')}>Bulk Deactivate</button>
        <button className="button" type="button" disabled={!selected.length} onClick={() => runBulk('delete')}>Bulk Delete</button>
      </div>

      <table>
        <thead>
          <tr>
            <th></th>
            <th>Title</th>
            <th>Company</th>
            <th>Industry</th>
            <th>Location</th>
            <th>Asking</th>
            <th>Revenue</th>
            <th>EBITDA</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <tr><td colSpan="10" className="muted">Loading...</td></tr> : null}
          {!loading && !rows.length ? <tr><td colSpan="10" className="muted">No listings found.</td></tr> : null}
          {!loading && rows.map((row) => {
            const editing = editingId === row.id;
            return (
              <tr key={row.id}>
                <td><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelect(row.id)} /></td>
                <td>{editing ? <input className="input" value={draft.listing_title || ''} onChange={(e) => setDraft({ ...draft, listing_title: e.target.value })} /> : row.listing_title}</td>
                <td>{editing ? <input className="input" value={draft.company_name || ''} onChange={(e) => setDraft({ ...draft, company_name: e.target.value })} /> : (row.company_name || '-')}</td>
                <td>{editing ? <input className="input" value={draft.industry || ''} onChange={(e) => setDraft({ ...draft, industry: e.target.value })} /> : (row.industry || '-')}</td>
                <td>{editing ? (
                  <div className="grid" style={{ gap: 6 }}>
                    <input className="input" value={draft.city || ''} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
                    <input className="input" value={draft.state_province || ''} onChange={(e) => setDraft({ ...draft, state_province: e.target.value })} />
                    <input className="input" value={draft.country || ''} onChange={(e) => setDraft({ ...draft, country: e.target.value })} />
                  </div>
                ) : ([row.city, row.state_province, row.country].filter(Boolean).join(', ') || '-')}</td>
                <td>{editing ? <input className="input" value={draft.asking_price ?? ''} onChange={(e) => setDraft({ ...draft, asking_price: e.target.value })} /> : money(row.asking_price)}</td>
                <td>{editing ? <input className="input" value={draft.revenue ?? ''} onChange={(e) => setDraft({ ...draft, revenue: e.target.value })} /> : money(row.revenue)}</td>
                <td>{editing ? <input className="input" value={draft.ebitda ?? ''} onChange={(e) => setDraft({ ...draft, ebitda: e.target.value })} /> : money(row.ebitda)}</td>
                <td>{editing ? (
                  <select className="select" value={draft.listing_status || 'active'} onChange={(e) => setDraft({ ...draft, listing_status: e.target.value })}>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="closed">closed</option>
                  </select>
                ) : row.listing_status}</td>
                <td>
                  {editing ? (
                    <div className="grid" style={{ gap: 6 }}>
                      <button className="button" type="button" onClick={saveEdit}>Save</button>
                      <button className="button" type="button" onClick={() => { setEditingId(''); setDraft({}); }}>Cancel</button>
                    </div>
                  ) : (
                    <div className="grid" style={{ gap: 6 }}>
                      <button className="button" type="button" onClick={() => startEdit(row)}>Edit</button>
                      <button className="button" type="button" onClick={() => deleteOne(row.id)}>Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="grid" style={{ gap: 10, gridTemplateColumns: 'auto auto 1fr' }}>
        <button className="button" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
        <button className="button" type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        <div className="muted">Page {page} / {totalPages} • {total} total</div>
      </div>
    </div>
  );
}
