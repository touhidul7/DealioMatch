import AppShell from '@/components/AppShell';
import StatCard from '@/components/StatCard';
import SyncButton from '@/components/SyncButton';
import RunMatchButton from '@/components/RunMatchButton';
import { getSupabaseAdmin } from '@/lib/supabase';

async function getStats() {
  const supabase = getSupabaseAdmin();
  const [buyers, listings, matches, logs] = await Promise.all([
    supabase.from('buyers').select('*', { count: 'exact', head: true }),
    supabase.from('listings').select('*', { count: 'exact', head: true }),
    supabase.from('matches').select('*', { count: 'exact', head: true }),
    supabase.from('sync_logs').select('*').order('created_at', { ascending: false }).limit(5)
  ]);

  return {
    buyers: buyers.count || 0,
    listings: listings.count || 0,
    matches: matches.count || 0,
    logs: logs.data || []
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <AppShell>
      <div className="grid" style={{ gap: 24 }}>
        <div className="heading">
          <div>
            <div className="kicker">Overview</div>
            <h1>Dashboard</h1>
          </div>
          <div className="toolbar">
            <SyncButton />
            <RunMatchButton />
          </div>
        </div>

        <div className="grid grid-4">
          <StatCard label="Total buyers" value={stats.buyers} />
          <StatCard label="Total listings" value={stats.listings} />
          <StatCard label="Total matches" value={stats.matches} />
          <StatCard label="AI providers" value="4" hint="ChatGPT, Gemini, OpenRouter, OpenClaw" />
        </div>

        <div className="panel">
          <div className="heading"><h2>Recent sync logs</h2></div>
          <div className="card-list">
            {stats.logs.length ? stats.logs.map((log) => (
              <div className="card-row" key={log.id}>
                <div>
                  <div><strong>{log.source}</strong> — {log.status}</div>
                  <div className="muted">{log.message}</div>
                </div>
                <div className="muted">{new Date(log.created_at).toLocaleString()}</div>
              </div>
            )) : <div className="muted">No logs yet.</div>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
