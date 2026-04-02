// POST /api/upload — upload a file to R2 and track in D1
export async function onRequestPost({ env, request }) {
  const formData = await request.formData();
  const file = formData.get('file');
  const fileType = formData.get('type') || 'general';  // timesheet, rounds, sales, etc.
  const uploadedBy = formData.get('uploaded_by') || 'unknown';

  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  // Generate a unique key for R2
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const r2Key = `${fileType}/${timestamp}_${file.name}`;

  // Upload to R2
  await env.UPLOADS.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name, fileType, uploadedBy }
  });

  // Track in D1
  await env.DB.prepare(`
    INSERT INTO uploads (filename, r2_key, file_type, file_size, uploaded_by)
    VALUES (?1, ?2, ?3, ?4, ?5)
  `).bind(file.name, r2Key, fileType, file.size, uploadedBy).run();

  return Response.json({
    success: true,
    filename: file.name,
    r2_key: r2Key,
    size: file.size
  });
}

// GET /api/upload — list uploaded files
export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const fileType = url.searchParams.get('type');

  let query = 'SELECT * FROM uploads ORDER BY created_at DESC';
  const params = [];

  if (fileType) {
    query = 'SELECT * FROM uploads WHERE file_type = ?1 ORDER BY created_at DESC';
    params.push(fileType);
  }

  const { results } = await env.DB.prepare(query).bind(...params).all();

  return Response.json({ uploads: results });
}
