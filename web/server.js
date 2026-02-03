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
const PORT = process.env.PORT || 3380;

// Optional: proxy to logging service for stats (internal URL from env)
const LOGGING_SERVICE_URL = process.env.LOGGING_SERVICE_URL || '';
const AUTH_BACKEND_URL = process.env.AUTH_BACKEND_URL || 'http://auth-microservice:3370';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

/**
 * Proxy /auth to backend (for local dev without nginx; on prod nginx routes /auth to backend)
 */
app.all('/auth/*', (req, res) => {
  const fullUrl = AUTH_BACKEND_URL.replace(/\/$/, '') + req.url;
  const client = fullUrl.startsWith('https') ? https : http;
  const proxy = client.request(fullUrl, { method: req.method, headers: req.headers }, (upstream) => {
    res.status(upstream.statusCode);
    Object.keys(upstream.headers).forEach((k) => res.setHeader(k, upstream.headers[k]));
    upstream.pipe(res);
  });
  proxy.on('error', (e) => res.status(502).json({ message: e.message }));
  req.pipe(proxy);
});

/**
 * Health for frontend container (nginx health check)
 */
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, status: 'ok', service: 'auth-microservice-web' });
});

/**
 * Proxy stats from logging service (auth-related logs)
 * Only if LOGGING_SERVICE_URL is set; otherwise return empty/placeholder.
 */
app.get('/api/stats', async (req, res) => {
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
 */
app.get('/api/health-backend', async (req, res) => {
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`auth-microservice-web listening on port ${PORT}`);
});
