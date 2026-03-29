import AppShell from '@/components/AppShell';
import { getDefaultMatchSettings } from '@/lib/matching';
import { getSupabaseAdmin } from '@/lib/supabase';
import MatchSettingsPanel from '@/components/MatchSettingsPanel';
import GoogleSheetsSettingsPanel from '@/components/GoogleSheetsSettingsPanel';
import { GOOGLE_SHEET_TAB_OPTIONS } from '@/lib/sheetsSchema';
import { getIntegrationSettings } from '@/lib/integrationSettings';

async function getMatchSettings() {
  const defaults = getDefaultMatchSettings();
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('match_settings').select('setting_name, setting_value');
    if (error || !data?.length) return defaults;

    return data.reduce((acc, row) => {
      if (!(row.setting_name in defaults)) return acc;
      const numeric = Number(row.setting_value);
      acc[row.setting_name] = Number.isFinite(numeric) ? numeric : defaults[row.setting_name];
      return acc;
    }, { ...defaults });
  } catch {
    return defaults;
  }
}

export default async function SettingsPage() {
  const settings = await getMatchSettings();
  const googleSettings = await getIntegrationSettings();

  return (
    <AppShell>
      <div className="grid" style={{ gap: 24 }}>
        <div className="grid grid-2">
          <div className="panel">
            <div className="heading">
              <div>
                <div className="kicker">Integration</div>
                <h1>System settings</h1>
              </div>
            </div>
            <div className="card-list">
              <div className="card-row"><div>Auth</div><div className="muted">NextAuth credentials login</div></div>
              <div className="card-row"><div>Database</div><div className="muted">Supabase Postgres</div></div>
              <div className="card-row"><div>GHL</div><div className="muted">API key + subaccount sync</div></div>
              <div className="card-row"><div>AI providers</div><div className="muted">ChatGPT, Gemini, OpenRouter, OpenClaw</div></div>
            </div>
          </div>
          <div className="panel">
            <MatchSettingsPanel initialSettings={settings} />
          </div>
        </div>

        <div className="panel">
          <GoogleSheetsSettingsPanel initialSettings={googleSettings} tabOptions={GOOGLE_SHEET_TAB_OPTIONS} />
        </div>
      </div>
    </AppShell>
  );
}
