'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const FIELD_LABELS = {
  industry_weight: 'Industry weight',
  geo_weight: 'Geography weight',
  size_weight: 'Size weight',
  keyword_weight: 'Keyword weight',
  revenue_weight: 'Revenue weight',
  ebitda_weight: 'EBITDA weight',
  freshness_weight: 'Freshness weight',
  min_match_threshold: 'Min match threshold',
  max_matches_per_listing: 'Max matches per listing'
};

const FIELD_ORDER = Object.keys(FIELD_LABELS);

export default function MatchSettingsPanel({ initialSettings }) {
  const [formState, setFormState] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setFormState(initialSettings);
  }, [initialSettings]);

  function updateField(key, value) {
    setFormState((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    const payload = FIELD_ORDER.reduce((acc, key) => {
      const parsed = Number(formState[key]);
      if (Number.isFinite(parsed)) acc[key] = parsed;
      return acc;
    }, {});

    const savePromise = (async () => {
      const response = await fetch('/api/match/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save settings.');
      setFormState(data);
      setMessage('Settings saved.');
      return data;
    })();

    toast.promise(savePromise, {
      loading: 'Saving match settings...',
      success: 'Match settings saved.',
      error: (error) => error.message || 'Failed to save settings.'
    });

    try {
      await savePromise;
    } catch (error) {
      setMessage(error.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form" onSubmit={saveSettings}>
      <div className="heading"><h2>Match settings</h2></div>
      {FIELD_ORDER.map((key) => (
        <label key={key} className="muted" style={{ display: 'grid', gap: 8 }}>
          {FIELD_LABELS[key]}
          <input
            className="input"
            type="number"
            step={key.includes('weight') ? '0.01' : '1'}
            value={formState[key] ?? ''}
            onChange={(event) => updateField(key, event.target.value)}
          />
        </label>
      ))}
      <button className="button" type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save settings'}
      </button>
      {message ? <div className="muted">{message}</div> : null}
    </form>
  );
}
