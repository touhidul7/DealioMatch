import AppShell from '@/components/AppShell';
import DataIOPanel from '@/components/DataIOPanel';
import { getSupabaseAdmin } from '@/lib/supabase';

async function getMatches() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('matches').select('*').order('overall_score', { ascending: false }).limit(100);
  return data || [];
}

async function getTopByListing() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('top_50_by_listing')
    .select('*')
    .order('listing_id', { ascending: true })
    .order('buyer_rank', { ascending: true })
    .limit(200);
  return data || [];
}

export default async function MatchesPage() {
  const [matches, topByListing] = await Promise.all([getMatches(), getTopByListing()]);

  return (
    <AppShell>
      <div className="heading">
        <div>
          <div className="kicker">Matching</div>
          <h1>Top matches</h1>
        </div>
      </div>
      <DataIOPanel entity="matches" title="Match Results Import / Export" />
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Run</th>
              <th>Listing</th>
              <th>Buyer</th>
              <th>Score</th>
              <th>Rank</th>
              <th>Bucket</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {matches.length ? matches.map((match) => (
              <tr key={match.id}>
                <td>{match.match_run_id || '-'}</td>
                <td>{match.listing_title || match.listing_id}</td>
                <td>{match.buyer_name || match.buyer_id}</td>
                <td>{match.overall_score}</td>
                <td>{match.rank_for_listing}</td>
                <td><span className="badge">{match.match_bucket}</span></td>
                <td>{match.explanation}</td>
              </tr>
            )) : <tr><td colSpan="7" className="muted">No matches yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="panel table-wrap">
        <div className="heading"><h2>Top 50 By Listing</h2></div>
        <table>
          <thead>
            <tr>
              <th>Listing</th>
              <th>Rank</th>
              <th>Buyer</th>
              <th>Score</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {topByListing.length ? topByListing.map((row) => (
              <tr key={row.id}>
                <td>{row.listing_title || row.listing_id}</td>
                <td>{row.buyer_rank}</td>
                <td>{row.buyer_name || row.buyer_id}</td>
                <td>{row.overall_score}</td>
                <td>{row.explanation}</td>
              </tr>
            )) : <tr><td colSpan="5" className="muted">No top-50 rows yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
