'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function DataIOPanel({ entity, title }) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatus('');

    const importPromise = (async () => {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch(`/api/import/${entity}`, {
        method: 'POST',
        body: form
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Import failed.');
      setStatus(`Import complete: ${JSON.stringify(data)}`);
      router.refresh();
      return data;
    })();

    toast.promise(importPromise, {
      loading: `Importing ${entity}...`,
      success: 'Import completed.',
      error: (error) => error.message || 'Import failed.'
    });

    try {
      await importPromise;
    } catch (error) {
      setStatus(error.message || 'Import failed.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function handleExport(format) {
    setStatus('');
    const exportPromise = (async () => {
      const response = await fetch(`/api/export/${entity}?format=${format}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Export failed.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dealio_${entity}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStatus(`Exported ${entity} (${format.toUpperCase()}).`);
      return true;
    })();

    toast.promise(exportPromise, {
      loading: `Exporting ${entity} (${format.toUpperCase()})...`,
      success: `Exported ${entity} (${format.toUpperCase()}).`,
      error: (error) => error.message || 'Export failed.'
    });

    try {
      await exportPromise;
    } catch (error) {
      setStatus(error.message || 'Export failed.');
    }
  }

  return (
    <div className="panel form">
      <div className="heading"><h3>{title}</h3></div>
      <label className="muted" style={{ display: 'grid', gap: 8 }}>
        <span>Import CSV/XLSX</span>
        <input className="input" type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} disabled={uploading} />
      </label>
      <div className="grid" style={{ gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <button className="button" type="button" onClick={() => handleExport('csv')}>Export CSV</button>
        <button className="button" type="button" onClick={() => handleExport('xlsx')}>Export XLSX</button>
      </div>
      {status ? <div className="muted">{status}</div> : null}
    </div>
  );
}
