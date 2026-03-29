import { getIntegrationSettings, upsertIntegrationSettings } from '@/lib/integrationSettings';
import { getOAuthClientIdAndSecret } from '@/lib/googleSheets';
import { google } from 'googleapis';

function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const encodedState = url.searchParams.get('state');
    if (!code) return htmlResponse('<script>window.close()</script>', 400);

    let target = 'buyers';
    if (encodedState) {
      try {
        const state = JSON.parse(Buffer.from(encodedState, 'base64url').toString('utf-8'));
        target = state?.target || target;
      } catch {}
    }

    const settings = await getIntegrationSettings();
    const { clientId, clientSecret } = getOAuthClientIdAndSecret(settings);
    if (!clientId || !clientSecret) {
      return htmlResponse('<script>window.opener?.postMessage({type:"google-oauth-error",error:"Missing OAuth credentials"}, "*");window.close();</script>', 400);
    }

    const origin = `${url.protocol}//${url.host}`;
    const redirectUri = `${origin}/api/google-oauth/callback`;
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2.getToken(code);

    const updates = {
      gsheets_enabled: 'true',
      gsheets_auth_mode: 'oauth'
    };
    if (tokens.refresh_token) updates.gsheets_refresh_token = tokens.refresh_token;
    if (!settings.gsheets_client_id && process.env.GOOGLE_CLIENT_ID) updates.gsheets_client_id = process.env.GOOGLE_CLIENT_ID;
    if (!settings.gsheets_client_secret && process.env.GOOGLE_CLIENT_SECRET) updates.gsheets_client_secret = process.env.GOOGLE_CLIENT_SECRET;

    await upsertIntegrationSettings(updates);

    return htmlResponse(`
      <script>
        window.opener && window.opener.postMessage({ type: 'google-oauth-success', target: '${target}' }, '*');
        window.close();
      </script>
    `);
  } catch (error) {
    return htmlResponse(`
      <script>
        window.opener && window.opener.postMessage({ type: 'google-oauth-error', error: ${JSON.stringify(error.message || 'OAuth callback failed')} }, '*');
        window.close();
      </script>
    `, 500);
  }
}
