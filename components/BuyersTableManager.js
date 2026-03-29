'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

function moneyRange(min, max) {
  if (min == null && max == null) return '-';
  return `$${min ?? 0} - $${max ?? 'open'}`;
}

export default function BuyersTableManager() {
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
      const response = await fetch(`/api/buyers?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load buyers.');
      setRows(data.rows || []);
      setTotal(data.total || 0);
      setSelected([]);
    } catch (error) {
      toast.error(error.message || 'Failed to load buyers.');
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
      full_name: row.full_name || '',
      email: row.email || '',
      phone: row.phone || '',
      company: row.company || '',
      buyer_type: row.buyer_type || '',
      strategic_or_financial: row.strategic_or_financial || '',
      industry_interest_raw: row.industry_interest_raw || '',
      geographic_focus_raw: row.geographic_focus_raw || '',
      deal_size_min: row.deal_size_min ?? '',
      deal_size_max: row.deal_size_max ?? '',
      is_active: row.is_active
    });
  }

  async function saveEdit() {
    const promise = (async () => {
      const response = await fetch(`/api/buyers/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Update failed.');
      return data;
    })();

    toast.promise(promise, {
      loading: 'Saving buyer...',
      success: 'Buyer updated.',
      error: (error) => error.message || 'Update failed.'
    });

    await promise;
    setEditingId('');
    setDraft({});
    await load();
  }

  async function deleteOne(id) {
    const promise = (async () => {
      const response = await fetch(`/api/buyers/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Delete failed.');
      return data;
    })();
    toast.promise(promise, {
      loading: 'Deleting buyer...',
      success: 'Buyer deleted.',
      error: (error) => error.message || 'Delete failed.'
    });
    await promise;
    await load();
  }

  async function runBulk(action) {
    if (!selected.length) return;
    const promise = (async () => {
      const response = await fetch('/api/buyers/bulk', {
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
      <div className="heading">
        <h2>Buyers Table Actions</h2>
      </div>
      <div className="grid" style={{ gap: 10, gridTemplateColumns: '2fr 1fr auto auto auto auto' }}>
        <input className="input" placeholder="Search buyers..." value={query} onChange={(e) => setQuery(e.target.value)} />
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
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Company</th>
            <th>Type</th>
            <th>Industry</th>
            <th>Geo</th>
            <th>Deal Size</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <tr><td colSpan="11" className="muted">Loading...</td></tr> : null}
          {!loading && !rows.length ? <tr><td colSpan="11" className="muted">No buyers found.</td></tr> : null}
          {!loading && rows.map((row) => {
            const editing = editingId === row.id;
            return (
              <tr key={row.id}>
                <td><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelect(row.id)} /></td>
                <td>{editing ? <input className="input" value={draft.full_name || ''} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} /> : (row.full_name || '-')}</td>
                <td>{editing ? <input className="input" value={draft.email || ''} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /> : (row.email || '-')}</td>
                <td>{editing ? <input className="input" value={draft.phone || ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /> : (row.phone || '-')}</td>
                <td>{editing ? <input className="input" value={draft.company || ''} onChange={(e) => setDraft({ ...draft, company: e.target.value })} /> : (row.company || '-')}</td>
                <td>{editing ? (
                  <div className="grid" style={{ gap: 6 }}>
                    <input className="input" placeholder="buyer_type" value={draft.buyer_type || ''} onChange={(e) => setDraft({ ...draft, buyer_type: e.target.value })} />
                    <input className="input" placeholder="strategic_or_financial" value={draft.strategic_or_financial || ''} onChange={(e) => setDraft({ ...draft, strategic_or_financial: e.target.value })} />
                  </div>
                ) : ([row.buyer_type, row.strategic_or_financial].filter(Boolean).join(' / ') || '-')}</td>
                <td>{editing ? <input className="input" value={draft.industry_interest_raw || ''} onChange={(e) => setDraft({ ...draft, industry_interest_raw: e.target.value })} /> : (row.industry_interest_raw || row.normalized_industries || '-')}</td>
                <td>{editing ? <input className="input" value={draft.geographic_focus_raw || ''} onChange={(e) => setDraft({ ...draft, geographic_focus_raw: e.target.value })} /> : (row.geographic_focus_raw || row.geo_normalized || '-')}</td>
                <td>{editing ? (
                  <div className="grid" style={{ gap: 6, gridTemplateColumns: '1fr 1fr' }}>
                    <input className="input" value={draft.deal_size_min ?? ''} onChange={(e) => setDraft({ ...draft, deal_size_min: e.target.value })} />
                    <input className="input" value={draft.deal_size_max ?? ''} onChange={(e) => setDraft({ ...draft, deal_size_max: e.target.value })} />
                  </div>
                ) : moneyRange(row.deal_size_min, row.deal_size_max)}</td>
                <td>{editing ? (
                  <select className="select" value={String(Boolean(draft.is_active))} onChange={(e) => setDraft({ ...draft, is_active: e.target.value === 'true' })}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (row.is_active ? 'Yes' : 'No')}</td>
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
