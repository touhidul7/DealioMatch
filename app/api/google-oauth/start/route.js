import { getIntegrationSettings } from '@/lib/integrationSettings';
import { getOAuthClientIdAndSecret } from '@/lib/googleSheets';
import { google } from 'googleapis';

export async function GET(request) {
  try {
    const settings = await getIntegrationSettings();
    const { clientId, clientSecret } = getOAuthClientIdAndSecret(settings);
    if (!clientId || !clientSecret) {
      return new Response('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.', { status: 400 });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('target') || 'buyers';
    const origin = `${url.protocol}//${url.host}`;
    const redirectUri = `${origin}/api/google-oauth/callback`;
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const state = Buffer.from(JSON.stringify({ target }), 'utf-8').toString('base64url');
    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.readonly'
      ],
      state
    });

    return Response.redirect(authUrl, 302);
  } catch (error) {
    return new Response(error.message || 'OAuth start failed.', { status: 500 });
  }
}
