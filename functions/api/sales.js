// GET /api/sales — all sales data
// GET /api/sales?year=2026 — filter by year
// GET /api/sales?member=393 — filter by member
export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const year = url.searchParams.get('year');
  const member = url.searchParams.get('member');

  let query = 'SELECT * FROM sales';
  const params = [];
  const conditions = [];

  if (year) {
    conditions.push(`year = ?${params.length + 1}`);
    params.push(year);
  }
  if (member) {
    conditions.push(`member_id = ?${params.length + 1}`);
    params.push(member);
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY total DESC';

  const { results } = await env.DB.prepare(query).bind(...params).all();

  return Response.json({ sales: results });
}
