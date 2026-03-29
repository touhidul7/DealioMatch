'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import DataIOPanel from '@/components/DataIOPanel';
import ListingParserForm from '@/components/ListingParserForm';
import ListingsTableManager from '@/components/ListingsTableManager';

export default function ListingsPage() {
  const [showParser, setShowParser] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);

  return (
    <AppShell>
      <div className="page-grid">
        <div className="heading">
          <div>
            <div className="kicker">Inventory</div>
            <h1>Listings</h1>
          </div>
          <div className="toolbar">
            <button
              className="button secondary"
              onClick={() => setShowParser(!showParser)}
            >
              {showParser ? 'Hide' : 'Show'} AI Parser
            </button>
            <button
              className="button secondary"
              onClick={() => setShowImportExport(!showImportExport)}
            >
              {showImportExport ? 'Hide' : 'Show'} Import/Export
            </button>
          </div>
        </div>

        {showParser && <ListingParserForm />}

        {showImportExport && (
          <DataIOPanel entity="listings" title="Listings Import / Export" />
        )}

        <ListingsTableManager />
      </div>
    </AppShell>
  );
}

