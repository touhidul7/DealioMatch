import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('buyers_dedupe_review')
      .select(
        `
        *,
        buyer1:candidate_buyer_id_1(id,full_name,email,company),
        buyer2:candidate_buyer_id_2(id,full_name,email,company)
      `
      )
      .order('similarity_score', { ascending: false })
      .limit(200);

    if (status) query = query.eq('reviewer_status', status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return Response.json({ rows: data || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, reviewer_status, reviewer_notes } = await request.json();
    if (!id) return Response.json({ error: 'id is required.' }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('buyers_dedupe_review')
      .update({
        reviewer_status: reviewer_status || 'pending',
        reviewer_notes: reviewer_notes || '',
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
