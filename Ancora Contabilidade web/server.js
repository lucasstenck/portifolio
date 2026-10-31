// Servidor da landing page Âncora Contabilidade — sem dependências (Node 18+).
// Captura leads em data/leads.json e oferece painel administrativo protegido por token.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, 'public');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = +process.env.PORT || 3201;
fs.mkdirSync(DATA, { recursive: true });
const LEADS = path.join(DATA, 'leads.json');
const TOKEN_FILE = path.join(DATA, 'admin-token.txt');
if (!fs.existsSync(LEADS)) fs.writeFileSync(LEADS, '[]');
if (!fs.existsSync(TOKEN_FILE)) fs.writeFileSync(TOKEN_FILE, process.env.ADMIN_TOKEN || crypto.randomBytes(9).toString('base64url'));
const TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();

const read = () => JSON.parse(fs.readFileSync(LEADS, 'utf8'));
const write = (a) => { fs.writeFileSync(LEADS + '.tmp', JSON.stringify(a, null, 1)); fs.renameSync(LEADS + '.tmp', LEADS); };
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.webp': 'image/webp' };
const STATUS = ['novo', 'contatado', 'proposta', 'fechado', 'perdido'];
const hits = new Map(); // limite simples: 5 envios / 10 min por IP

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type.includes('/') ? type : MIME[type] || type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function body(req) {
  return new Promise((ok, no) => {
    let d = ''; req.on('data', (c) => { d += c; if (d.length > 20000) { no(new Error('grande')); req.destroy(); } });
    req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch (e) { no(e); } });
  });
}
const clean = (s, n = 200) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const authed = (req, url) => (req.headers.authorization || '') === 'Bearer ' + TOKEN || url.searchParams.get('token') === TOKEN;

function validate(b) {
  const err = {};
  const name = clean(b.name, 80), email = clean(b.email, 120).toLowerCase(), phone = digits(b.phone);
  if (name.split(/\s+/).filter(Boolean).length < 2 || name.length < 5) err.name = 'Informe seu nome completo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) err.email = 'E-mail inválido.';
  if (!(phone.length === 10 || phone.length === 11) || /^(\d)\1+$/.test(phone) || !/^[1-9]{2}/.test(phone)) err.phone = 'Informe um telefone com DDD.';
  if (!b.consent) err.consent = 'É necessário aceitar a política de privacidade.';
  return { err, v: { name, email, phone, company: clean(b.company, 80), type: clean(b.type, 40), revenue: clean(b.revenue, 40), service: clean(b.service, 60), message: clean(b.message, 500), source: clean(b.source, 60) } };
}

const csv = (rows) => '﻿' + ['id;data;nome;telefone;email;empresa;tipo;faturamento;servico;status;mensagem;origem', ...rows.map((l) => [l.id, l.createdAt, l.name, l.phone, l.email, l.company, l.type, l.revenue, l.service, l.status, l.message, l.source].map((x) => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(';'))].join('\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'POST' && url.pathname === '/api/leads') {
      const ip = req.socket.remoteAddress || '?', now = Date.now();
      const h = (hits.get(ip) || []).filter((t) => now - t < 600000);
      if (h.length >= 5 && !process.env.NO_RATE_LIMIT) return send(res, 429, { error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
      const { err, v } = validate(await body(req));
      if (Object.keys(err).length) return send(res, 422, { errors: err });
      const all = read();
      const dup = all.find((l) => l.phone === v.phone && now - Date.parse(l.createdAt) < 86400000);
      if (dup) return send(res, 200, { ok: true, id: dup.id, duplicate: true });
      h.push(now); hits.set(ip, h);
      const lead = { id: 'L' + String(all.length + 1).padStart(4, '0'), createdAt: new Date().toISOString(), ...v, status: 'novo', notes: '' };
      all.push(lead); write(all);
      console.log('Novo lead:', lead.id, lead.name, lead.service);
      return send(res, 201, { ok: true, id: lead.id });
    }
    if (url.pathname.startsWith('/api/admin/')) {
      if (!authed(req, url)) return send(res, 401, { error: 'Não autorizado' });
      if (req.method === 'GET' && url.pathname === '/api/admin/leads') return send(res, 200, read().reverse());
      if (req.method === 'GET' && url.pathname === '/api/admin/export.csv') return send(res, 200, csv(read()), 'text/csv; charset=utf-8');
      const m = url.pathname.match(/^\/api\/admin\/leads\/(L\d+)$/);
      if (m && req.method === 'PATCH') {
        const b = await body(req), all = read(), l = all.find((x) => x.id === m[1]);
        if (!l) return send(res, 404, { error: 'Lead não encontrado' });
        if (b.status && STATUS.includes(b.status)) l.status = b.status;
        if (typeof b.notes === 'string') l.notes = clean(b.notes, 600);
        write(all); return send(res, 200, l);
      }
      return send(res, 404, { error: 'Rota inexistente' });
    }
    // estáticos
    let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html'; if (p === '/admin') p = '/admin.html';
    const file = path.normalize(path.join(PUB, p));
    if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, '<h1>404</h1><p>Página não encontrada.</p><a href="/">Voltar</a>', 'text/html; charset=utf-8');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) { send(res, 400, { error: 'Requisição inválida' }); }
});
server.listen(PORT, () => { console.log(`Âncora Contabilidade em http://localhost:${PORT}`); console.log(`Painel: http://localhost:${PORT}/admin  (token em data/admin-token.txt)`); });
