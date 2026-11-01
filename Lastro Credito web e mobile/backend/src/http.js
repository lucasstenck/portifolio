// Mini framework HTTP: roteamento, validação de entrada, autenticação por Bearer JWT, perfis, limite de taxa, CORS e auditoria.
import { verifyJwt } from './lib/crypto.js';
import { one, q } from './db.js';

export class HttpError extends Error { constructor(status, message, extra = {}) { super(message); this.status = status; Object.assign(this, extra); } }
export const fail = (status, message, extra) => new HttpError(status, message, extra);

const hits = new Map();
export function rateLimit(key, max, windowMs) {
  if (process.env.NO_RATE_LIMIT) return false;
  const now = Date.now(), h = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (h.length >= max) { hits.set(key, h); return true; } h.push(now); hits.set(key, h); return false;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 3600000)) hits.delete(k); }, 600000).unref();

export const clean = (s, n = 200) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
export const digits = (s) => String(s ?? '').replace(/\D/g, '');
export const num = (v, def = 0) => { const n = Number(v); return Number.isFinite(n) ? n : def; };
export const need = (cond, msg, fields) => { if (!cond) throw fail(422, msg, fields ? { errors: fields } : {}); };

const routes = [];
export const route = (method, pattern, opts, handler) => {
  if (typeof opts === 'function') { handler = opts; opts = {}; }
  const keys = []; const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, opts, handler, pattern });
};

export async function audit(ctx, action, entity = null, entityId = null, detail = null) {
  await q(`INSERT INTO audit_log (user_id, user_name, role, action, entity, entity_id, detail, ip) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [ctx.user?.id || null, ctx.user?.name || null, ctx.user?.role || null, action, entity, entityId == null ? null : String(entityId), detail ? JSON.stringify(detail) : null, ctx.ip]);
}

const readBody = (req, limit = 12_000_000) => new Promise((ok, no) => {
  const chunks = []; let size = 0;
  req.on('data', (c) => { size += c.length; if (size > limit) { no(fail(413, 'Corpo da requisição muito grande.')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { if (!size) return ok({ body: {}, raw: '' }); const raw = Buffer.concat(chunks).toString('utf8'); try { ok({ body: JSON.parse(raw), raw }); } catch { no(fail(400, 'JSON inválido.')); } });
});

const SEC = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-site', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' };
export const sendJson = (res, status, data, extra = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC, ...extra }); res.end(JSON.stringify(data)); };

export async function dispatch(req, res, url) {
  const origin = process.env.ALLOWED_ORIGINS || '*';
  const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Vary': 'Origin' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
  if (!r) return sendJson(res, 404, { error: 'Rota inexistente.' }, cors);
  const m = url.pathname.match(r.re), params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  const ctx = { req, res, params, query: url.searchParams, ip, user: null, device: String(req.headers['user-agent'] || '').slice(0, 120), send: (s, d, h) => sendJson(res, s, d, { ...cors, ...h }), raw: '' };
  try {
    if (rateLimit(`ip:${ip}`, 600, 60000)) throw fail(429, 'Muitas requisições. Tente novamente em instantes.');
    if (r.opts.limit && rateLimit(`${r.pattern}:${ip}`, r.opts.limit[0], r.opts.limit[1])) throw fail(429, 'Muitas tentativas. Aguarde antes de tentar novamente.');
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) { const { body, raw } = await readBody(req, r.opts.bodyLimit); ctx.body = body; ctx.raw = raw; } else ctx.body = {};
    if (r.opts.auth !== 'public') {
      const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''), p = verifyJwt(tok);
      if (!p || p.typ !== 'access') throw fail(401, 'Sessão expirada. Faça login novamente.', { code: 'AUTH' });
      const s = await one(`SELECT s.id, s.revoked_at, s.expires_at FROM sessions s WHERE s.id=$1`, [p.sid]);
      if (!s || s.revoked_at || new Date(s.expires_at) < new Date()) throw fail(401, 'Sessão encerrada. Faça login novamente.', { code: 'AUTH' });
      const u = await one(`SELECT id, role, name, email, phone, phone_verified_at, totp_enabled, disabled FROM users WHERE id=$1`, [p.uid]);
      if (!u || u.disabled) throw fail(403, 'Conta desativada.');
      ctx.user = u; ctx.sid = p.sid;
      const roles = r.opts.auth; if (Array.isArray(roles) && !roles.includes(u.role)) throw fail(403, 'Seu perfil não tem permissão para esta ação.');
    }
    const out = await r.handler(ctx);
    if (out === undefined) return;                       // handler respondeu diretamente
    return sendJson(res, out?._status || 200, out?._body ?? out, cors);
  } catch (e) {
    if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message, ...(e.errors ? { errors: e.errors } : {}), ...(e.code ? { code: e.code } : {}) }, cors);
    console.error('[erro]', req.method, url.pathname, e.message || e.code || e); return sendJson(res, 500, { error: 'Erro interno. Tente novamente.' }, cors);
  }
}
export const created = (body) => ({ _status: 201, _body: body });
export const money = (v) => Math.round(Number(v) * 100) / 100;
