import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { action, ids } = await request.json();
    if (!Array.isArray(ids) || !ids.length) {
      return Response.json({ error: 'ids are required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (action === 'delete') {
      const { error } = await supabase.from('listings').delete().in('id', ids);
      if (error) throw new Error(error.message);
      return Response.json({ success: true, action, count: ids.length });
    }

    if (action === 'activate' || action === 'deactivate') {
      const { error } = await supabase
        .from('listings')
        .update({ is_active: action === 'activate' })
        .in('id', ids);
      if (error) throw new Error(error.message);
      return Response.json({ success: true, action, count: ids.length });
    }

    return Response.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
