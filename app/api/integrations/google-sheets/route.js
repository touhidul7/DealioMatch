import { getIntegrationSettings, upsertIntegrationSettings } from '@/lib/integrationSettings';
import { GOOGLE_SHEET_DEFAULTS, GOOGLE_SHEET_TAB_OPTIONS } from '@/lib/sheetsSchema';

export async function GET() {
  try {
    const settings = await getIntegrationSettings();
    return Response.json({
      settings,
      defaults: GOOGLE_SHEET_DEFAULTS,
      tab_options: GOOGLE_SHEET_TAB_OPTIONS
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const payload = await request.json();
    const allowedKeys = new Set(Object.keys(GOOGLE_SHEET_DEFAULTS));
    const safePayload = Object.entries(payload || {}).reduce((acc, [key, value]) => {
      if (allowedKeys.has(key)) acc[key] = value;
      return acc;
    }, {});

    if (!Object.keys(safePayload).length) {
      return Response.json({ error: 'No valid Google Sheets settings provided.' }, { status: 400 });
    }

    await upsertIntegrationSettings(safePayload);
    const settings = await getIntegrationSettings();
    return Response.json({ success: true, settings });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
