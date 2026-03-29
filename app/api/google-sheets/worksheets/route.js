import { getIntegrationSettings } from '@/lib/integrationSettings';
import { listWorksheetTabs } from '@/lib/googleSheets';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const spreadsheetId = url.searchParams.get('spreadsheetId');
    if (!spreadsheetId) {
      return Response.json({ error: 'spreadsheetId is required.' }, { status: 400 });
    }

    const settings = await getIntegrationSettings();
    const tabs = await listWorksheetTabs(settings, spreadsheetId);
    return Response.json({ tabs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
