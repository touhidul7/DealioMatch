'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

export default function GoogleSheetsSettingsPanel({ initialSettings, tabOptions }) {
  const [formState, setFormState] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [tabsBySheet, setTabsBySheet] = useState({});

  const connected = useMemo(() => Boolean(formState.gsheets_refresh_token), [formState.gsheets_refresh_token]);

  function setValue(key, value) {
    setFormState((current) => ({ ...current, [key]: value }));
  }

  async function loadSpreadsheets() {
    const loadPromise = (async () => {
      const response = await fetch('/api/google-sheets/spreadsheets');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load spreadsheets.');
      setSpreadsheets(data.files || []);
      return data;
    })();

    try {
      await loadPromise;
    } catch (error) {
      setStatus(error.message || 'Failed to load spreadsheets.');
    }
  }

  async function loadTabs(spreadsheetId, force = false) {
    if (!spreadsheetId) return;
    if (!force && Array.isArray(tabsBySheet[spreadsheetId])) return;
    try {
      const response = await fetch(`/api/google-sheets/worksheets?spreadsheetId=${encodeURIComponent(spreadsheetId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load worksheets.');
      setTabsBySheet((current) => ({ ...current, [spreadsheetId]: data.tabs || [] }));
    } catch (error) {
      setStatus(error.message || 'Failed to load worksheets.');
    }
  }

  function openAuthPopup(target) {
    const popup = window.open(
      `/api/google-oauth/start?target=${encodeURIComponent(target)}`,
      'google_oauth_popup',
      'width=620,height=740,menubar=no,toolbar=no,status=no'
    );
    if (!popup) {
      setStatus('Popup blocked. Please allow popups for this site.');
      toast.error('Popup blocked. Please allow popups for this site.');
      return;
    }
    toast('Complete Google sign-in in the popup window.');
  }

  useEffect(() => {
    if (!connected) return;
    loadSpreadsheets();
    if (formState.gsheets_buyers_spreadsheet_id) loadTabs(formState.gsheets_buyers_spreadsheet_id);
    if (formState.gsheets_listings_spreadsheet_id) loadTabs(formState.gsheets_listings_spreadsheet_id);
    if (formState.gsheets_matching_spreadsheet_id) loadTabs(formState.gsheets_matching_spreadsheet_id);
  }, [connected]);

  useEffect(() => {
    function onMessage(event) {
      if (!event?.data?.type) return;
      if (event.data.type === 'google-oauth-success') {
        setFormState((current) => ({
          ...current,
          gsheets_enabled: 'true',
          gsheets_auth_mode: 'oauth'
        }));
        setStatus('Google account connected. Loading spreadsheets...');
        toast.success('Google account connected.');
        loadSpreadsheets();
      }
      if (event.data.type === 'google-oauth-error') {
        setStatus(event.data.error || 'Google authentication failed.');
        toast.error(event.data.error || 'Google authentication failed.');
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setStatus('');

    const savePromise = (async () => {
      const response = await fetch('/api/integrations/google-sheets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save Google settings.');
      setFormState(data.settings);
      setStatus('Google Sheets settings saved.');
      return data;
    })();

    toast.promise(savePromise, {
      loading: 'Saving Google Sheets settings...',
      success: 'Google Sheets settings saved.',
      error: (error) => error.message || 'Failed to save Google settings.'
    });

    try {
      await savePromise;
    } catch (error) {
      setStatus(error.message || 'Failed to save Google settings.');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(endpoint, body, successMessage) {
    setStatus('');

    const actionPromise = (async () => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Action failed.');
      setStatus(`${successMessage} ${JSON.stringify(data)}`);
      return data;
    })();

    toast.promise(actionPromise, {
      loading: 'Running action...',
      success: successMessage,
      error: (error) => error.message || 'Action failed.'
    });

    try {
      await actionPromise;
    } catch (error) {
      setStatus(error.message || 'Action failed.');
    }
  }

  const buyersTabs = tabsBySheet[formState.gsheets_buyers_spreadsheet_id] || tabOptions.buyers || [];
  const listingsTabs = tabsBySheet[formState.gsheets_listings_spreadsheet_id] || tabOptions.listings || [];
  const matchingTabs = tabsBySheet[formState.gsheets_matching_spreadsheet_id] || tabOptions.matching || [];

  const buyersSheetSelected = Boolean(formState.gsheets_buyers_spreadsheet_id);
  const listingsSheetSelected = Boolean(formState.gsheets_listings_spreadsheet_id);
  const matchingSheetSelected = Boolean(formState.gsheets_matching_spreadsheet_id);

  return (
    <form className="panel form" onSubmit={saveSettings}>
      <div className="heading"><h2>Google Sheets</h2></div>

      <label className="muted" style={{ display: 'grid', gap: 8 }}>
        <span>Enable Google Sheets integration</span>
        <select className="select" value={formState.gsheets_enabled || 'false'} onChange={(e) => setValue('gsheets_enabled', e.target.value)}>
          <option value="false">Disabled</option>
          <option value="true">Enabled</option>
        </select>
      </label>

      <button className="button" type="button" onClick={() => openAuthPopup('buyers')}>
        {connected ? 'Reconnect Google account' : 'Connect Google account'}
      </button>

      <div className="heading"><h3>Advisor Drive Folder Mapping</h3></div>
      <label className="muted" style={{ display: 'grid', gap: 8 }}>
        <span>JSON array: folder_id, advisor_id, advisor_name</span>
        <textarea
          className="textarea"
          placeholder={'[\n  {"folder_id":"<google_drive_folder_id>","advisor_id":"ADV-001","advisor_name":"Alex Morgan"}\n]'}
          value={formState.gsheets_advisor_folders_json || '[]'}
          onChange={(e) => setValue('gsheets_advisor_folders_json', e.target.value)}
        />
      </label>
      <button className="button" type="button" onClick={() => runAction('/api/google-drive/sync/advisors', null, 'Advisor Drive sync completed.')}>
        Sync advisor CSV folders
      </button>
      <hr style={{ opacity: 0.2, width: '100%' }} />

      <div className="heading"><h3>Dealio_Buyers_Master</h3></div>
      <label className="muted" style={{ display: 'grid', gap: 8 }}>
        <span>Select spreadsheet</span>
        <select
          className="select"
          value={formState.gsheets_buyers_spreadsheet_id || ''}
          onChange={(e) => {
            const spreadsheetId = e.target.value;
            setValue('gsheets_buyers_spreadsheet_id', spreadsheetId);
            loadTabs(spreadsheetId);
          }}
        >
          <option value="">Select buyers spreadsheet</option>
          {spreadsheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}
        </select>
      </label>

      <label className="muted" style={{ display: 'grid', gap: 8 }}>
        <span>1. Select buyers_raw_imports worksheet</span>
        <select
          className="select"
          disabled={!buyersSheetSelected}
          value={formState.gsheets_buyers_raw_imports_tab || 'buyers_raw_imports'}
          onChange={(e) => setValue('gsheets_buyers_raw_imports_tab', e.target.value)}
        >
          {buyersTabs.map((tab) => <option key={tab} value={tab}>{tab}</option>)}
        </select>
      </label>
      <label className="muted" style={{ display: 'grid', gap: 8 }}>
        <span>2. Select buyers_master worksheet</span>
        <select
          className="select"
          disabled={!buyersSheetSelected}
          value={formState.gsheets_buyers_master_tab || 'buyers_master'}
          onChange={(e) => setValue('gsheets_buyers_master_tab', e.target.value)}
        >
          {buyersTabs.map((tab) => <option key={tab} value={tab}>{tab}</option>)}
        </select>
      </label>
      <label className="muted" style={{ display: 'grid', gap: 8 }}>
        <span>3. Select buyers_dedupe_review worksheet</span>
        <select
          className="select"
          disabled={!buyersSheetSelected}
          value={formState.gsheets_buyers_dedupe_review_tab || 'buyers_dedupe_review'}
          onChange={(e) => setValue('gsheets_buyers_dedupe_review_tab', e.target.value)}
        >
          {buyersTabs.map((tab) => <option key={tab} value={tab}>{tab}</option>)}
        </select>
      </label>
      <button
        className="button"
        type="button"
        disabled={!buyersSheetSelected}
        onClick={() => loadTabs(formState.gsheets_buyers_spreadsheet_id, true)}
      >
        Refresh buyers worksheets
      </button>
      <hr style={{ opacity: 0.2, width: '100%' }} />

      <div className="heading"><h3>Dealio_Listings_Master</h3></div>
      <label className="muted" style={{ display: 'grid', gap: 8 }}>
        <span>Select spreadsheet</span>
        <select
          className="select"
          value={formState.gsheets_listings_spreadsheet_id || ''}
          onChange={(e) => {
            const spreadsheetId = e.target.value;
            setValue('gsheets_listings_spreadsheet_id', spreadsheetId);
            loadTabs(spreadsheetId);
          }}
        >
          <option value="">Select listings spreadsheet</option>
          {spreadsheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}
        </select>
      </label>

      <label className="muted" style={{ display: 'grid', gap: 8 }}>
        <span>1. Select listings_master worksheet</span>
        <select
          className="select"
          disabled={!listingsSheetSelected}
          value={formState.gsheets_listings_master_tab || 'listings_master'}
          onChange={(e) => setValue('gsheets_listings_master_tab', e.target.value)}
        >
          {listingsTabs.map((tab) => <option key={tab} value={tab}>{tab}</option>)}
        </select>
      </label>
      <button
        className="button"
        type="button"
        disabled={!listingsSheetSelected}
        onClick={() => loadTabs(formState.gsheets_listings_spreadsheet_id, true)}
      >
        Refresh listings worksheets
      </button>
      <hr style={{ opacity: 0.2, width: '100%' }} />

      <div className="heading"><h3>Dealio_Matching_Engine</h3></div>
      <label className="muted" style={{ display: 'grid', gap: 8 }}>
        <span>Select spreadsheet</span>
        <select
          className="select"
          value={formState.gsheets_matching_spreadsheet_id || ''}
          onChange={(e) => {
            const spreadsheetId = e.target.value;
            setValue('gsheets_matching_spreadsheet_id', spreadsheetId);
            loadTabs(spreadsheetId);
          }}
        >
          <option value="">Select matching spreadsheet</option>
          {spreadsheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}
        </select>
      </label>

      <label className="muted" style={{ display: 'grid', gap: 8 }}>
        <span>1. Select match_results worksheet</span>
        <select
          className="select"
          disabled={!matchingSheetSelected}
          value={formState.gsheets_match_results_tab || 'match_results'}
          onChange={(e) => setValue('gsheets_match_results_tab', e.target.value)}
        >
          {matchingTabs.map((tab) => <option key={tab} value={tab}>{tab}</option>)}
        </select>
      </label>
      <label className="muted" style={{ display: 'grid', gap: 8 }}>
        <span>2. Select top_50_by_listing worksheet</span>
        <select
          className="select"
          disabled={!matchingSheetSelected}
          value={formState.gsheets_top50_tab || 'top_50_by_listing'}
          onChange={(e) => setValue('gsheets_top50_tab', e.target.value)}
        >
          {matchingTabs.map((tab) => <option key={tab} value={tab}>{tab}</option>)}
        </select>
      </label>
      <label className="muted" style={{ display: 'grid', gap: 8 }}>
        <span>3. Select match_settings worksheet</span>
        <select
          className="select"
          disabled={!matchingSheetSelected}
          value={formState.gsheets_match_settings_tab || 'match_settings'}
          onChange={(e) => setValue('gsheets_match_settings_tab', e.target.value)}
        >
          {matchingTabs.map((tab) => <option key={tab} value={tab}>{tab}</option>)}
        </select>
      </label>
      <button
        className="button"
        type="button"
        disabled={!matchingSheetSelected}
        onClick={() => loadTabs(formState.gsheets_matching_spreadsheet_id, true)}
      >
        Refresh matching worksheets
      </button>

      <label className="muted" style={{ display: 'grid', gap: 8 }}>
        <span>Or type worksheet name manually (optional)</span>
        <input
          className="input"
          disabled={!matchingSheetSelected}
          placeholder="match_results"
          value={formState.gsheets_match_results_tab || ''}
          onChange={(e) => setValue('gsheets_match_results_tab', e.target.value)}
        />
      </label>

      <button className="button" type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save Google settings'}
      </button>

      <div className="grid" style={{ gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <button className="button" type="button" onClick={() => runAction('/api/google-sheets/sync/buyers', null, 'Buyer sync completed.')}>
          Sync buyers from Sheets
        </button>
        <button className="button" type="button" onClick={() => runAction('/api/google-sheets/export', { target: 'buyers' }, 'Buyers exported to Sheets.')}>
          Export buyers to Sheets
        </button>
        <button className="button" type="button" onClick={() => runAction('/api/google-sheets/export', { target: 'buyers_raw_imports' }, 'Buyers raw imports exported to Sheets.')}>
          Export buyers_raw_imports
        </button>
        <button className="button" type="button" onClick={() => runAction('/api/google-sheets/export', { target: 'buyers_dedupe_review' }, 'Buyers dedupe review exported to Sheets.')}>
          Export buyers_dedupe_review
        </button>
        <button className="button" type="button" onClick={() => runAction('/api/google-sheets/export', { target: 'listings' }, 'Listings exported to Sheets.')}>
          Export listings to Sheets
        </button>
        <button className="button" type="button" onClick={() => runAction('/api/google-sheets/export', { target: 'matches' }, 'Matches exported to Sheets.')}>
          Export matches to Sheets
        </button>
        <button className="button" type="button" onClick={() => runAction('/api/google-sheets/export', { target: 'top50' }, 'Top 50 exported to Sheets.')}>
          Export top 50 to Sheets
        </button>
        <button className="button" type="button" onClick={() => runAction('/api/google-sheets/export', { target: 'match_settings' }, 'Match settings exported to Sheets.')}>
          Export match settings to Sheets
        </button>
      </div>

      {status ? <div className="muted">{status}</div> : null}
    </form>
  );
}
