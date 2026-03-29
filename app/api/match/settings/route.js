import { getDefaultMatchSettings } from '@/lib/matching';
import { getSupabaseAdmin } from '@/lib/supabase';

function coerceSettings(rows) {
  const defaults = getDefaultMatchSettings();
  if (!rows?.length) return defaults;

  return rows.reduce((acc, row) => {
    if (!(row.setting_name in defaults)) return acc;
    const numeric = Number(row.setting_value);
    acc[row.setting_name] = Number.isFinite(numeric) ? numeric : defaults[row.setting_name];
    return acc;
  }, { ...defaults });
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('match_settings').select('setting_name, setting_value');
    if (error) throw new Error(error.message);
    return Response.json(coerceSettings(data));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const payload = await request.json();
    const defaults = getDefaultMatchSettings();
    const upserts = Object.keys(defaults)
      .filter((key) => payload[key] != null)
      .map((key) => ({
        setting_name: key,
        setting_value: Number(payload[key])
      }))
      .filter((row) => Number.isFinite(row.setting_value));

    if (!upserts.length) {
      return Response.json({ error: 'No valid settings supplied.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('match_settings').upsert(upserts, { onConflict: 'setting_name' });
    if (error) throw new Error(error.message);

    const { data: rows, error: fetchError } = await supabase.from('match_settings').select('setting_name, setting_value');
    if (fetchError) throw new Error(fetchError.message);

    return Response.json(coerceSettings(rows));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
