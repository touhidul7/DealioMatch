import { buildExportFile } from '@/lib/fileInterop';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  BUYERS_MASTER_COLUMNS,
  LISTINGS_MASTER_COLUMNS,
  MATCH_RESULTS_COLUMNS,
  TOP_50_COLUMNS
} from '@/lib/sheetsSchema';

function getEntityConfig(entity) {
  if (entity === 'buyers') return { table: 'buyers', columns: BUYERS_MASTER_COLUMNS };
  if (entity === 'listings') return { table: 'listings', columns: LISTINGS_MASTER_COLUMNS };
  if (entity === 'matches') return { table: 'matches', columns: MATCH_RESULTS_COLUMNS };
  if (entity === 'top50') return { table: 'top_50_by_listing', columns: TOP_50_COLUMNS };
  return null;
}

export async function GET(request, { params }) {
  try {
    const { entity } = params;
    const config = getEntityConfig(entity);
    if (!config) return Response.json({ error: 'Unsupported export entity.' }, { status: 400 });

    const url = new URL(request.url);
    const format = (url.searchParams.get('format') || 'csv').toLowerCase();
    if (!['csv', 'xlsx'].includes(format)) {
      return Response.json({ error: 'format must be csv or xlsx.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from(config.table).select('*').limit(5000);
    if (error) throw new Error(error.message);

    const file = buildExportFile({
      format,
      columns: config.columns,
      rows: data || []
    });

    return new Response(file.buffer, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename=\"dealio_${entity}.${file.extension}\"`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
