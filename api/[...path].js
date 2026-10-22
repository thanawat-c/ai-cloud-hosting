export default async function handler(req, res) {
  // Normalize backend base URL (handles with or without /api suffix)
  let backendBase = (
    process.env.BACKEND_API_URL ||
    process.env.BACKEND_URL ||
    'http://20.48.16.226:8080'
  ).replace(/\/+$/, '');

  if (!backendBase.endsWith('/api')) {
    backendBase = `${backendBase}/api`;
  }

  // Parse relative subpath directly from req.url (e.g. /api/auth/login -> auth/login)
  const urlObj = new URL(req.url, 'http://localhost');
  const subPath = urlObj.pathname.replace(/^\/api\/?/, '').replace(/^\[\.\.\.path\]\/?/, '');
  const search = urlObj.search || '';

  const targetUrl = `${backendBase}/${subPath}${search}`;

  try {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;

    const options = {
      method: req.method,
      headers: {
        ...headers,
        'x-forwarded-host': req.headers.host || '',
      },
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body) {
      options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!options.headers['content-type']) {
        options.headers['content-type'] = 'application/json';
      }
    }

    const response = await fetch(targetUrl, options);
    const data = await response.arrayBuffer();

    res.status(response.status);
    response.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lower)) {
        res.setHeader(key, val);
      }
    });

    return res.send(Buffer.from(data));
  } catch (error) {
    console.error('Vercel API Proxy Error:', error);
    return res.status(502).json({
      error: 'Backend API unreachable via proxy',
      message: error.message,
    });
  }
}
