import { getSheetsClient, writeSheetObjects } from '@/lib/googleSheets';
import { getIntegrationSettings } from '@/lib/integrationSettings';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  BUYERS_DEDUPE_REVIEW_COLUMNS,
  BUYERS_MASTER_COLUMNS,
  BUYERS_RAW_IMPORTS_COLUMNS,
  LISTINGS_MASTER_COLUMNS,
  MATCH_RESULTS_COLUMNS,
  TOP_50_COLUMNS
} from '@/lib/sheetsSchema';

function toSheetRows(entity, rows) {
  if (entity === 'buyers') {
    return rows.map((row) => ({
      buyer_id: row.id,
      ...row
    }));
  }

  if (entity === 'listings') {
    return rows.map((row) => ({
      listing_id: row.id,
      ...row
    }));
  }

  if (entity === 'matches') {
    return rows.map((row) => ({
      match_id: row.id,
      ...row
    }));
  }

  return rows;
}

function getEntityConfig(entity, settings) {
  if (entity === 'buyers') {
    return {
      table: 'buyers',
      columns: BUYERS_MASTER_COLUMNS,
      spreadsheetId: settings.gsheets_buyers_spreadsheet_id,
      tabName: settings.gsheets_buyers_master_tab || settings.gsheets_buyers_tab || 'buyers_master'
    };
  }

  if (entity === 'buyers_raw_imports') {
    return {
      table: 'buyers_raw_imports',
      columns: BUYERS_RAW_IMPORTS_COLUMNS,
      spreadsheetId: settings.gsheets_buyers_spreadsheet_id,
      tabName: settings.gsheets_buyers_raw_imports_tab || 'buyers_raw_imports'
    };
  }

  if (entity === 'buyers_dedupe_review') {
    return {
      table: 'buyers_dedupe_review',
      columns: BUYERS_DEDUPE_REVIEW_COLUMNS,
      spreadsheetId: settings.gsheets_buyers_spreadsheet_id,
      tabName: settings.gsheets_buyers_dedupe_review_tab || 'buyers_dedupe_review'
    };
  }

  if (entity === 'listings') {
    return {
      table: 'listings',
      columns: LISTINGS_MASTER_COLUMNS,
      spreadsheetId: settings.gsheets_listings_spreadsheet_id,
      tabName: settings.gsheets_listings_master_tab || settings.gsheets_listings_tab || 'listings_master'
    };
  }

  if (entity === 'matches') {
    return {
      table: 'matches',
      columns: MATCH_RESULTS_COLUMNS,
      spreadsheetId: settings.gsheets_matching_spreadsheet_id,
      tabName: settings.gsheets_match_results_tab || 'match_results'
    };
  }

  if (entity === 'top50') {
    return {
      table: 'top_50_by_listing',
      columns: TOP_50_COLUMNS,
      spreadsheetId: settings.gsheets_matching_spreadsheet_id,
      tabName: settings.gsheets_top50_tab || 'top_50_by_listing'
    };
  }

  if (entity === 'match_settings') {
    return {
      table: 'match_settings',
      columns: ['setting_name', 'setting_value'],
      spreadsheetId: settings.gsheets_matching_spreadsheet_id,
      tabName: settings.gsheets_match_settings_tab || 'match_settings'
    };
  }

  throw new Error('Unsupported export target.');
}

export async function POST(request) {
  try {
    const { target } = await request.json();
    if (!target) return Response.json({ error: 'target is required.' }, { status: 400 });

    const settings = await getIntegrationSettings();
    const config = getEntityConfig(target, settings);
    if (!config.spreadsheetId) return Response.json({ error: `Missing spreadsheet ID for ${target}.` }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from(config.table).select('*').limit(5000);
    if (error) throw new Error(error.message);

    const sheets = getSheetsClient(settings);
    const rows = toSheetRows(target, data || []);
    const result = await writeSheetObjects({
      sheets,
      spreadsheetId: config.spreadsheetId,
      tabName: config.tabName,
      columns: config.columns,
      rows
    });

    return Response.json({ success: true, target, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
