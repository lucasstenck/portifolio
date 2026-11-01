// Servidor Lastro: API REST + painel administrativo (estático) + build web do app (opcional).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startDb, stopDb } from './db.js';
import { dispatch, sendJson } from './http.js';
import './routes/auth.js';
import './routes/client.js';
import './routes/admin.js';
import { seed } from './seed.js';
import { runDailyJobs } from './services/loans.js';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..', '..');
const STATIC = [['/admin', path.join(root, 'admin-web')], ['/app', path.join(root, 'mobile', 'build', 'web')]];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.webmanifest': 'application/manifest+json' };

export async function createServer({ port = +process.env.PORT || 3300, reset = false, withSeed = true } = {}) {
  await startDb({ reset });
  if (withSeed) await seed();
  await runDailyJobs();
  const timer = setInterval(() => runDailyJobs().catch((e) => console.error('[job]', e.message)), 3600000); timer.unref();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/webhooks/')) return dispatch(req, res, url);
    if (url.pathname === '/health') return sendJson(res, 200, { ok: true, service: 'lastro-api' });
    for (const [prefix, dir] of STATIC) {
      if (url.pathname === prefix || url.pathname.startsWith(prefix + '/')) {
        let rel = decodeURIComponent(url.pathname.slice(prefix.length)) || '/'; if (rel.endsWith('/')) rel += 'index.html';
        let file = path.normalize(path.join(dir, rel)); if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
        if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html');
        if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Não encontrado'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' }); return fs.createReadStream(file).pipe(res);
      }
    }
    if (url.pathname === '/') { res.writeHead(302, { Location: '/admin/' }); return res.end(); }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Não encontrado');
  });
  await new Promise((r) => server.listen(port, r));
  return { server, port, close: async () => { await new Promise((r) => server.close(r)); await stopDb(); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await createServer({ reset: process.argv.includes('--reset') });
  console.log(`Lastro API em http://localhost:${s.port}  •  painel: /admin  •  app web: /app`);
  const stop = async () => { await s.close(); process.exit(0); }; process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
