// Servidor do site Vasconcelos Torres Advocacia Trabalhista — sem dependências (Node 18+).
// API: agendamentos, triagem de casos (protocolo), blog e painel administrativo.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, 'public');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = +process.env.PORT || 3202;
fs.mkdirSync(DATA, { recursive: true });
const F = (n) => path.join(DATA, n + '.json');
for (const n of ['appointments', 'cases']) if (!fs.existsSync(F(n))) fs.writeFileSync(F(n), '[]');
if (!fs.existsSync(F('posts'))) fs.copyFileSync(path.join(ROOT, 'seed-posts.json'), F('posts'));
const TOKEN_FILE = path.join(DATA, 'admin-token.txt');
if (!fs.existsSync(TOKEN_FILE)) fs.writeFileSync(TOKEN_FILE, process.env.ADMIN_TOKEN || crypto.randomBytes(9).toString('base64url'));
const TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();

const rd = (n) => JSON.parse(fs.readFileSync(F(n), 'utf8'));
const wr = (n, a) => { fs.writeFileSync(F(n) + '.tmp', JSON.stringify(a, null, 1)); fs.renameSync(F(n) + '.tmp', F(n)); };
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon' };
const CASE_STATUS = ['Recebido', 'Em análise', 'Contato realizado', 'Documentos solicitados', 'Proposta enviada', 'Contratado', 'Encerrado'];
const hits = new Map();

const send = (res, code, b, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type === 'application/json' ? type : type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(typeof b === 'string' ? b : JSON.stringify(b)); };
const body = (req) => new Promise((ok, no) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 60000) { no(new Error('grande')); req.destroy(); } }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch (e) { no(e); } }); });
const clean = (s, n = 200) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const authed = (req, url) => (req.headers.authorization || '') === 'Bearer ' + TOKEN || url.searchParams.get('token') === TOKEN;
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

