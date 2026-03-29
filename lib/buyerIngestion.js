import { getSupabaseAdmin } from '@/lib/supabase';
import { mapBuyerRowToDb, normalizeEmail, normalizePhone } from '@/lib/dataMappers';

function asText(value) {
  return value == null ? '' : String(value).trim();
}

function getValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return '';
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

function nameCompanyDedupeKey(fullName, company) {
  const left = asText(fullName).toLowerCase();
  const right = asText(company).toLowerCase();
  if (!left && !right) return null;
  return `${left}|${right}`;
}

function freshnessScore(lastContactDate) {
  if (!lastContactDate) return 20;
  const date = new Date(lastContactDate);
  if (Number.isNaN(date.getTime())) return 20;
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 30) return 100;
  if (days <= 90) return 80;
  if (days <= 180) return 60;
  if (days <= 365) return 40;
  return 20;
}

export function buildRawImportRows(rows, { importBatchId, sourceFileName = '', sourceAdvisorId = '', sourceAdvisorName = '' } = {}) {
  const timestamp = new Date().toISOString();
  return rows.map((row, index) => ({
    raw_import_id: asText(getValue(row, ['raw_import_id'])) || `${importBatchId || 'BATCH'}-RAW-${index + 1}`,
    import_batch_id: importBatchId || `BATCH-${Date.now()}`,
    source_file_name: asText(getValue(row, ['source_file_name'])) || sourceFileName || null,
    source_advisor_id: asText(getValue(row, ['source_advisor_id'])) || sourceAdvisorId || null,
    source_advisor_name: asText(getValue(row, ['source_advisor_name'])) || sourceAdvisorName || null,
    imported_at: getValue(row, ['imported_at']) || timestamp,
    raw_first_name: asText(getValue(row, ['raw_first_name', 'first_name', 'First Name'])) || null,
    raw_last_name: asText(getValue(row, ['raw_last_name', 'last_name', 'Last Name'])) || null,
    raw_full_name: asText(getValue(row, ['raw_full_name', 'full_name', 'Full Name'])) || null,
    raw_email: asText(getValue(row, ['raw_email', 'email', 'Email'])) || null,
    raw_phone: asText(getValue(row, ['raw_phone', 'phone', 'Phone'])) || null,
    raw_company: asText(getValue(row, ['raw_company', 'company', 'Company'])) || null,
    raw_city: asText(getValue(row, ['raw_city', 'city', 'City'])) || null,
    raw_state: asText(getValue(row, ['raw_state', 'state_province', 'state', 'State'])) || null,
    raw_country: asText(getValue(row, ['raw_country', 'country', 'Country'])) || null,
    raw_tags: asText(getValue(row, ['raw_tags', 'tags'])) || null,
    raw_notes: asText(getValue(row, ['raw_notes', 'notes'])) || null,
    raw_acquisition_criteria: asText(getValue(row, ['raw_acquisition_criteria', 'acquisition_criteria_raw'])) || null,
    raw_industry_interest: asText(getValue(row, ['raw_industry_interest', 'industry_interest_raw'])) || null,
    raw_geographic_focus: asText(getValue(row, ['raw_geographic_focus', 'geographic_focus_raw'])) || null,
    raw_deal_size: asText(getValue(row, ['raw_deal_size', 'deal_size'])) || null,
    raw_capital_available: asText(getValue(row, ['raw_capital_available', 'capital_available'])) || null,
    raw_last_contact_date: asText(getValue(row, ['raw_last_contact_date', 'last_contact_date'])) || null,
    raw_custom_fields_json: asText(getValue(row, ['raw_custom_fields_json'])) || null,
    processing_status: asText(getValue(row, ['processing_status'])) || 'pending',
    processing_notes: asText(getValue(row, ['processing_notes'])) || null
  }));
}

function rawImportRowToBuyerInput(rawRow) {
  return {
    first_name: rawRow.raw_first_name,
    last_name: rawRow.raw_last_name,
    full_name: rawRow.raw_full_name,
    email: rawRow.raw_email,
    phone: rawRow.raw_phone,
    company: rawRow.raw_company,
    city: rawRow.raw_city,
    state_province: rawRow.raw_state,
    country: rawRow.raw_country,
    tags: rawRow.raw_tags,
    notes: rawRow.raw_notes,
    acquisition_criteria_raw: rawRow.raw_acquisition_criteria,
    industry_interest_raw: rawRow.raw_industry_interest,
    geographic_focus_raw: rawRow.raw_geographic_focus,
    raw_deal_size: rawRow.raw_deal_size,
    raw_capital_available: rawRow.raw_capital_available,
    raw_last_contact_date: rawRow.raw_last_contact_date
  };
}

