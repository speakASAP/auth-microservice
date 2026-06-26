/**
 * Auth Microservice Web - Express server
 * Serves landing, admin panel, and proxies /api/stats to logging service.
 * Auth API (/auth) is served by nginx -> backend; same-origin from browser.
 */
const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3372;

// Optional: proxy to logging service for stats (internal URL from env)
const LOGGING_SERVICE_URL = process.env.LOGGING_SERVICE_URL || '';
const AUTH_BACKEND_URL = process.env.AUTH_BACKEND_URL || 'http://auth-microservice:3370';
const PROXY_AUTH_TIMEOUT_MS = parseInt(process.env.PROXY_AUTH_TIMEOUT_MS || '30000', 10);

// Parse backend host from AUTH_BACKEND_URL for Host header (backend may require it)
function getBackendHost() {
  try {
    const u = new URL(AUTH_BACKEND_URL);
    return u.hostname + (u.port ? ':' + u.port : '');
  } catch {
    return 'localhost:3370';
  }
}
const BACKEND_HOST = getBackendHost();

/**
 * Proxy /auth to backend. Buffer full request body then send so backend receives
 * complete request (avoids ECONNRESET when streaming body from nginx).
 * Must be before express.json() so body is not consumed by other middleware.
 */
app.use('/auth', (req, res) => {
  const pathSuffix = req.url === '/' || req.url === '' ? '' : req.url;
  const fullUrl = AUTH_BACKEND_URL.replace(/\/$/, '') + '/auth' + pathSuffix;
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const client = fullUrl.startsWith('https') ? https : http;
    const headers = { ...req.headers, host: BACKEND_HOST };
    if (body.length > 0 && !headers['content-length']) headers['content-length'] = body.length;
    const proxy = client.request(fullUrl, { method: req.method, headers }, (upstream) => {
      if (res.headersSent) return;
      res.status(upstream.statusCode);
      Object.keys(upstream.headers).forEach((k) => res.setHeader(k, upstream.headers[k]));
      upstream.pipe(res);
    });
    proxy.setTimeout(PROXY_AUTH_TIMEOUT_MS, () => {
      proxy.destroy();
      if (!res.headersSent) res.status(502).json({ message: 'Backend timeout' });
    });
    proxy.on('error', (e) => {
      console.error('[auth proxy]', e.code || e.message, fullUrl);
      if (!res.headersSent) res.status(502).json({ message: e.message });
    });
    proxy.end(body);
  });
  req.on('error', (e) => {
    console.error('[auth proxy] request error', e.message);
    if (!res.headersSent) res.status(502).json({ message: e.message });
  });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

/**
 * Health for frontend container (nginx health check)
 */
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, status: 'ok', service: 'auth-microservice-web' });
});

/**
 * Proxy stats from logging service (auth-related logs)
 * Only if LOGGING_SERVICE_URL is set; otherwise return empty/placeholder.
 * Exposed on both /api/stats (for local/dev) and /admin-api/stats (for admin UI behind nginx).
 */
app.get(['/api/stats', '/admin-api/stats'], async (req, res) => {
  if (!LOGGING_SERVICE_URL) {
    return res.json({
      success: true,
      source: 'none',
      message: 'LOGGING_SERVICE_URL not configured',
      data: [],
      count: 0
    });
  }
  try {
    const service = (req.query.service || 'auth-microservice').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const level = (req.query.level || '').trim();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    let url = `${LOGGING_SERVICE_URL.replace(/\/$/, '')}/api/logs/query?service=${encodeURIComponent(service)}&limit=${limit}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
    if (level) url += `&level=${encodeURIComponent(level)}`;
    const client = url.startsWith('https') ? https : http;
    const data = await new Promise((resolve, reject) => {
      const req = client.get(url, (resp) => {
        let body = '';
        resp.on('data', (ch) => (body += ch));
        resp.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(8000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    });
    res.json({ success: true, source: 'logging', ...data });
  } catch (err) {
    res.status(502).json({
      success: false,
      message: err.message || 'Failed to fetch logs',
      data: [],
      count: 0
    });
  }
});

/**
 * Proxy health from auth backend (for admin dashboard)
 * Exposed on both /api/health-backend (for local/dev) and /admin-api/health-backend (for admin UI behind nginx).
 */
app.get(['/api/health-backend', '/admin-api/health-backend'], async (req, res) => {
  try {
    const url = `${AUTH_BACKEND_URL.replace(/\/$/, '')}/health`;
    const client = url.startsWith('https') ? https : http;
    const data = await new Promise((resolve, reject) => {
      const r = client.get(url, (resp) => {
        let body = '';
        resp.on('data', (ch) => (body += ch));
        resp.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      });
      r.on('error', reject);
      r.setTimeout(5000, () => {
        r.destroy();
        reject(new Error('Timeout'));
      });
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({
      success: false,
      status: 'error',
      message: err.message || 'Backend unreachable'
    });
  }
});

// SPA fallback: /admin and other routes serve index then client router
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get(['/login', '/register', '/reset-password'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`auth-microservice-web listening on port ${PORT}`);
});
