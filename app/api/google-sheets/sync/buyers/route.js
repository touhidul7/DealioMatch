import { getSheetsClient, readSheetAsObjects } from '@/lib/googleSheets';
import { getIntegrationSettings } from '@/lib/integrationSettings';
import { buildRawImportRows, ingestRawBuyerImports, processPendingRawBuyerImports } from '@/lib/buyerIngestion';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  try {
    const settings = await getIntegrationSettings();
    const sheets = getSheetsClient(settings);
    if (!settings.gsheets_buyers_spreadsheet_id) {
      return Response.json({ error: 'Missing buyers spreadsheet ID in settings.' }, { status: 400 });
    }

    const rawRowsFromSheet = await readSheetAsObjects({
      sheets,
      spreadsheetId: settings.gsheets_buyers_spreadsheet_id,
      tabName: settings.gsheets_buyers_raw_imports_tab || 'buyers_raw_imports'
    });

    const importBatchId = `GSHEETS-${Date.now()}`;
    const rawRows = buildRawImportRows(rawRowsFromSheet, { importBatchId, sourceFileName: 'google_sheets' });
    const ingested = await ingestRawBuyerImports(rawRows);
    const processed = await processPendingRawBuyerImports({ importBatchId });

    let dedupeUpdated = 0;
    const dedupeTabName = settings.gsheets_buyers_dedupe_review_tab || 'buyers_dedupe_review';
    if (dedupeTabName) {
      try {
        const dedupeRows = await readSheetAsObjects({
          sheets,
          spreadsheetId: settings.gsheets_buyers_spreadsheet_id,
          tabName: dedupeTabName
        });

        if (dedupeRows.length) {
          const supabase = getSupabaseAdmin();
          for (const row of dedupeRows) {
            const caseId = String(row.dedupe_case_id || '').trim();
            if (!caseId) continue;
            const reviewerStatus = String(row.reviewer_status || '').trim();
            const reviewerNotes = String(row.reviewer_notes || '').trim();
            if (!reviewerStatus && !reviewerNotes) continue;
            const { error } = await supabase
              .from('buyers_dedupe_review')
              .update({
                reviewer_status: reviewerStatus || 'pending',
                reviewer_notes: reviewerNotes || null,
                reviewed_at: new Date().toISOString()
              })
              .eq('dedupe_case_id', caseId);
            if (!error) dedupeUpdated += 1;
          }
        }
      } catch {}
    }

    return Response.json({
      success: true,
      source_rows: rawRowsFromSheet.length,
      raw_inserted: ingested.inserted,
      dedupe_updated_from_sheet: dedupeUpdated,
      ...processed
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
