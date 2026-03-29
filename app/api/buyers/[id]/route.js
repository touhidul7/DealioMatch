import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeEmail, normalizePhone } from '@/lib/dataMappers';

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const payload = await request.json();
    const allowed = [
      'first_name',
      'last_name',
      'full_name',
      'email',
      'phone',
      'company',
      'city',
      'state_province',
      'country',
      'geo_normalized',
      'buyer_type',
      'strategic_or_financial',
      'industry_interest_raw',
      'normalized_industries',
      'acquisition_criteria_raw',
      'normalized_keywords',
      'geographic_focus_raw',
      'normalized_geographies',
      'deal_size_min',
      'deal_size_max',
      'revenue_min',
      'revenue_max',
      'ebitda_min',
      'ebitda_max',
      'capital_available',
      'last_contact_date',
      'tags',
      'notes',
      'is_active',
      'manual_review_flag'
    ];
    const mapped = {};
    allowed.forEach((key) => {
      if (payload[key] !== undefined) mapped[key] = payload[key];
    });
    if (payload.email !== undefined) mapped.normalized_email = normalizeEmail(payload.email) || null;
    if (payload.phone !== undefined) mapped.normalized_phone = normalizePhone(payload.phone) || null;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('buyers').update(mapped).eq('id', id).select('*').single();
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
    const { error } = await supabase.from('buyers').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
