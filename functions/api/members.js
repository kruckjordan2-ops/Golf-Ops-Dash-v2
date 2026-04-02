// GET /api/members — list all members (with optional search)
// GET /api/members?q=smith — search by name
// GET /api/members?type=Full+Member — filter by membership type
export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  const type = url.searchParams.get('type');
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = 'SELECT * FROM members';
  const params = [];
  const conditions = [];

  if (q) {
    conditions.push("(first_name LIKE ?1 OR last_name LIKE ?1 OR member_code LIKE ?1)");
    params.push(`%${q}%`);
  }
  if (type) {
    conditions.push(`membership_type = ?${params.length + 1}`);
    params.push(type);
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ` ORDER BY last_name, first_name LIMIT ?${params.length + 1} OFFSET ?${params.length + 2}`;
  params.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();

  return Response.json({ members: results, count: results.length });
}
