// Local preview only. Resolve real paths so neither traversal nor symlinks escape docs.
import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = await realpath(fileURLToPath(new URL('../docs/', import.meta.url)));
const port = Number(process.env.PORT || '4174');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
};
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  try {
    const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = await realpath(path.resolve(root, '.' + (route === '/' ? '/index.html' : route)));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const body = await readFile(file);
    const type = types[path.extname(file)] || 'application/octet-stream';
    const etag = '"' + createHash('sha256').update(body).digest('hex').slice(0, 16) + '"';
    const immutable = /\.[0-9a-f]{12}\.(?:json|mjs|css|webp)$/.test(file);
    const headers = {
      'Content-Type':
        type + (type.startsWith('text/') || type === 'application/json' ? '; charset=utf-8' : ''),
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(self)',
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/`));
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => server.close(() => process.exit(0)));