function limited(req, key, max, win = 600000) {
  const k = key + (req.socket.remoteAddress || '?'), now = Date.now(), h = (hits.get(k) || []).filter((t) => now - t < win);
  if (h.length >= max && !process.env.NO_RATE_LIMIT) return true;
  h.push(now); hits.set(k, h); return false;
}
function personErr(b) {
  const err = {}, name = clean(b.name, 80), email = clean(b.email, 120).toLowerCase(), phone = digits(b.phone);
  if (name.split(/\s+/).filter(Boolean).length < 2) err.name = 'Informe nome e sobrenome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) err.email = 'E-mail inválido.';
  if (!(phone.length === 10 || phone.length === 11) || /^(\d)\1+$/.test(phone)) err.phone = 'Informe o telefone com DDD.';
  if (!b.consent) err.consent = 'Aceite a política de privacidade.';
  return { err, name, email, phone };
}
const isWorkday = (d) => { const x = new Date(d + 'T12:00:00'); return x.getDay() >= 1 && x.getDay() <= 5; };
const taken = (date) => rd('appointments').filter((a) => a.date === date && a.status !== 'cancelado').map((a) => a.time);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  try {
    if (req.method === 'GET' && p === '/api/posts') return send(res, 200, rd('posts').filter((x) => x.published).sort((a, b) => b.date.localeCompare(a.date)).map(({ body, ...r }) => r));
    let m;
    if (req.method === 'GET' && (m = p.match(/^\/api\/posts\/([\w-]+)$/))) { const x = rd('posts').find((q) => q.slug === m[1] && q.published); return x ? send(res, 200, x) : send(res, 404, { error: 'Artigo não encontrado' }); }
    if (req.method === 'GET' && p === '/api/slots') {
      const d = url.searchParams.get('date') || '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !isWorkday(d)) return send(res, 200, { date: d, slots: [] });
      const t = taken(d), now = new Date(), today = now.toISOString().slice(0, 10), nowH = now.getHours() + 1;
      return send(res, 200, { date: d, slots: SLOTS.map((s) => ({ time: s, free: !t.includes(s) && !(d < today || (d === today && +s.slice(0, 2) <= nowH)) })) });
    }
    if (req.method === 'POST' && p === '/api/appointments') {
      if (limited(req, 'ap', 6)) return send(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
      const b = await body(req), { err, name, email, phone } = personErr(b), date = clean(b.date, 10), time = clean(b.time, 5), mode = b.mode === 'online' ? 'online' : 'presencial';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isWorkday(date)) err.date = 'Escolha um dia útil.';
      if (!SLOTS.includes(time)) err.time = 'Escolha um horário.';
      if (Object.keys(err).length) return send(res, 422, { errors: err });
      if (new Date(date + 'T' + time + ':00') < new Date()) return send(res, 422, { errors: { time: 'Esse horário já passou.' } });
      const all = rd('appointments');
      if (all.some((a) => a.date === date && a.time === time && a.status !== 'cancelado')) return send(res, 409, { error: 'Esse horário acabou de ser reservado. Escolha outro.' });
      const a = { id: 'A' + String(all.length + 1).padStart(4, '0'), createdAt: new Date().toISOString(), name, email, phone, date, time, mode, subject: clean(b.subject, 60), status: 'agendado' };
      all.push(a); wr('appointments', all); return send(res, 201, a);
    }
    if (req.method === 'POST' && p === '/api/cases') {
      if (limited(req, 'cs', 5)) return send(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
      const b = await body(req), { err, name, email, phone } = personErr(b), story = clean(b.story, 1500);
      if (story.length < 20) err.story = 'Conte um pouco mais sobre o que aconteceu (mín. 20 caracteres).';
      if (Object.keys(err).length) return send(res, 422, { errors: err });
      const all = rd('cases'), id = 'T' + new Date().getFullYear() + String(all.length + 1).padStart(4, '0');
      const c = { id, createdAt: new Date().toISOString(), name, email, phone, area: clean(b.area, 60), employer: clean(b.employer, 80), end: clean(b.end, 40), story, status: 'Recebido', history: [{ at: new Date().toISOString(), status: 'Recebido', note: 'Caso recebido pelo site.' }], notes: '' };
      all.push(c); wr('cases', all); return send(res, 201, { id, status: c.status });
    }
    if (req.method === 'GET' && (m = p.match(/^\/api\/cases\/(T\d+)$/))) {
      if (limited(req, 'lk', 20)) return send(res, 429, { error: 'Muitas consultas. Aguarde.' });
      const c = rd('cases').find((x) => x.id === m[1]), last4 = digits(url.searchParams.get('phone')).slice(-4);
      if (!c || !last4 || digits(c.phone).slice(-4) !== last4) return send(res, 404, { error: 'Protocolo não encontrado. Confira o número e os 4 últimos dígitos do telefone.' });
      return send(res, 200, { id: c.id, status: c.status, area: c.area, createdAt: c.createdAt, history: c.history.map(({ at, status, note }) => ({ at, status, note })) });
    }
    if (p.startsWith('/api/admin/')) {
      if (!authed(req, url)) return send(res, 401, { error: 'Não autorizado' });
      if (req.method === 'GET' && p === '/api/admin/overview') return send(res, 200, { appointments: rd('appointments'), cases: rd('cases').reverse(), posts: rd('posts'), statuses: CASE_STATUS });
      if (req.method === 'PATCH' && (m = p.match(/^\/api\/admin\/appointments\/(A\d+)$/))) { const b = await body(req), all = rd('appointments'), a = all.find((x) => x.id === m[1]); if (!a) return send(res, 404, {}); if (['agendado', 'confirmado', 'realizado', 'cancelado', 'faltou'].includes(b.status)) a.status = b.status; wr('appointments', all); return send(res, 200, a); }
      if (req.method === 'PATCH' && (m = p.match(/^\/api\/admin\/cases\/(T\d+)$/))) { const b = await body(req), all = rd('cases'), c = all.find((x) => x.id === m[1]); if (!c) return send(res, 404, {}); if (CASE_STATUS.includes(b.status) && b.status !== c.status) { c.status = b.status; c.history.push({ at: new Date().toISOString(), status: b.status, note: clean(b.note, 200) || '' }); } if (typeof b.notes === 'string') c.notes = clean(b.notes, 800); wr('cases', all); return send(res, 200, c); }
      if (req.method === 'POST' && p === '/api/admin/posts') { const b = await body(req), all = rd('posts'); const title = clean(b.title, 120); if (title.length < 5 || clean(b.body, 20000).length < 40) return send(res, 422, { error: 'Título e texto são obrigatórios.' }); let slug = slugify(title); while (all.some((x) => x.slug === slug)) slug += '-2'; const x = { slug, title, excerpt: clean(b.excerpt, 240), category: clean(b.category, 40) || 'Direito do Trabalho', date: new Date().toISOString().slice(0, 10), author: clean(b.author, 60) || 'Equipe Vasconcelos Torres', readMin: Math.max(2, Math.round(b.body.split(/\s+/).length / 200)), body: clean(b.body, 20000), published: b.published !== false }; all.push(x); wr('posts', all); return send(res, 201, x); }
      if (req.method === 'PATCH' && (m = p.match(/^\/api\/admin\/posts\/([\w-]+)$/))) { const b = await body(req), all = rd('posts'), x = all.find((q) => q.slug === m[1]); if (!x) return send(res, 404, {}); for (const k of ['title', 'excerpt', 'category', 'body']) if (typeof b[k] === 'string') x[k] = clean(b[k], k === 'body' ? 20000 : 240); if (typeof b.published === 'boolean') x.published = b.published; wr('posts', all); return send(res, 200, x); }
      if (req.method === 'DELETE' && (m = p.match(/^\/api\/admin\/posts\/([\w-]+)$/))) { wr('posts', rd('posts').filter((q) => q.slug !== m[1])); return send(res, 200, { ok: true }); }
      return send(res, 404, { error: 'Rota inexistente' });
    }
    let f = decodeURIComponent(p); if (f === '/') f = '/index.html'; if (f === '/admin') f = '/admin.html'; if (f === '/artigos') f = '/artigos.html';
    const file = path.normalize(path.join(PUB, f));
    if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, '<h1>404</h1><p>Página não encontrada.</p><a href="/">Voltar</a>', 'text/html; charset=utf-8');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) { send(res, 400, { error: 'Requisição inválida' }); }
});
server.listen(PORT, () => { console.log(`Vasconcelos Torres em http://localhost:${PORT}`); console.log(`Painel: http://localhost:${PORT}/admin  (token em data/admin-token.txt)`); });