export async function ingestRawBuyerImports(rawRows) {
  if (!rawRows.length) return { inserted: 0 };
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('buyers_raw_imports').insert(rawRows).select('id');
  if (error) throw new Error(error.message);
  return { inserted: data?.length || 0 };
}

export async function processPendingRawBuyerImports({ importBatchId = null } = {}) {
  const supabase = getSupabaseAdmin();
  let pendingQuery = supabase
    .from('buyers_raw_imports')
    .select('*')
    .in('processing_status', ['pending', 'retry'])
    .order('imported_at', { ascending: true })
    .limit(5000);
  if (importBatchId) pendingQuery = pendingQuery.eq('import_batch_id', importBatchId);
  const { data: pendingRows, error: pendingError } = await pendingQuery;
  if (pendingError) throw new Error(pendingError.message);

  if (!pendingRows?.length) {
    return { processed: 0, created: 0, updated: 0, failed: 0 };
  }

  const { data: existing, error: existingError } = await supabase
    .from('buyers')
    .select('id, normalized_email, normalized_phone, source_file_names, source_advisor_ids, source_advisor_names, tags, notes')
    .limit(5000);
  if (existingError) throw new Error(existingError.message);

  const byEmail = new Map();
  const byPhone = new Map();
  (existing || []).forEach((buyer) => {
    if (buyer.normalized_email) byEmail.set(buyer.normalized_email, buyer);
    if (buyer.normalized_phone) byPhone.set(buyer.normalized_phone, buyer);
  });

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const raw of pendingRows) {
    try {
      const mapped = mapBuyerRowToDb(rawImportRowToBuyerInput(raw));
      if (!mapped.full_name && !mapped.email && !mapped.phone) {
        await supabase
          .from('buyers_raw_imports')
          .update({ processing_status: 'skipped', processing_notes: 'Missing name/email/phone' })
          .eq('id', raw.id);
        continue;
      }

      mapped.source_file_names = mergeCsvValues(raw.source_file_name);
      mapped.source_advisor_ids = mergeCsvValues(raw.source_advisor_id);
      mapped.source_advisor_names = mergeCsvValues(raw.source_advisor_name);
      mapped.email_dedupe_key = normalizeEmail(mapped.email || '') || null;
      mapped.phone_dedupe_key = normalizePhone(mapped.phone || '') || null;
      mapped.name_company_dedupe_key = nameCompanyDedupeKey(mapped.full_name, mapped.company);
      mapped.freshness_score = freshnessScore(mapped.last_contact_date);

      const existingBuyer = mapped.normalized_email
        ? byEmail.get(mapped.normalized_email)
        : mapped.normalized_phone
          ? byPhone.get(mapped.normalized_phone)
          : null;

      if (existingBuyer) {
        const updatePayload = {
          ...mapped,
          source_file_names: mergeCsvValues(existingBuyer.source_file_names, raw.source_file_name),
          source_advisor_ids: mergeCsvValues(existingBuyer.source_advisor_ids, raw.source_advisor_id),
          source_advisor_names: mergeCsvValues(existingBuyer.source_advisor_names, raw.source_advisor_name),
          tags: mergeCsvValues(existingBuyer.tags, mapped.tags),
          notes: mergeCsvValues(existingBuyer.notes, mapped.notes)
        };
        const { error: updateError } = await supabase.from('buyers').update(updatePayload).eq('id', existingBuyer.id);
        if (updateError) throw new Error(updateError.message);
        updated += 1;
      } else {
        const { data: inserted, error: insertError } = await supabase.from('buyers').insert(mapped).select('id, normalized_email, normalized_phone').single();
        if (insertError) throw new Error(insertError.message);
        created += 1;
        if (inserted.normalized_email) byEmail.set(inserted.normalized_email, { ...mapped, id: inserted.id });
        if (inserted.normalized_phone) byPhone.set(inserted.normalized_phone, { ...mapped, id: inserted.id });
      }

      await supabase
        .from('buyers_raw_imports')
        .update({ processing_status: 'processed', processing_notes: null })
        .eq('id', raw.id);
    } catch (error) {
      failed += 1;
      await supabase
        .from('buyers_raw_imports')
        .update({ processing_status: 'failed', processing_notes: String(error.message || error) })
        .eq('id', raw.id);
    }
  }

  return {
    processed: pendingRows.length,
    created,
    updated,
    failed
  };
}
