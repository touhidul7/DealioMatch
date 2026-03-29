import { getSupabaseAdmin } from '@/lib/supabase';

function similarityScore(a, b) {
  const aName = String(a.full_name || '').toLowerCase().trim();
  const bName = String(b.full_name || '').toLowerCase().trim();
  const aCompany = String(a.company || '').toLowerCase().trim();
  const bCompany = String(b.company || '').toLowerCase().trim();

  let score = 0;
  if (a.normalized_email && b.normalized_email && a.normalized_email === b.normalized_email) score += 100;
  if (a.normalized_phone && b.normalized_phone && a.normalized_phone === b.normalized_phone) score += 90;
  if (aName && bName && aName === bName) score += 70;
  if (aCompany && bCompany && aCompany === bCompany) score += 40;
  return Math.min(score, 100);
}

function similarityReason(a, b) {
  const reasons = [];
  if (a.normalized_email && b.normalized_email && a.normalized_email === b.normalized_email) reasons.push('Same normalized email');
  if (a.normalized_phone && b.normalized_phone && a.normalized_phone === b.normalized_phone) reasons.push('Same normalized phone');
  if (String(a.full_name || '').toLowerCase().trim() === String(b.full_name || '').toLowerCase().trim()) reasons.push('Same full name');
  if (String(a.company || '').toLowerCase().trim() === String(b.company || '').toLowerCase().trim()) reasons.push('Same company');
  return reasons.join('; ') || 'Potential profile overlap';
}

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: buyers, error } = await supabase
      .from('buyers')
      .select('id,full_name,company,normalized_email,normalized_phone')
      .eq('is_active', true)
      .limit(5000);
    if (error) throw new Error(error.message);

    await supabase.from('buyers_dedupe_review').delete().neq('id', null);

    const rows = [];
    const list = buyers || [];
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const score = similarityScore(a, b);
        if (score < 70) continue;
        rows.push({
          dedupe_case_id: `DED-${Date.now()}-${rows.length + 1}`,
          candidate_buyer_id_1: a.id,
          candidate_buyer_id_2: b.id,
          similarity_reason: similarityReason(a, b),
          similarity_score: score,
          suggested_action: score >= 90 ? 'merge' : 'review',
          reviewer_status: 'pending'
        });
      }
    }

    if (rows.length) {
      const { error: insertError } = await supabase.from('buyers_dedupe_review').insert(rows);
      if (insertError) throw new Error(insertError.message);
    }

    return Response.json({ success: true, cases: rows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
