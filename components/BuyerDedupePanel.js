'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function BuyerDedupePanel() {
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(false);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const response = await fetch(`/api/dedupe/buyers/cases?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load dedupe cases.');
      setRows(data.rows || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load dedupe cases.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  async function runPipeline() {
    const promise = (async () => {
      const response = await fetch('/api/dedupe/buyers/run', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Dedupe run failed.');
      return data;
    })();

    toast.promise(promise, {
      loading: 'Generating dedupe cases...',
      success: (data) => `Generated ${data.cases} dedupe cases.`,
      error: (error) => error.message || 'Dedupe run failed.'
    });

    await promise;
    await loadCases();
  }

  async function updateCase(row, reviewer_status) {
    const promise = (async () => {
      const response = await fetch('/api/dedupe/buyers/cases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          reviewer_status,
          reviewer_notes: row.reviewer_notes || ''
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update case.');
      return data;
    })();

    toast.promise(promise, {
      loading: 'Updating dedupe case...',
      success: 'Dedupe case updated.',
      error: (error) => error.message || 'Update failed.'
    });
    await promise;
    await loadCases();
  }

  async function applyMerge(row) {
    const promise = (async () => {
      const response = await fetch('/api/dedupe/buyers/apply-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dedupe_case_id: row.dedupe_case_id,
          survivor_buyer_id: row.candidate_buyer_id_1
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Merge failed.');
      return data;
    })();

    toast.promise(promise, {
      loading: 'Applying merge...',
      success: 'Merge completed.',
      error: (error) => error.message || 'Merge failed.'
    });
    await promise;
    await loadCases();
  }

  return (
    <div className="panel table-wrap">
      <div className="heading"><h2>Dedupe Review Pipeline</h2></div>
      <div className="grid" style={{ gap: 10, gridTemplateColumns: 'auto auto auto' }}>
        <button className="button" type="button" onClick={runPipeline}>Run Dedupe Pipeline</button>
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="merged">merged</option>
          <option value="rejected">rejected</option>
          <option value="">all</option>
        </select>
        <button className="button" type="button" onClick={loadCases}>Refresh</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Case</th>
            <th>Candidate 1</th>
            <th>Candidate 2</th>
            <th>Score</th>
            <th>Reason</th>
            <th>Suggested</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <tr><td colSpan="7" className="muted">Loading...</td></tr> : null}
          {!loading && !rows.length ? <tr><td colSpan="7" className="muted">No dedupe cases.</td></tr> : null}
          {!loading && rows.map((row) => (
            <tr key={row.id}>
              <td>{row.dedupe_case_id}</td>
              <td>{row.buyer1?.full_name || row.candidate_buyer_id_1}</td>
              <td>{row.buyer2?.full_name || row.candidate_buyer_id_2}</td>
              <td>{row.similarity_score}</td>
              <td>{row.similarity_reason}</td>
              <td>{row.suggested_action}</td>
              <td>
                <div className="grid" style={{ gap: 6 }}>
                  <select
                    className="select"
                    value={row.reviewer_status || 'pending'}
                    onChange={(e) => updateCase(row, e.target.value)}
                  >
                    <option value="pending">pending</option>
                    <option value="approved">approved</option>
                    <option value="merged">merged</option>
                    <option value="rejected">rejected</option>
                  </select>
                  <button
                    className="button"
                    type="button"
                    disabled={row.reviewer_status !== 'approved'}
                    onClick={() => applyMerge(row)}
                  >
                    Apply merge
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
