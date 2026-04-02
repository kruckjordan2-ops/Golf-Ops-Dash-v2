// GET /api/leaderboard — current leaderboard
// GET /api/leaderboard?comp=Monthly+Medal — filter by competition
// GET /api/leaderboard?season=2026 — filter by season
export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const comp = url.searchParams.get('comp');
  const season = url.searchParams.get('season');

  let query = 'SELECT * FROM leaderboard';
  const params = [];
  const conditions = [];

  if (comp) {
    conditions.push('competition_name = ?1');
    params.push(comp);
  }
  if (season) {
    conditions.push(`season = ?${params.length + 1}`);
    params.push(season);
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ` ORDER BY position ASC, net_score ASC`;

  const { results } = await env.DB.prepare(query).bind(...params).all();

  return Response.json({ leaderboard: results });
}

// POST /api/leaderboard — add/update leaderboard entry
export async function onRequestPost({ env, request }) {
  const body = await request.json();
  const { member_code, member_name, competition_name, round_date, score, handicap, net_score, position, season } = body;

  await env.DB.prepare(`
    INSERT INTO leaderboard (member_code, member_name, competition_name, round_date, score, handicap, net_score, position, season)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
  `).bind(member_code, member_name, competition_name, round_date, score, handicap, net_score, position, season).run();

  return Response.json({ success: true });
}
