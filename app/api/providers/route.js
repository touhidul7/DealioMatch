import { parseListingWithProvider } from '@/lib/providers';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const { provider, rawText } = await request.json();
    if (!provider || !rawText) {
      return Response.json({ error: 'provider and rawText are required.' }, { status: 400 });
    }

    const data = await parseListingWithProvider({ provider, rawText });
    return Response.json(data);
  } catch (error) {
    const status = error?.status || 500;
    return Response.json(
      { error: error?.message || 'Provider request failed.', code: error?.code || 'PROVIDER_REQUEST_FAILED' },
      { status }
    );
  }
}
