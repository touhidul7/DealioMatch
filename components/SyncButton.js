'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleClick() {
    setLoading(true);
    setMessage('');

    const syncPromise = (async () => {
      const response = await fetch('/api/buyers/sync', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Sync failed.');
      setMessage(`Synced ${data.count} buyers.`);
      return data;
    })();

    toast.promise(syncPromise, {
      loading: 'Syncing buyers...',
      success: (data) => `Synced ${data.count} buyers.`,
      error: (error) => error.message || 'Sync failed.'
    });

    try {
      await syncPromise;
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="button" onClick={handleClick} disabled={loading}>
        {loading ? 'Syncing...' : 'Sync GHL Buyers'}
      </button>
      {message ? <div className="muted" style={{ marginTop: 10 }}>{message}</div> : null}
    </div>
  );
}
