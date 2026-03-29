import { getSheetsClient, readSheetAsObjects } from '@/lib/googleSheets';
import { getIntegrationSettings } from '@/lib/integrationSettings';
import { mapBuyerRowToDb } from '@/lib/dataMappers';
import { getSupabaseAdmin } from '@/lib/supabase';

async function upsertBuyerRows(rows) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error } = await supabase
    .from('buyers')
    .select('id, normalized_email, normalized_phone')
    .limit(5000);
  if (error) throw new Error(error.message);

  const byEmail = new Map();
  const byPhone = new Map();
  (existing || []).forEach((buyer) => {
    if (buyer.normalized_email) byEmail.set(buyer.normalized_email, buyer.id);
    if (buyer.normalized_phone) byPhone.set(buyer.normalized_phone, buyer.id);
  });

  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const mapped = mapBuyerRowToDb(row);
    if (!mapped.full_name && !mapped.email && !mapped.phone) continue;

    const existingId = mapped.normalized_email
      ? byEmail.get(mapped.normalized_email)
      : mapped.normalized_phone
        ? byPhone.get(mapped.normalized_phone)
        : null;

    if (existingId) {
      const { error: updateError } = await supabase.from('buyers').update(mapped).eq('id', existingId);
      if (updateError) throw new Error(updateError.message);
      updated += 1;
      continue;
    }

    const { data: inserted, error: insertError } = await supabase.from('buyers').insert(mapped).select('id').single();
    if (insertError) throw new Error(insertError.message);
    created += 1;
    if (mapped.normalized_email) byEmail.set(mapped.normalized_email, inserted.id);
    if (mapped.normalized_phone) byPhone.set(mapped.normalized_phone, inserted.id);
  }

  return { created, updated };
}

export async function POST() {
  try {
    const settings = await getIntegrationSettings();
    const sheets = getSheetsClient(settings);
    if (!settings.gsheets_buyers_spreadsheet_id) {
      return Response.json({ error: 'Missing buyers spreadsheet ID in settings.' }, { status: 400 });
    }

    const rows = await readSheetAsObjects({
      sheets,
      spreadsheetId: settings.gsheets_buyers_spreadsheet_id,
      tabName: settings.gsheets_buyers_master_tab || settings.gsheets_buyers_tab || 'buyers_master'
    });

    const result = await upsertBuyerRows(rows);
    return Response.json({ success: true, source_rows: rows.length, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
