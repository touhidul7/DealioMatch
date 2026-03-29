import AppShell from '@/components/AppShell';
import DataIOPanel from '@/components/DataIOPanel';
import BuyersTableManager from '@/components/BuyersTableManager';
import BuyerDedupePanel from '@/components/BuyerDedupePanel';

export default function BuyersPage() {
  return (
    <AppShell>
      <div className="page-grid">
        <div className="heading">
          <div>
            <div className="kicker">CRM</div>
            <h1>Buyers</h1>
          </div>
        </div>
        <DataIOPanel entity="buyers" title="Buyers Import / Export" />
        <BuyersTableManager />
        <BuyerDedupePanel />
      </div>
    </AppShell>
  );
}
