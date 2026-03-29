import { parseTabularFile } from '@/lib/fileInterop';
import { mapListingRowToDb } from '@/lib/dataMappers';
import { buildRawImportRows, ingestRawBuyerImports, processPendingRawBuyerImports } from '@/lib/buyerIngestion';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

function asText(value) {
  return value == null ? '' : String(value).trim();
}

function toNullIfEmpty(value) {
  const text = asText(value);
  return text === '' ? null : text;
}

function toNumberOrNull(value) {
  const text = asText(value);
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function mapMatchRowToDb(row) {
  return {
    match_run_id: toNullIfEmpty(row.match_run_id),
    match_date: toNullIfEmpty(row.match_date),
    listing_id: toNullIfEmpty(row.listing_id),
    buyer_id: toNullIfEmpty(row.buyer_id),
    listing_title: toNullIfEmpty(row.listing_title),
    buyer_name: toNullIfEmpty(row.buyer_name),
    buyer_company: toNullIfEmpty(row.buyer_company),
    buyer_email: toNullIfEmpty(row.buyer_email),
    buyer_phone: toNullIfEmpty(row.buyer_phone),
    overall_score: toNumberOrNull(row.overall_score),
    industry_score: toNumberOrNull(row.industry_score),
    geo_score: toNumberOrNull(row.geo_score),
    size_score: toNumberOrNull(row.size_score),
    revenue_score: toNumberOrNull(row.revenue_score),
    ebitda_score: toNumberOrNull(row.ebitda_score),
    keyword_score: toNumberOrNull(row.keyword_score),
    freshness_score: toNumberOrNull(row.freshness_score),
    rank_for_listing: toNumberOrNull(row.rank_for_listing),
    rank_for_buyer: toNumberOrNull(row.rank_for_buyer),
    match_bucket: toNullIfEmpty(row.match_bucket),
    explanation: toNullIfEmpty(row.explanation)
  };
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
      const importBatchId = `FILE-${Date.now()}`;
      const rawRows = buildRawImportRows(parsedRows, {
        importBatchId,
        sourceFileName: file.name || ''
      });
      const ingested = await ingestRawBuyerImports(rawRows);
      const processed = await processPendingRawBuyerImports({ importBatchId });
      return Response.json({
        success: true,
        source_rows: parsedRows.length,
        raw_inserted: ingested.inserted,
        ...processed
      });
    }

    if (entity === 'listings') {
      const rows = parsedRows.map(mapListingRowToDb).filter((row) => row.listing_title);
      const { data, error } = await supabase.from('listings').insert(rows).select('id');
      if (error) throw new Error(error.message);
      return Response.json({ success: true, source_rows: parsedRows.length, inserted: data?.length || 0 });
    }

    if (entity === 'matches') {
      const rows = parsedRows.map(mapMatchRowToDb);
      const { data, error } = await supabase.from('matches').insert(rows).select('id');
      if (error) throw new Error(error.message);
      return Response.json({ success: true, source_rows: parsedRows.length, inserted: data?.length || 0 });
    }

    return Response.json({ error: 'Unsupported import entity.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
