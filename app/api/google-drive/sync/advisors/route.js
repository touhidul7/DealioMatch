import { google } from 'googleapis';
import { getOAuth2Client } from '@/lib/googleSheets';
import { getIntegrationSettings } from '@/lib/integrationSettings';
import { parseTabularFile } from '@/lib/fileInterop';
import { buildRawImportRows, ingestRawBuyerImports, processPendingRawBuyerImports } from '@/lib/buyerIngestion';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

function parseAdvisorFolderMappings(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON in gsheets_advisor_folders_json.');
  }
  if (!Array.isArray(parsed)) throw new Error('gsheets_advisor_folders_json must be an array.');
  return parsed
    .map((item) => ({
      folder_id: String(item?.folder_id || '').trim(),
      advisor_id: String(item?.advisor_id || '').trim(),
      advisor_name: String(item?.advisor_name || '').trim()
    }))
    .filter((item) => item.folder_id && item.advisor_id && item.advisor_name);
}

async function bufferFromDriveMedia(mediaResponse) {
  const data = mediaResponse?.data;
  if (!data) return Buffer.from([]);
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer);

  if (typeof data.pipe === 'function') {
    return new Promise((resolve, reject) => {
      const chunks = [];
      data.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      data.on('end', () => resolve(Buffer.concat(chunks)));
      data.on('error', reject);
    });
  }

  if (typeof data === 'string') return Buffer.from(data, 'utf-8');
  return Buffer.from([]);
}

async function upsertFileImportStatus(supabase, payload) {
  const { error } = await supabase.from('advisor_file_imports').upsert(payload, { onConflict: 'file_id' });
  if (error) throw new Error(error.message);
}

export async function POST() {
  try {
    const settings = await getIntegrationSettings();
    const mappings = parseAdvisorFolderMappings(settings.gsheets_advisor_folders_json || '[]');
    if (!mappings.length) {
      return Response.json({ error: 'No advisor folder mappings configured. Set gsheets_advisor_folders_json in Settings.' }, { status: 400 });
    }

    const auth = getOAuth2Client(settings);
    const drive = google.drive({ version: 'v3', auth });
    const supabase = getSupabaseAdmin();

    let filesSeen = 0;
    let filesImported = 0;
    let filesSkipped = 0;
    let rawInserted = 0;
    let processedRows = 0;
    let buyersCreated = 0;
    let buyersUpdated = 0;
    let buyersFailed = 0;

    for (const mapping of mappings) {
      const listResponse = await drive.files.list({
        q: `'${mapping.folder_id}' in parents and trashed=false and mimeType='text/csv'`,
        pageSize: 200,
        fields: 'files(id,name,modifiedTime)',
        orderBy: 'modifiedTime asc'
      });

      const files = listResponse.data.files || [];
      filesSeen += files.length;

      for (const file of files) {
        const fileId = String(file.id || '').trim();
        if (!fileId) continue;

        const { data: existingRecord } = await supabase
          .from('advisor_file_imports')
          .select('id,status')
          .eq('file_id', fileId)
          .maybeSingle();

        if (existingRecord?.status === 'processed') {
          filesSkipped += 1;
          continue;
        }

        const importBatchId = `DRIVE-${fileId}-${Date.now()}`;
        await upsertFileImportStatus(supabase, {
          file_id: fileId,
          file_name: file.name || null,
          folder_id: mapping.folder_id,
          advisor_id: mapping.advisor_id,
          advisor_name: mapping.advisor_name,
          import_batch_id: importBatchId,
          status: 'processing',
          message: null
        });

        try {
          const media = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'arraybuffer' }
          );
          const buffer = await bufferFromDriveMedia(media);
          const parsedRows = parseTabularFile({ filename: file.name || 'advisor_import.csv', buffer });
          const rawRows = buildRawImportRows(parsedRows, {
            importBatchId,
            sourceFileName: file.name || '',
            sourceAdvisorId: mapping.advisor_id,
            sourceAdvisorName: mapping.advisor_name
          });

          const ingested = await ingestRawBuyerImports(rawRows);
          const processed = await processPendingRawBuyerImports({ importBatchId });

          filesImported += 1;
          rawInserted += ingested.inserted || 0;
          processedRows += processed.processed || 0;
          buyersCreated += processed.created || 0;
          buyersUpdated += processed.updated || 0;
          buyersFailed += processed.failed || 0;

          await upsertFileImportStatus(supabase, {
            file_id: fileId,
            file_name: file.name || null,
            folder_id: mapping.folder_id,
            advisor_id: mapping.advisor_id,
            advisor_name: mapping.advisor_name,
            import_batch_id: importBatchId,
            status: 'processed',
            source_rows: parsedRows.length,
            raw_inserted: ingested.inserted || 0,
            processed_rows: processed.processed || 0,
            created_count: processed.created || 0,
            updated_count: processed.updated || 0,
            failed_count: processed.failed || 0,
            imported_at: new Date().toISOString(),
            message: 'Imported and processed successfully.'
          });
        } catch (error) {
          await upsertFileImportStatus(supabase, {
            file_id: fileId,
            file_name: file.name || null,
            folder_id: mapping.folder_id,
            advisor_id: mapping.advisor_id,
            advisor_name: mapping.advisor_name,
            import_batch_id: importBatchId,
            status: 'failed',
            message: String(error.message || error)
          });
        }
      }
    }

    await supabase.from('sync_logs').insert({
      source: 'google-drive-advisor-sync',
      status: 'success',
      message: `Seen ${filesSeen} files, imported ${filesImported}, skipped ${filesSkipped}, buyers created ${buyersCreated}, updated ${buyersUpdated}, failed ${buyersFailed}.`
    });

    return Response.json({
      success: true,
      files_seen: filesSeen,
      files_imported: filesImported,
      files_skipped: filesSkipped,
      raw_inserted: rawInserted,
      processed_rows: processedRows,
      buyers_created: buyersCreated,
      buyers_updated: buyersUpdated,
      buyers_failed: buyersFailed
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
