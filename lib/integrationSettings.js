import { getSupabaseAdmin } from '@/lib/supabase';
import { GOOGLE_SHEET_DEFAULTS } from '@/lib/sheetsSchema';

function isMissingIntegrationTableError(error) {
  const message = String(error?.message || '');
  return message.includes("Could not find the table 'public.integration_settings'");
}

export async function getIntegrationSettings() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('integration_settings').select('setting_name, setting_value');
  if (error) {
    if (isMissingIntegrationTableError(error)) {
      return { ...GOOGLE_SHEET_DEFAULTS };
    }
    throw new Error(error.message);
  }

  const mapped = (data || []).reduce((acc, row) => {
    acc[row.setting_name] = row.setting_value;
    return acc;
  }, {});

  return { ...GOOGLE_SHEET_DEFAULTS, ...mapped };
}

export async function upsertIntegrationSettings(partial) {
  const rows = Object.entries(partial).map(([setting_name, setting_value]) => ({
    setting_name,
    setting_value: setting_value == null ? '' : String(setting_value)
  }));

  if (!rows.length) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('integration_settings').upsert(rows, { onConflict: 'setting_name' });
  if (error) {
    if (isMissingIntegrationTableError(error)) {
      throw new Error('Missing table integration_settings. Run scripts/schema.sql in Supabase SQL editor, then try again.');
    }
    throw new Error(error.message);
  }
}

export function parseBooleanSetting(value, fallback = false) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}
