import AppShell from '@/components/AppShell';
import DataIOPanel from '@/components/DataIOPanel';
import ListingParserForm from '@/components/ListingParserForm';
import ListingsTableManager from '@/components/ListingsTableManager';

export default function ListingsPage() {
  return (
    <AppShell>
      <div className="grid" style={{ gap: 24 }}>
        <div className="heading">
          <div>
            <div className="kicker">Inventory</div>
            <h1>Listings</h1>
          </div>
        </div>
        <div className="grid grid-2">
          <div>
            <DataIOPanel entity="listings" title="Listings Import / Export" />
            <ListingsTableManager />
          </div>
          <ListingParserForm />
        </div>
      </div>
    </AppShell>
  );
}
