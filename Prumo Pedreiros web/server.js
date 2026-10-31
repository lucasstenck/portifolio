// Prumo — intermediação de serviços de pedreiros. Servidor sem dependências (Node 18+).
// Fluxo real: cliente pede orçamento → profissionais compatíveis recebem → enviam propostas → cliente compara e contrata.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, 'public');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = +process.env.PORT || 3204;
fs.mkdirSync(DATA, { recursive: true });
const F = (n) => path.join(DATA, n + '.json');
if (!fs.existsSync(F('pros'))) fs.copyFileSync(path.join(ROOT, 'seed-pros.json'), F('pros'));
for (const n of ['requests', 'applications']) if (!fs.existsSync(F(n))) fs.writeFileSync(F(n), '[]');
const rd = (n) => JSON.parse(fs.readFileSync(F(n), 'utf8'));
const wr = (n, a) => { fs.writeFileSync(F(n) + '.tmp', JSON.stringify(a, null, 1)); fs.renameSync(F(n) + '.tmp', F(n)); };
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
const TYPES = ['Alvenaria', 'Reboco e acabamento', 'Piso e revestimento', 'Reforma de banheiro', 'Reforma de cozinha', 'Laje e fundação', 'Muro e calçada', 'Pequenos reparos'];
const sessions = new Map(); const hits = new Map();
const send = (res, c, b) => { res.writeHead(c, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(b)); };
const body = (req) => new Promise((ok, no) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 40000) { no(new Error('grande')); req.destroy(); } }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch (e) { no(e); } }); });
const clean = (s, n = 200) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const limited = (req, k, max) => { const key = k + (req.socket.remoteAddress || ''), now = Date.now(), h = (hits.get(key) || []).filter((t) => now - t < 600000); if (h.length >= max && !process.env.NO_RATE_LIMIT) return true; h.push(now); hits.set(key, h); return false; };
const pubPro = ({ pin, phone, email, ...p }) => p;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  try {
    let m;
    if (req.method === 'GET' && p === '/api/pros') {
      const svc = url.searchParams.get('svc'), city = url.searchParams.get('city'), min = +url.searchParams.get('min') || 0;
      return send(res, 200, rd('pros').filter((x) => (!svc || x.services.includes(svc)) && (!city || x.city === city) && x.rating >= min).sort((a, b) => b.rating * Math.log(b.jobs + 2) - a.rating * Math.log(a.jobs + 2)).map(pubPro));
    }
    if (req.method === 'GET' && (m = p.match(/^\/api\/pros\/(\d+)$/))) { const x = rd('pros').find((q) => q.id === +m[1]); return x ? send(res, 200, pubPro(x)) : send(res, 404, { error: 'Profissional não encontrado' }); }
    if (req.method === 'GET' && p === '/api/meta') return send(res, 200, { types: TYPES, cities: [...new Set(rd('pros').map((x) => x.city))] });
    if (req.method === 'POST' && p === '/api/requests') {
      if (limited(req, 'rq', 8)) return send(res, 429, { error: 'Muitas solicitações. Aguarde alguns minutos.' });
      const b = await body(req), err = {}, name = clean(b.name, 80), phone = digits(b.phone), area = parseFloat(b.area) || 0;
      if (name.split(/\s+/).filter(Boolean).length < 2) err.name = 'Informe nome e sobrenome.';
      if (!(phone.length === 10 || phone.length === 11)) err.phone = 'Informe o telefone com DDD.';
      if (!TYPES.includes(b.tipo)) err.tipo = 'Escolha o tipo de serviço.';
      if (!rd('pros').some((x) => x.city === b.city)) err.city = 'Escolha uma cidade atendida.';
      if (clean(b.detalhes, 800).length < 15) err.detalhes = 'Descreva um pouco mais o serviço (mín. 15 caracteres).';
      if (!b.consent) err.consent = 'Aceite os termos para continuar.';
      if (Object.keys(err).length) return send(res, 422, { errors: err });
      const all = rd('requests'), id = 'P-' + String(all.length + 1).padStart(4, '0');
      const r = { id, createdAt: Date.now(), name, phone, email: clean(b.email, 100), city: b.city, bairro: clean(b.bairro, 60), tipo: b.tipo, area, detalhes: clean(b.detalhes, 800), prazo: clean(b.prazo, 40), material: clean(b.material, 40), status: 'aberto', propostas: [], contratada: null };
      all.push(r); wr('requests', all);
      return send(res, 201, { id, notified: rd('pros').filter((x) => x.city === r.city && x.services.includes(r.tipo)).length });
    }
    if (req.method === 'GET' && (m = p.match(/^\/api\/requests\/(P-\d+)$/))) {
      if (limited(req, 'lk', 30)) return send(res, 429, { error: 'Muitas consultas.' });
      const r = rd('requests').find((x) => x.id === m[1]), last = digits(url.searchParams.get('phone')).slice(-4);
      if (!r || !last || r.phone.slice(-4) !== last) return send(res, 404, { error: 'Pedido não encontrado. Confira o código e os 4 últimos dígitos do telefone.' });
      const pros = rd('pros'); const { phone, email, ...pub } = r;
      return send(res, 200, { ...pub, propostas: r.propostas.map((q) => ({ ...q, pro: pubPro(pros.find((x) => x.id === q.proId)) })), notified: pros.filter((x) => x.city === r.city && x.services.includes(r.tipo)).length });
    }
    if (req.method === 'POST' && (m = p.match(/^\/api\/requests\/(P-\d+)\/accept$/))) {
      const b = await body(req), all = rd('requests'), r = all.find((x) => x.id === m[1]);
      if (!r || r.phone.slice(-4) !== digits(b.phone).slice(-4)) return send(res, 404, { error: 'Pedido não encontrado.' });
      const q = r.propostas.find((x) => x.id === b.propostaId); if (!q) return send(res, 404, { error: 'Proposta não encontrada.' });
      if (r.status !== 'aberto') return send(res, 409, { error: 'Este pedido já foi contratado.' });
      r.status = 'contratado'; r.contratada = q.id; q.aceita = true; wr('requests', all); return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && p === '/api/pros/apply') {
      if (limited(req, 'ap', 5)) return send(res, 429, { error: 'Muitas tentativas.' });
      const b = await body(req), err = {}; if (clean(b.name).split(/\s+/).length < 2) err.name = 'Informe nome e sobrenome.'; if (!(digits(b.phone).length >= 10)) err.phone = 'Informe o telefone com DDD.'; if (!clean(b.city)) err.city = 'Informe a cidade.'; if (!Array.isArray(b.services) || !b.services.length) err.services = 'Escolha ao menos um serviço.'; if (!b.consent) err.consent = 'Aceite os termos.';
      if (Object.keys(err).length) return send(res, 422, { errors: err });
      const all = rd('applications'), a = { id: 'C-' + String(all.length + 1).padStart(4, '0'), at: Date.now(), name: clean(b.name), phone: digits(b.phone), city: clean(b.city), years: +b.years || 0, services: b.services.filter((s) => TYPES.includes(s)), status: 'em análise' }; all.push(a); wr('applications', all); return send(res, 201, { id: a.id });
    }
    /* painel do profissional */
    if (req.method === 'POST' && p === '/api/pro/login') { const b = await body(req), x = rd('pros').find((q) => q.id === +b.id); if (!x || x.pin !== String(b.pin)) return send(res, 401, { error: 'Código ou PIN inválido.' }); const t = crypto.randomBytes(16).toString('hex'); sessions.set(t, x.id); return send(res, 200, { token: t, pro: pubPro(x) }); }
    if (p.startsWith('/api/pro/')) {
      const pid = sessions.get((req.headers.authorization || '').replace('Bearer ', '')); if (!pid) return send(res, 401, { error: 'Faça login.' });
      const me = rd('pros').find((q) => q.id === pid);
      if (req.method === 'GET' && p === '/api/pro/requests') return send(res, 200, rd('requests').filter((r) => r.city === me.city && me.services.includes(r.tipo)).map(({ phone, email, name, propostas, ...r }) => ({ ...r, client: name.split(' ')[0], total: propostas.length, minha: propostas.find((q) => q.proId === pid) || null })).reverse());
      if (req.method === 'POST' && p === '/api/pro/proposals') {
        const b = await body(req), all = rd('requests'), r = all.find((x) => x.id === b.requestId); if (!r || r.status !== 'aberto') return send(res, 409, { error: 'Pedido indisponível.' });
        if (r.propostas.some((q) => q.proId === pid)) return send(res, 409, { error: 'Você já enviou proposta.' });
        const valor = Math.round((+b.valor || 0) * 100) / 100, prazo = Math.round(+b.prazo || 0); if (!(valor > 0 && prazo > 0)) return send(res, 422, { error: 'Informe valor e prazo.' });
        r.propostas.push({ id: crypto.randomBytes(4).toString('hex'), proId: pid, valor, prazo, msg: clean(b.msg, 300), at: Date.now(), aceita: false }); wr('requests', all); return send(res, 201, { ok: true });
      }
      return send(res, 404, { error: 'Rota inexistente' });
    }
    if (p.startsWith('/api/')) return send(res, 404, { error: 'Rota inexistente' });
    let f = decodeURIComponent(p); if (f === '/') f = '/index.html';
    const file = path.normalize(path.join(PUB, f));
    if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(200, { 'Content-Type': MIME['.html'] }); return fs.createReadStream(path.join(PUB, 'index.html')).pipe(res); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(file).pipe(res);
  } catch (e) { send(res, 400, { error: 'Requisição inválida' }); }
});
server.listen(PORT, () => console.log(`Prumo em http://localhost:${PORT}  (PINs de demonstração dos profissionais em seed-pros.json)`));
