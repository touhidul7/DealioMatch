'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

export default function RunMatchButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function run() {
    setLoading(true);
    setMessage('');

    const runPromise = (async () => {
      const response = await fetch('/api/match/run', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Match run failed.');
      setMessage(`Created ${data.count} match rows.`);
      return data;
    })();

    toast.promise(runPromise, {
      loading: 'Running match engine...',
      success: (data) => `Match run completed (${data.count} rows).`,
      error: (error) => error.message || 'Match run failed.'
    });

    try {
      await runPromise;
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="button" onClick={run} disabled={loading}>
        {loading ? 'Running...' : 'Run Match Engine'}
      </button>
      {message ? <div className="muted" style={{ marginTop: 10 }}>{message}</div> : null}
    </div>
  );
}
