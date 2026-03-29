import { getIntegrationSettings } from '@/lib/integrationSettings';
import { listAccessibleSpreadsheets } from '@/lib/googleSheets';

export async function GET() {
  try {
    const settings = await getIntegrationSettings();
    const files = await listAccessibleSpreadsheets(settings);
    return Response.json({
      files: files.map((file) => ({
        id: file.id,
        name: file.name,
        modifiedTime: file.modifiedTime
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
