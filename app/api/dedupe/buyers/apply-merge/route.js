import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeEmail, normalizePhone } from '@/lib/dataMappers';

function asText(value) {
  return value == null ? '' : String(value).trim();
}

function mergeCsvValues(...values) {
  const set = new Set();
  values
    .map((value) => asText(value))
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => set.add(value));
  return set.size ? Array.from(set).join(', ') : null;
}

function pickValue(primary, secondary) {
  const left = asText(primary);
  if (left) return primary;
  const right = asText(secondary);
  return right ? secondary : null;
}

function buildMergedBuyer(survivor, remove) {
  const merged = {
    first_name: pickValue(survivor.first_name, remove.first_name),
    last_name: pickValue(survivor.last_name, remove.last_name),
    full_name: pickValue(survivor.full_name, remove.full_name),
    email: pickValue(survivor.email, remove.email),
    phone: pickValue(survivor.phone, remove.phone),
    company: pickValue(survivor.company, remove.company),
    city: pickValue(survivor.city, remove.city),
    state_province: pickValue(survivor.state_province, remove.state_province),
    country: pickValue(survivor.country, remove.country),
    geo_normalized: pickValue(survivor.geo_normalized, remove.geo_normalized),
    buyer_type: pickValue(survivor.buyer_type, remove.buyer_type),
    strategic_or_financial: pickValue(survivor.strategic_or_financial, remove.strategic_or_financial),
    industry_interest_raw: pickValue(survivor.industry_interest_raw, remove.industry_interest_raw),
    normalized_industries: pickValue(survivor.normalized_industries, remove.normalized_industries),
    acquisition_criteria_raw: pickValue(survivor.acquisition_criteria_raw, remove.acquisition_criteria_raw),
    normalized_keywords: pickValue(survivor.normalized_keywords, remove.normalized_keywords),
    geographic_focus_raw: pickValue(survivor.geographic_focus_raw, remove.geographic_focus_raw),
    normalized_geographies: pickValue(survivor.normalized_geographies, remove.normalized_geographies),
    deal_size_min: survivor.deal_size_min ?? remove.deal_size_min ?? null,
    deal_size_max: survivor.deal_size_max ?? remove.deal_size_max ?? null,
    revenue_min: survivor.revenue_min ?? remove.revenue_min ?? null,
    revenue_max: survivor.revenue_max ?? remove.revenue_max ?? null,
    ebitda_min: survivor.ebitda_min ?? remove.ebitda_min ?? null,
    ebitda_max: survivor.ebitda_max ?? remove.ebitda_max ?? null,
    capital_available: survivor.capital_available ?? remove.capital_available ?? null,
    source_of_funds: pickValue(survivor.source_of_funds, remove.source_of_funds),
    last_contact_date: survivor.last_contact_date || remove.last_contact_date || null,
    tags: mergeCsvValues(survivor.tags, remove.tags),
    notes: mergeCsvValues(survivor.notes, remove.notes),
    source_file_names: mergeCsvValues(survivor.source_file_names, remove.source_file_names),
    source_advisor_ids: mergeCsvValues(survivor.source_advisor_ids, remove.source_advisor_ids),
    source_advisor_names: mergeCsvValues(survivor.source_advisor_names, remove.source_advisor_names),
    is_active: Boolean(survivor.is_active || remove.is_active),
    manual_review_flag: false
  };

  merged.normalized_email = normalizeEmail(merged.email || '');
  merged.normalized_phone = normalizePhone(merged.phone || '');
  merged.email_dedupe_key = merged.normalized_email || null;
  merged.phone_dedupe_key = merged.normalized_phone || null;
  merged.name_company_dedupe_key = `${asText(merged.full_name).toLowerCase()}|${asText(merged.company).toLowerCase()}`;
  return merged;
}

export async function POST(request) {
  try {
    const { dedupe_case_id, survivor_buyer_id } = await request.json();
    if (!dedupe_case_id) {
      return Response.json({ error: 'dedupe_case_id is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: dedupeCase, error: caseError } = await supabase
      .from('buyers_dedupe_review')
      .select('*')
      .eq('dedupe_case_id', dedupe_case_id)
      .single();
    if (caseError || !dedupeCase) throw new Error(caseError?.message || 'Dedupe case not found.');

    const buyerIds = [dedupeCase.candidate_buyer_id_1, dedupeCase.candidate_buyer_id_2].filter(Boolean);
    if (buyerIds.length !== 2) return Response.json({ error: 'Dedupe case is missing buyer IDs.' }, { status: 400 });

    const { data: buyers, error: buyersError } = await supabase.from('buyers').select('*').in('id', buyerIds);
    if (buyersError) throw new Error(buyersError.message);
    if (!buyers || buyers.length < 2) return Response.json({ error: 'Both buyer records must exist to merge.' }, { status: 400 });

    const preferredId = survivor_buyer_id || dedupeCase.candidate_buyer_id_1;
    const survivor = buyers.find((buyer) => buyer.id === preferredId) || buyers[0];
    const remove = buyers.find((buyer) => buyer.id !== survivor.id);
    if (!remove) return Response.json({ error: 'Could not determine merge target.' }, { status: 400 });

    const mergedPayload = buildMergedBuyer(survivor, remove);
    const { error: updateError } = await supabase.from('buyers').update(mergedPayload).eq('id', survivor.id);
    if (updateError) throw new Error(updateError.message);

    await supabase.from('matches').update({ buyer_id: survivor.id }).eq('buyer_id', remove.id);
    await supabase.from('top_50_by_listing').update({ buyer_id: survivor.id }).eq('buyer_id', remove.id);

    const { error: deleteError } = await supabase.from('buyers').delete().eq('id', remove.id);
    if (deleteError) throw new Error(deleteError.message);

    const { error: caseUpdateError } = await supabase
      .from('buyers_dedupe_review')
      .update({
        reviewer_status: 'merged',
        reviewer_notes: mergeCsvValues(dedupeCase.reviewer_notes, `Merged ${remove.id} into ${survivor.id}`),
        reviewed_at: new Date().toISOString()
      })
      .eq('id', dedupeCase.id);
    if (caseUpdateError) throw new Error(caseUpdateError.message);

    return Response.json({
      success: true,
      dedupe_case_id,
      survivor_buyer_id: survivor.id,
      removed_buyer_id: remove.id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
