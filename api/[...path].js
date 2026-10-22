import { Readable } from 'stream';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: false,
  },
  maxDuration: 60,
};

export default async function handler(req, res) {
  // Normalize backend base URL
  let backendBase = (
    process.env.BACKEND_API_URL ||
    process.env.BACKEND_URL ||
    'http://20.48.16.226:8080'
  ).replace(/\/+$/, '');

  if (!backendBase.endsWith('/api')) {
    backendBase = `${backendBase}/api`;
  }

  // Parse relative subpath directly from req.url
  const urlObj = new URL(req.url, 'http://localhost');
  const subPath = urlObj.pathname.replace(/^\/api\/?/, '').replace(/^\[\.\.\.path\]\/?/, '');
  const search = urlObj.search || '';

  const targetUrl = `${backendBase}/${subPath}${search}`;

  try {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (!['host', 'connection', 'content-length', 'content-encoding', 'transfer-encoding'].includes(lower)) {
        headers[key] = value;
      }
    }
    headers['x-forwarded-host'] = req.headers.host || '';

    const options = {
      method: req.method,
      headers,
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body) {
      options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!headers['content-type']) {
        headers['content-type'] = 'application/json';
      }
    }

    const response = await fetch(targetUrl, options);

    res.status(response.status);
    response.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lower)) {
        res.setHeader(key, val);
      }
    });

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body);
      return nodeStream.pipe(res);
    } else {
      return res.end();
    }
  } catch (error) {
    console.error('Vercel API Proxy Error:', error);
    return res.status(502).json({
      error: 'Backend API unreachable via proxy',
      message: error.message,
    });
  }
}
