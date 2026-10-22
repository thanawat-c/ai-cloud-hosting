export default async function handler(req, res) {
  // Read backend API URL securely from Vercel server environment
  const backendBase = (
    process.env.BACKEND_API_URL ||
    process.env.BACKEND_URL ||
    'http://localhost:8080/api'
  ).replace(/\/+$/, '');

  // Extract path parts from [...path]
  const { path } = req.query;
  const targetPath = Array.isArray(path) ? path.join('/') : (path || '');

  // Preserve query parameters except the internal 'path'
  const urlObj = new URL(req.url, 'http://localhost');
  const searchParams = new URLSearchParams(urlObj.search);
  searchParams.delete('path');
  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';

  const targetUrl = `${backendBase}/${targetPath}${queryString}`;

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
