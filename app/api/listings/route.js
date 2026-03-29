import { getSupabaseAdmin } from '@/lib/supabase';
import { mapListingRowToDb } from '@/lib/dataMappers';

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseNumber(searchParams.get('page'), 1));
    const pageSize = Math.min(100, Math.max(5, parseNumber(searchParams.get('page_size'), 20)));
    const sortBy = searchParams.get('sort_by') || 'updated_at';
    const sortDir = (searchParams.get('sort_dir') || 'desc').toLowerCase() === 'asc';
    const query = (searchParams.get('q') || '').trim();
    const active = searchParams.get('active');

    let builder = supabase.from('listings').select('*', { count: 'exact' });
    if (active === 'true') builder = builder.eq('is_active', true);
    if (active === 'false') builder = builder.eq('is_active', false);
    if (query) {
      builder = builder.or(
        `listing_title.ilike.%${query}%,company_name.ilike.%${query}%,industry.ilike.%${query}%,city.ilike.%${query}%,state_province.ilike.%${query}%,country.ilike.%${query}%`
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await builder.order(sortBy, { ascending: sortDir }).range(from, to);
    if (error) throw new Error(error.message);

    return Response.json({ rows: data || [], total: count || 0, page, page_size: pageSize });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const supabase = getSupabaseAdmin();
    const rows = Array.isArray(payload) ? payload : [payload];
    const mapped = rows.map(mapListingRowToDb).filter((row) => row.listing_title);
    if (!mapped.length) return Response.json({ error: 'No listings supplied.' }, { status: 400 });

    const { data, error } = await supabase.from('listings').insert(mapped).select();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ count: data?.length || 0, rows: data || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
