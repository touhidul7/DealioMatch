import { parseTabularFile } from '@/lib/fileInterop';
import { mapBuyerRowToDb, mapListingRowToDb } from '@/lib/dataMappers';
import { getSupabaseAdmin } from '@/lib/supabase';

async function upsertImportedBuyers(rows) {
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

  for (const row of rows.map(mapBuyerRowToDb)) {
    if (!row.full_name && !row.email && !row.phone) continue;

    const existingId = row.normalized_email
      ? byEmail.get(row.normalized_email)
      : row.normalized_phone
        ? byPhone.get(row.normalized_phone)
        : null;

    if (existingId) {
      const { error: updateError } = await supabase.from('buyers').update(row).eq('id', existingId);
      if (updateError) throw new Error(updateError.message);
      updated += 1;
      continue;
    }

    const { data, error: insertError } = await supabase.from('buyers').insert(row).select('id').single();
    if (insertError) throw new Error(insertError.message);
    created += 1;
    if (row.normalized_email) byEmail.set(row.normalized_email, data.id);
    if (row.normalized_phone) byPhone.set(row.normalized_phone, data.id);
  }

  return { created, updated };
}

export async function POST(request, { params }) {
  try {
    const { entity } = params;
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return Response.json({ error: 'file is required.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsedRows = parseTabularFile({ filename: file.name || '', buffer });
    const supabase = getSupabaseAdmin();

    if (entity === 'buyers') {
      const result = await upsertImportedBuyers(parsedRows);
      return Response.json({ success: true, source_rows: parsedRows.length, ...result });
    }

    if (entity === 'listings') {
      const rows = parsedRows.map(mapListingRowToDb).filter((row) => row.listing_title);
      const { data, error } = await supabase.from('listings').insert(rows).select('id');
      if (error) throw new Error(error.message);
      return Response.json({ success: true, source_rows: parsedRows.length, inserted: data?.length || 0 });
    }

    if (entity === 'matches') {
      const { data, error } = await supabase.from('matches').insert(parsedRows).select('id');
      if (error) throw new Error(error.message);
      return Response.json({ success: true, source_rows: parsedRows.length, inserted: data?.length || 0 });
    }

    return Response.json({ error: 'Unsupported import entity.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
