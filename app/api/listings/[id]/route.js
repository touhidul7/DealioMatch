import { getSupabaseAdmin } from '@/lib/supabase';

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const payload = await request.json();
    const allowed = [
      'listing_title',
      'company_name',
      'source_site',
      'source_url',
      'source_listing_key',
      'industry',
      'sub_industry',
      'industry_normalized',
      'keywords_normalized',
      'city',
      'state_province',
      'country',
      'geo_normalized',
      'asking_price',
      'revenue',
      'ebitda',
      'sde_cash_flow',
      'employees',
      'established_year',
      'inventory_included',
      'real_estate_included',
      'reason_for_sale',
      'summary',
      'listing_status',
      'is_active',
      'listing_dedupe_key',
      'manual_review_flag'
    ];
    const mapped = {};
    allowed.forEach((key) => {
      if (payload[key] !== undefined) mapped[key] = payload[key];
    });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('listings').update(mapped).eq('id', id).select('*').single();
    if (error) throw new Error(error.message);
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id } = params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('listings').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
