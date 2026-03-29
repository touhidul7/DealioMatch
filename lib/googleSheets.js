import { google } from 'googleapis';
import { parseBooleanSetting } from '@/lib/integrationSettings';

function normalizePrivateKey(value = '') {
  return String(value).replace(/\\n/g, '\n');
}

function getOAuthCredentials(settings) {
  return {
    clientId: settings.gsheets_client_id || process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: settings.gsheets_client_secret || process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: settings.gsheets_refresh_token || process.env.GOOGLE_REFRESH_TOKEN || ''
  };
}

export function getOAuthClientIdAndSecret(settings) {
  const { clientId, clientSecret } = getOAuthCredentials(settings);
  return { clientId, clientSecret };
}

export function getOAuth2Client(settings) {
  const { clientId, clientSecret, refreshToken } = getOAuthCredentials(settings);
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth is not fully configured.');
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

export function canUseGoogleSheets(settings) {
  if (!parseBooleanSetting(settings.gsheets_enabled)) return false;
  const mode = settings.gsheets_auth_mode || 'service_account';
  if (mode === 'oauth') {
    const { clientId, clientSecret, refreshToken } = getOAuthCredentials(settings);
    return Boolean(clientId && clientSecret && refreshToken);
  }
  return Boolean(settings.gsheets_client_email && settings.gsheets_private_key);
}

export function getSheetsClient(settings) {
  if (!canUseGoogleSheets(settings)) {
    throw new Error('Google Sheets integration is not configured or enabled.');
  }

  const mode = settings.gsheets_auth_mode || 'service_account';
  let auth;

  if (mode === 'oauth') {
    auth = getOAuth2Client(settings);
  } else {
    auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: settings.gsheets_client_email,
        private_key: normalizePrivateKey(settings.gsheets_private_key)
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
  }

  return google.sheets({ version: 'v4', auth });
}

export async function listAccessibleSpreadsheets(settings) {
  const auth = getOAuth2Client(settings);
  const drive = google.drive({ version: 'v3', auth });
  const sharedDriveResponse = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    pageSize: 200,
    fields: 'files(id,name,modifiedTime,ownedByMe,driveId)',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'allDrives'
  });

  const sharedWithMeResponse = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and sharedWithMe=true",
    pageSize: 200,
    fields: 'files(id,name,modifiedTime,ownedByMe,driveId)',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'user'
  });

  const combined = [...(sharedDriveResponse.data.files || []), ...(sharedWithMeResponse.data.files || [])];
  const uniqueById = new Map();
  combined.forEach((file) => {
    if (file?.id) uniqueById.set(file.id, file);
  });

  return Array.from(uniqueById.values()).sort((a, b) => {
    const at = new Date(a.modifiedTime || 0).getTime();
    const bt = new Date(b.modifiedTime || 0).getTime();
    return bt - at;
  });
}

export async function listWorksheetTabs(settings, spreadsheetId) {
  const sheets = getSheetsClient({ ...settings, gsheets_enabled: 'true' });
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title'
  });
  return (response.data.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean);
}

export async function readSheetAsObjects({ sheets, spreadsheetId, tabName }) {
  const range = `${tabName}!A1:ZZ`;
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const values = response.data.values || [];
  if (!values.length) return [];

  const headers = values[0].map((header) => String(header || '').trim());
  return values.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });
    return record;
  });
}

export async function writeSheetObjects({ sheets, spreadsheetId, tabName, columns, rows }) {
  const range = `${tabName}!A1`;
  const dataRows = rows.map((row) => columns.map((column) => row[column] ?? ''));
  const values = [columns, ...dataRows];

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${tabName}!A:ZZ`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values }
  });

  return { count: rows.length };
}
