// GET /api/rounds — all rounds data
// GET /api/rounds?year=2026 — filter by year
export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const year = url.searchParams.get('year');

  let query = 'SELECT * FROM rounds';
  const params = [];

  if (year) {
    query += ' WHERE year = ?1';
    params.push(parseInt(year));
  }

  query += ' ORDER BY year DESC, month, day_of_week';

  const { results } = await env.DB.prepare(query).bind(...params).all();

  return Response.json({ rounds: results });
}
