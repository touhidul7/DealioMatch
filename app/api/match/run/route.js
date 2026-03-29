import { getSupabaseAdmin } from '@/lib/supabase';
import { buildTop50ByListingRows, computeMatches, getDefaultMatchSettings } from '@/lib/matching';

async function loadMatchSettings(supabase) {
  const defaults = getDefaultMatchSettings();
  const { data, error } = await supabase.from('match_settings').select('setting_name, setting_value');
  if (error || !data?.length) return defaults;

  return data.reduce((acc, row) => {
    if (!(row.setting_name in defaults)) return acc;
    const numeric = Number(row.setting_value);
    acc[row.setting_name] = Number.isFinite(numeric) ? numeric : defaults[row.setting_name];
    return acc;
  }, { ...defaults });
}

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();
    const matchRunId = `RUN-${Date.now()}`;
    const matchDate = new Date().toISOString();
    const settings = await loadMatchSettings(supabase);

    const [buyersRes, listingsRes] = await Promise.all([
      supabase.from('buyers').select('*').eq('is_active', true),
      supabase.from('listings').select('*').eq('is_active', true)
    ]);

    if (buyersRes.error) throw new Error(buyersRes.error.message);
    if (listingsRes.error) throw new Error(listingsRes.error.message);

    const matches = computeMatches({
      buyers: buyersRes.data || [],
      listings: listingsRes.data || [],
      settings,
      matchRunId,
      matchDate
    });
    const top50ByListing = buildTop50ByListingRows(matches);

    await supabase.from('matches').delete().gte('overall_score', 0);
    await supabase.from('top_50_by_listing').delete().gte('overall_score', 0);

    if (matches.length) {
      const { error } = await supabase.from('matches').insert(matches);
      if (error) throw new Error(error.message);
    }

    if (top50ByListing.length) {
      const { error } = await supabase.from('top_50_by_listing').insert(top50ByListing);
      if (error) throw new Error(error.message);
    }

    await supabase.from('match_runs').insert({
      match_run_id: matchRunId,
      match_date: matchDate,
      listing_count: listingsRes.data?.length || 0,
      buyer_count: buyersRes.data?.length || 0,
      result_count: matches.length,
      threshold_used: settings.min_match_threshold,
      max_matches_per_listing_used: settings.max_matches_per_listing
    });

    await supabase.from('sync_logs').insert({
      source: 'match-engine',
      status: 'success',
      message: `Generated ${matches.length} matches for run ${matchRunId}.`
    });

    return Response.json({ success: true, count: matches.length, match_run_id: matchRunId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
