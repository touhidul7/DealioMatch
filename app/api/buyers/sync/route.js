import { fetchGhlContacts, mapGhlContactToBuyer } from '@/lib/ghl';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    const contacts = await fetchGhlContacts();
    const buyers = contacts.map(mapGhlContactToBuyer);
    const supabase = getSupabaseAdmin();

    for (const buyer of buyers) {
      await supabase.from('buyers').upsert(buyer, {
        onConflict: 'ghl_contact_id'
      });
    }

    await supabase.from('sync_logs').insert({
      source: 'ghl',
      status: 'success',
      message: `Synced ${buyers.length} buyers.`
    });

    return Response.json({ success: true, count: buyers.length });
  } catch (error) {
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('sync_logs').insert({
        source: 'ghl',
        status: 'error',
        message: error.message
      });
    } catch {}

    return Response.json({ error: error.message }, { status: 500 });
  }
}
