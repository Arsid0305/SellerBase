import { createAdminClient } from '@/shared/lib/supabase/admin';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';
import type { Review, ReviewRating, ReviewSentiment, ReviewResponseStatus } from '@/features/reviews/types';

type Db = {
  id: string;
  nm_id: number | null;
  product_name: string | null;
  supplier_article: string | null;
  rating: number;
  text: string | null;
  pros: string | null;
  cons: string | null;
  user_name: string | null;
  photo_urls: string[] | null;
  created_at: string;
  answered: boolean;
  answer_text: string | null;
  answer_created_at: string | null;
};

function classifySentiment(rating: number): ReviewSentiment {
  if (rating >= 4) return 'positive';
  if (rating === 3) return 'neutral';
  return 'negative';
}

function classifyResponseStatus(answered: boolean, createdAt: string): ReviewResponseStatus {
  if (answered) return 'answered';
  const ageMs = Date.now() - new Date(createdAt).getTime();
  if (ageMs > 7 * 86_400_000) return 'ignored';
  return 'pending';
}

function joinText(text: string | null, pros: string | null, cons: string | null): string {
  const parts: string[] = [];
  if (text) parts.push(text);
  if (pros) parts.push(`+ ${pros}`);
  if (cons) parts.push(`− ${cons}`);
  return parts.join('\n\n');
}

export async function fetchReviews(limit = 500): Promise<Review[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('wb_reviews_fact')
    .select('id, nm_id, product_name, supplier_article, rating, text, pros, cons, user_name, photo_urls, created_at, answered, answer_text, answer_created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[fetchReviews]', error);
    return [];
  }
  const rows = (data ?? []) as Db[];
  return rows.map((r): Review => ({
    id: r.id,
    productName: r.product_name ?? '—',
    productBarcode: r.supplier_article ?? '',
    myArticle: r.supplier_article ?? null,
    wbArticle: r.nm_id ?? null,
    photoUrl: r.nm_id ? wbPhotoUrl(r.nm_id) : null,
    channel: 'WB',
    rating: Math.max(1, Math.min(5, r.rating)) as ReviewRating,
    text: joinText(r.text, r.pros, r.cons),
    author: r.user_name ?? 'Аноним',
    date: r.created_at,
    sentiment: classifySentiment(r.rating),
    responseStatus: classifyResponseStatus(r.answered, r.created_at),
    ...(r.answer_text ? { responseText: r.answer_text } : {}),
    ...(r.answer_created_at ? { responseDate: r.answer_created_at } : {}),
  }));
}
