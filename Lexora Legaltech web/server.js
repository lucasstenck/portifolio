// LEXORA — plataforma jurídica (LegalTech). Servidor sem dependências (Node 20+).
// Multi-escritório com isolamento total de dados, permissões por perfil, trial de 30 dias, assinatura recorrente
// (provedor de pagamento por adaptador), IA com motor local + provedor LLM opcional e consulta ao DataJud (CNJ).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { aiSummarize, aiExtract, aiDraft, TEMPLATES } from './lib/ai.js';
import { datajudLookup } from './lib/datajud.js';
import { Billing } from './lib/billing.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, 'public');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = +process.env.PORT || 3205;
const PRICE = 9700, TRIAL_DAYS = 30, DAY = 86400000;
fs.mkdirSync(path.join(DATA, 'files'), { recursive: true });
const DBF = path.join(DATA, 'db.json');
const db = { offices: [], users: [], clients: [], cases: [], tasks: [], docs: [], fin: [], msgs: [], audit: [], outbox: [], sessions: {}, seq: {} };
if (fs.existsSync(DBF)) Object.assign(db, JSON.parse(fs.readFileSync(DBF, 'utf8')));
let dirty = null; const save = () => { if (dirty) return; dirty = setTimeout(() => { dirty = null; flush(); }, 300); };
const flush = () => { fs.writeFileSync(DBF + '.tmp', JSON.stringify(db)); fs.renameSync(DBF + '.tmp', DBF); };
const nid = (k) => (db.seq[k] = (db.seq[k] || 0) + 1);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
const clean = (s, n = 300) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(pw, salt, 32).toString('hex') });
const okPw = (pw, u) => crypto.timingSafeEqual(Buffer.from(hashPw(pw, u.pw.salt).hash, 'hex'), Buffer.from(u.pw.hash, 'hex'));
const fail = (c, m, x = {}) => Object.assign(new Error(m), { http: c, ...x });
const hits = new Map(); const rate = (k, max, win = 600000) => { const now = Date.now(), h = (hits.get(k) || []).filter((t) => now - t < win); if (h.length >= max && !process.env.NO_RATE_LIMIT) return true; h.push(now); hits.set(k, h); return false; };
const send = (res, c, b, h = {}) => { res.writeHead(c, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...h }); res.end(JSON.stringify(b)); };
const readBody = (req, max = 3_000_000) => new Promise((ok, no) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > max) { no(fail(413, 'Arquivo muito grande')); req.destroy(); } }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch (e) { no(fail(400, 'JSON inválido')); } }); });
const cookie = (req, n) => (req.headers.cookie || '').split(/;\s*/).map((c) => c.split('=')).find((c) => c[0] === n)?.[1];
const ROLES = { admin: 'Administrador', advogado: 'Advogado(a)', estagiario: 'Estagiário(a)', financeiro: 'Financeiro' };
/* matriz de permissões: recurso → perfis autorizados (leitura/escrita) */
const PERM = { clients: ['admin', 'advogado', 'estagiario', 'financeiro'], cases: ['admin', 'advogado', 'estagiario'], tasks: ['admin', 'advogado', 'estagiario'], docs: ['admin', 'advogado', 'estagiario'], fin: ['admin', 'financeiro'], msgs: ['admin', 'advogado', 'estagiario'], ai: ['admin', 'advogado', 'estagiario'], team: ['admin'], billing: ['admin'] };
const can = (u, r, write) => PERM[r].includes(u.role) && !(write && r === 'clients' && u.role === 'financeiro');
const audit = (u, action, ref = '') => { db.audit.push({ id: nid('audit'), officeId: u.officeId, userId: u.id, user: u.name, action, ref, at: Date.now() }); if (db.audit.length > 20000) db.audit.splice(0, 5000); };

const officeState = (o) => { const now = Date.now(); if (o.plan === 'cancelado') return 'cancelado'; if (o.plan === 'ativo') return o.pastDue ? 'inadimplente' : 'ativo'; return now < o.trialEndsAt ? 'trial' : 'vencido'; };
const billing = new Billing({ db, save, nid, PRICE, DAY });
setInterval(() => { billing.run(); }, 60000); billing.run();

/* ---------- CRUD genérico isolado por escritório ---------- */
const TABLES = { clients: 'clients', cases: 'cases', tasks: 'tasks', docs: 'docs', fin: 'fin', msgs: 'msgs' };
const FIELDS = {
  clients: ['nome', 'tipo', 'doc', 'email', 'telefone', 'cidade', 'obs', 'status'],
  cases: ['numero', 'clienteId', 'titulo', 'area', 'tribunal', 'vara', 'fase', 'status', 'valorCausa', 'parteContraria', 'responsavelId', 'obs'],
  tasks: ['titulo', 'tipo', 'venc', 'status', 'processoId', 'responsavelId', 'obs'],
  docs: ['nome', 'tipo', 'processoId', 'clienteId', 'texto', 'tags'],
  fin: ['tipo', 'descricao', 'valor', 'venc', 'pago', 'clienteId', 'processoId', 'categoria'],
  msgs: ['clienteId', 'processoId', 'canal', 'texto', 'status'],
};
const sanitize = (t, b) => { const o = {}; for (const k of FIELDS[t]) if (k in b) o[k] = typeof b[k] === 'number' || typeof b[k] === 'boolean' ? b[k] : k === 'texto' ? String(b[k] ?? '').slice(0, 200000) : Array.isArray(b[k]) ? b[k].map((x) => clean(x, 40)).slice(0, 12) : clean(b[k], 600); return o; };

const routes = [];
const R = (method, re, fn, opts = {}) => routes.push({ method, re, fn, opts });

/* --- autenticação --- */
const startSession = (res, u, code = 200) => { const sid = crypto.randomBytes(24).toString('hex'); db.sessions[sid] = { userId: u.id, exp: Date.now() + 12 * 3600000 }; save(); return send(res, code, { user: pubUser(u), office: pubOffice(db.offices.find((o) => o.id === u.officeId)) }, { 'Set-Cookie': `lxs=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${12 * 3600}` }); };
const pubUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, roleName: ROLES[u.role], officeId: u.officeId, oab: u.oab || '' });
const pubOffice = (o) => { const state = officeState(o); return { id: o.id, name: o.name, plan: o.plan, state, trialEndsAt: o.trialEndsAt, daysLeft: state === 'trial' ? Math.max(0, Math.ceil((o.trialEndsAt - Date.now()) / DAY)) : 0, price: PRICE, card: o.card ? { brand: o.card.brand, last4: o.card.last4, exp: o.card.exp } : null, nextCharge: o.nextCharge || null }; };
R('POST', /^\/api\/auth\/register$/, async (c) => {
  if (rate('reg' + c.ip, 6)) throw fail(429, 'Muitas tentativas. Aguarde alguns minutos.');
  const b = c.body, err = {}, email = clean(b.email, 120).toLowerCase();
  if (clean(b.escritorio, 80).length < 3) err.escritorio = 'Informe o nome do escritório.';
  if (clean(b.nome, 80).split(/\s+/).filter(Boolean).length < 2) err.nome = 'Informe nome e sobrenome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) err.email = 'E-mail inválido.';
  if (String(b.senha || '').length < 8 || !/\d/.test(b.senha) || !/[a-zA-Z]/.test(b.senha)) err.senha = 'Use ao menos 8 caracteres, com letras e números.';
  if (!b.aceite) err.aceite = 'É necessário aceitar os Termos e a Política de Privacidade (LGPD).';
  if (!err.email && db.users.some((u) => u.email === email)) err.email = 'Este e-mail já está cadastrado.';
  if (Object.keys(err).length) throw fail(422, 'Verifique os campos.', { errors: err });
  const office = { id: nid('office'), name: clean(b.escritorio, 80), createdAt: Date.now(), trialEndsAt: Date.now() + TRIAL_DAYS * DAY, plan: 'trial', card: null, invoices: [] };
  const u = { id: nid('user'), officeId: office.id, name: clean(b.nome, 80), email, role: 'admin', pw: hashPw(String(b.senha)), oab: clean(b.oab, 20), createdAt: Date.now(), consentAt: Date.now() };
  db.offices.push(office); db.users.push(u); audit(u, 'Escritório criado'); save(); return startSession(c.res, u, 201);
}, { public: true });
R('POST', /^\/api\/auth\/login$/, async (c) => {
  if (rate('login' + c.ip, 15)) throw fail(429, 'Muitas tentativas. Aguarde alguns minutos.');
  const u = db.users.find((x) => x.email === clean(c.body.email, 120).toLowerCase());
  if (!u || u.disabled || !okPw(String(c.body.senha || ''), u)) throw fail(401, 'E-mail ou senha incorretos.');
  audit(u, 'Login'); return startSession(c.res, u);
}, { public: true });
R('POST', /^\/api\/auth\/logout$/, async (c) => { const sid = cookie(c.req, 'lxs'); if (sid) delete db.sessions[sid]; save(); return send(c.res, 200, { ok: true }, { 'Set-Cookie': 'lxs=; Path=/; Max-Age=0' }); }, { public: true });
R('GET', /^\/api\/auth\/me$/, async (c) => send(c.res, 200, c.u ? { user: pubUser(c.u), office: pubOffice(c.office) } : { user: null }), { public: true });
R('POST', /^\/api\/auth\/forgot$/, async (c) => {
  if (rate('fg' + c.ip, 5)) throw fail(429, 'Muitas tentativas.');
  const u = db.users.find((x) => x.email === clean(c.body.email, 120).toLowerCase());
  if (u) { const token = crypto.randomBytes(24).toString('hex'); u.reset = { hash: crypto.createHash('sha256').update(token).digest('hex'), exp: Date.now() + 3600000 }; db.outbox.push({ id: nid('mail'), to: u.email, subject: 'Redefinição de senha — Lexora', link: `/#/redefinir?token=${token}`, at: Date.now() }); save(); }
  return send(c.res, 200, { ok: true, msg: 'Se o e-mail estiver cadastrado, enviaremos as instruções de redefinição.' });
}, { public: true });
R('POST', /^\/api\/auth\/reset$/, async (c) => {
  const h = crypto.createHash('sha256').update(String(c.body.token || '')).digest('hex'), u = db.users.find((x) => x.reset && x.reset.hash === h && x.reset.exp > Date.now());
  if (!u) throw fail(400, 'Link inválido ou expirado.');
  const s = String(c.body.senha || ''); if (s.length < 8 || !/\d/.test(s) || !/[a-zA-Z]/.test(s)) throw fail(422, 'Use ao menos 8 caracteres, com letras e números.');
  u.pw = hashPw(s); delete u.reset; for (const k of Object.keys(db.sessions)) if (db.sessions[k].userId === u.id) delete db.sessions[k]; audit(u, 'Senha redefinida'); save(); return send(c.res, 200, { ok: true });
}, { public: true });
R('GET', /^\/api\/dev\/outbox$/, async (c) => { if (process.env.NODE_ENV === 'production') throw fail(404, 'Não encontrado'); return send(c.res, 200, db.outbox.slice(-10).reverse()); }, { public: true });
R('POST', /^\/api\/dev\/trial-days$/, async (c) => { if (!process.env.ALLOW_DEV) throw fail(404, 'Não encontrado'); c.office.trialEndsAt = Date.now() + (+c.body.days) * DAY; save(); billing.run(); return send(c.res, 200, pubOffice(c.office)); });

/* --- CRUD --- */
for (const t of Object.keys(TABLES)) {
  R('GET', new RegExp(`^/api/${t}$`), async (c) => { need(c, t); return send(c.res, 200, db[t].filter((r) => r.officeId === c.u.officeId && !r.deleted).map((r) => (t === 'docs' ? { ...r, texto: undefined, resumo: (r.texto || '').slice(0, 160), temTexto: !!r.texto } : r)).reverse()); });
  R('GET', new RegExp(`^/api/${t}/(\\d+)$`), async (c) => { need(c, t); return send(c.res, 200, find(c, t, c.m[1])); });
  R('POST', new RegExp(`^/api/${t}$`), async (c) => { need(c, t, true); const r = { id: nid(t), officeId: c.u.officeId, createdAt: Date.now(), createdBy: c.u.id, ...sanitize(t, c.body) }; validate(t, r, c); db[t].push(r); audit(c.u, `Criou ${t}`, r.id); save(); return send(c.res, 201, r); });
  R('PATCH', new RegExp(`^/api/${t}/(\\d+)$`), async (c) => { need(c, t, true); const r = find(c, t, c.m[1]); Object.assign(r, sanitize(t, c.body)); r.updatedAt = Date.now(); audit(c.u, `Editou ${t}`, r.id); save(); return send(c.res, 200, r); });
  R('DELETE', new RegExp(`^/api/${t}/(\\d+)$`), async (c) => { need(c, t, true); if (c.u.role === 'estagiario') throw fail(403, 'Seu perfil não pode excluir registros.'); const r = find(c, t, c.m[1]); r.deleted = Date.now(); audit(c.u, `Excluiu ${t}`, r.id); save(); return send(c.res, 200, { ok: true }); });
}
function need(c, r, w) { if (!can(c.u, r, w)) throw fail(403, 'Seu perfil não tem permissão para esta ação.'); }
function find(c, t, id) { const r = db[t].find((x) => x.id === +id && x.officeId === c.u.officeId && !x.deleted); if (!r) throw fail(404, 'Registro não encontrado.'); return r; }
function validate(t, r, c) {
  const must = { clients: ['nome'], cases: ['titulo'], tasks: ['titulo', 'venc'], docs: ['nome'], fin: ['descricao', 'valor'], msgs: ['texto'] }[t];
  for (const k of must) if (r[k] === undefined || r[k] === '') throw fail(422, `Campo obrigatório: ${k}`);
  if (t === 'cases' && r.clienteId && !db.clients.some((x) => x.id === +r.clienteId && x.officeId === c.u.officeId)) throw fail(422, 'Cliente inválido.');
  if (t === 'cases' && r.numero) r.numero = clean(r.numero, 30);
}
R('GET', /^\/api\/cases\/(\d+)\/movements$/, async (c) => { need(c, 'cases'); return send(c.res, 200, find(c, 'cases', c.m[1]).movimentos || []); });
R('POST', /^\/api\/cases\/(\d+)\/movements$/, async (c) => { need(c, 'cases', true); const r = find(c, 'cases', c.m[1]); (r.movimentos ||= []).unshift({ data: c.body.data || new Date().toISOString().slice(0, 10), nome: clean(c.body.nome, 200), origem: 'manual' }); save(); return send(c.res, 201, r.movimentos); });
R('POST', /^\/api\/cases\/(\d+)\/datajud$/, async (c) => {
  need(c, 'cases', true); const r = find(c, 'cases', c.m[1]); const out = await datajudLookup(r.numero);
  if (!out.configured) return send(c.res, 200, out);
  if (out.error) throw fail(502, out.error);
  const have = new Set((r.movimentos || []).map((m) => m.data + '|' + m.nome)); let novos = 0;
  for (const m of out.movimentos) if (!have.has(m.data + '|' + m.nome)) { (r.movimentos ||= []).push({ ...m, origem: 'DataJud' }); novos++; }
  r.movimentos.sort((a, b) => b.data.localeCompare(a.data)); r.datajudAt = Date.now(); if (novos) db.msgs.push({ id: nid('msgs'), officeId: r.officeId, processoId: r.id, canal: 'alerta', texto: `${novos} nova(s) movimentação(ões) no processo ${r.numero}.`, status: 'novo', createdAt: Date.now() }); save();
  return send(c.res, 200, { configured: true, novos, total: r.movimentos.length, classe: out.classe, orgao: out.orgao });
});

/* --- IA --- */
const aiInfo = () => ({ provider: process.env.ANTHROPIC_API_KEY ? 'Claude (API)' : 'Motor local (offline)', revisao: 'Conteúdo gerado por IA. Revisão obrigatória pelo advogado responsável antes de qualquer uso.' });
R('GET', /^\/api\/ai\/info$/, async (c) => { need(c, 'ai'); return send(c.res, 200, { ...aiInfo(), templates: TEMPLATES.map((t) => ({ id: t.id, nome: t.nome })) }); });
R('POST', /^\/api\/ai\/summarize$/, async (c) => { need(c, 'ai', true); const text = c.body.docId ? find(c, 'docs', c.body.docId).texto : clean(c.body.text, 200000); if (!text || text.length < 40) throw fail(422, 'Texto muito curto para resumir.'); audit(c.u, 'IA: resumo'); return send(c.res, 200, { ...(await aiSummarize(text, +c.body.frases || 5)), ...aiInfo() }); });
R('POST', /^\/api\/ai\/extract$/, async (c) => { need(c, 'ai', true); const text = c.body.docId ? find(c, 'docs', c.body.docId).texto : clean(c.body.text, 200000); if (!text || text.length < 20) throw fail(422, 'Texto muito curto.'); audit(c.u, 'IA: extração'); return send(c.res, 200, { ...aiExtract(text), ...aiInfo() }); });
R('POST', /^\/api\/ai\/draft$/, async (c) => {
  need(c, 'ai', true); const cs = c.body.processoId ? find(c, 'cases', c.body.processoId) : null, cl = cs?.clienteId ? db.clients.find((x) => x.id === +cs.clienteId && x.officeId === c.u.officeId) : (c.body.clienteId ? find(c, 'clients', c.body.clienteId) : null);
  audit(c.u, 'IA: minuta ' + c.body.template); return send(c.res, 200, { ...(await aiDraft({ template: c.body.template, caso: cs, cliente: cl, advogado: c.u, escritorio: c.office, instrucoes: clean(c.body.instrucoes, 1500) })), ...aiInfo() });
});

/* --- dashboard, busca, financeiro --- */
R('GET', /^\/api\/dashboard$/, async (c) => {
  const o = c.u.officeId, mine = (t) => db[t].filter((r) => r.officeId === o && !r.deleted), now = Date.now(), d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const tasks = mine('tasks').filter((t) => t.status !== 'concluida').map((t) => ({ ...t, dias: Math.floor((new Date(t.venc + 'T12:00') - d0) / DAY) })).sort((a, b) => a.venc.localeCompare(b.venc));
  const cases = mine('cases'), fin = can(c.u, 'fin') ? mine('fin') : [];
  const mes = new Date().toISOString().slice(0, 7);
  return send(c.res, 200, {
    prazos: tasks.filter((t) => t.dias <= 7).slice(0, 8), atrasadas: tasks.filter((t) => t.dias < 0).length, pendentes: tasks.length,
    processosAtivos: cases.filter((x) => x.status !== 'arquivado' && x.status !== 'encerrado').length, clientes: mine('clients').length, documentos: mine('docs').length,
    movimentacoes: cases.flatMap((x) => (x.movimentos || []).map((m) => ({ ...m, processoId: x.id, numero: x.numero, titulo: x.titulo }))).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6),
    financeiro: can(c.u, 'fin') ? { recebidoMes: fin.filter((f) => f.tipo === 'receita' && f.pago && (f.venc || '').startsWith(mes)).reduce((a, f) => a + f.valor, 0), aReceber: fin.filter((f) => f.tipo === 'receita' && !f.pago).reduce((a, f) => a + f.valor, 0), despesasMes: fin.filter((f) => f.tipo === 'despesa' && (f.venc || '').startsWith(mes)).reduce((a, f) => a + f.valor, 0) } : null,
    porArea: Object.entries(cases.reduce((m, x) => ((m[x.area || 'Outros'] = (m[x.area || 'Outros'] || 0) + 1), m), {})).map(([area, n]) => ({ area, n })),
  });
});
R('GET', /^\/api\/search$/, async (c) => { const q = clean(c.query.get('q'), 60).toLowerCase(); if (q.length < 2) return send(c.res, 200, []); const o = c.u.officeId, hit = (s) => String(s || '').toLowerCase().includes(q), out = [];
  for (const x of db.clients) if (x.officeId === o && !x.deleted && (hit(x.nome) || hit(x.doc) || hit(x.email))) out.push({ t: 'cliente', id: x.id, titulo: x.nome, sub: x.doc || x.email });
  for (const x of db.cases) if (x.officeId === o && !x.deleted && (hit(x.numero) || hit(x.titulo) || hit(x.parteContraria))) out.push({ t: 'processo', id: x.id, titulo: x.titulo, sub: x.numero });
  if (can(c.u, 'docs')) for (const x of db.docs) if (x.officeId === o && !x.deleted && (hit(x.nome) || hit(x.texto) || (x.tags || []).some(hit))) { const i = (x.texto || '').toLowerCase().indexOf(q); out.push({ t: 'documento', id: x.id, titulo: x.nome, sub: i >= 0 ? '…' + x.texto.slice(Math.max(0, i - 40), i + 80).replace(/\s+/g, ' ') + '…' : (x.tags || []).join(', ') }); }
  return send(c.res, 200, out.slice(0, 20)); });
R('GET', /^\/api\/fin\/report$/, async (c) => { need(c, 'fin'); const fin = db.fin.filter((r) => r.officeId === c.u.officeId && !r.deleted), meses = {}; for (const f of fin) { const m = (f.venc || '').slice(0, 7); if (!m) continue; const x = (meses[m] ||= { rec: 0, desp: 0, pend: 0 }); if (f.tipo === 'receita') { f.pago ? (x.rec += f.valor) : (x.pend += f.valor); } else x.desp += f.valor; } return send(c.res, 200, { meses: Object.entries(meses).sort().map(([m, v]) => ({ m, ...v })), inadimplentes: fin.filter((f) => f.tipo === 'receita' && !f.pago && f.venc < new Date().toISOString().slice(0, 10)).length }); });

/* --- equipe, LGPD, backup, assinatura --- */
R('GET', /^\/api\/team$/, async (c) => { need(c, 'team'); return send(c.res, 200, db.users.filter((u) => u.officeId === c.u.officeId).map(pubUser).concat([])); });
R('POST', /^\/api\/team$/, async (c) => { need(c, 'team', true); const b = c.body, email = clean(b.email, 120).toLowerCase(); if (!ROLES[b.role] || b.role === 'admin') throw fail(422, 'Perfil inválido.'); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || db.users.some((u) => u.email === email)) throw fail(422, 'E-mail inválido ou já cadastrado.'); if (clean(b.nome).split(/\s+/).length < 2) throw fail(422, 'Informe nome e sobrenome.'); const temp = crypto.randomBytes(5).toString('hex') + 'A1'; const u = { id: nid('user'), officeId: c.u.officeId, name: clean(b.nome, 80), email, role: b.role, pw: hashPw(temp), createdAt: Date.now() }; db.users.push(u); db.outbox.push({ id: nid('mail'), to: email, subject: 'Convite para o Lexora', body: `Senha temporária: ${temp}`, at: Date.now() }); audit(c.u, 'Convidou usuário', u.id); save(); return send(c.res, 201, { ...pubUser(u), senhaTemporaria: temp }); });
R('PATCH', /^\/api\/team\/(\d+)$/, async (c) => { need(c, 'team', true); const u = db.users.find((x) => x.id === +c.m[1] && x.officeId === c.u.officeId); if (!u || u.role === 'admin' && u.id === c.u.id) throw fail(404, 'Usuário não encontrado.'); if (ROLES[c.body.role] && c.body.role !== 'admin') u.role = c.body.role; if (typeof c.body.disabled === 'boolean') { u.disabled = c.body.disabled; for (const k of Object.keys(db.sessions)) if (db.sessions[k].userId === u.id) delete db.sessions[k]; } audit(c.u, 'Alterou usuário', u.id); save(); return send(c.res, 200, pubUser(u)); });
R('GET', /^\/api\/audit$/, async (c) => { need(c, 'team'); return send(c.res, 200, db.audit.filter((a) => a.officeId === c.u.officeId).slice(-40).reverse()); });
R('GET', /^\/api\/lgpd\/export\/(\d+)$/, async (c) => { need(c, 'clients'); const cl = find(c, 'clients', c.m[1]); audit(c.u, 'LGPD: exportou dados do titular', cl.id); return send(c.res, 200, { titular: cl, processos: db.cases.filter((x) => x.officeId === c.u.officeId && x.clienteId === cl.id), documentos: db.docs.filter((x) => x.officeId === c.u.officeId && x.clienteId === cl.id).map((d) => ({ ...d, texto: undefined })), financeiro: db.fin.filter((x) => x.officeId === c.u.officeId && x.clienteId === cl.id) }); });
R('POST', /^\/api\/lgpd\/anonymize\/(\d+)$/, async (c) => { need(c, 'team', true); const cl = find(c, 'clients', c.m[1]); Object.assign(cl, { nome: 'Titular anonimizado #' + cl.id, doc: '', email: '', telefone: '', obs: '', anonimizado: Date.now() }); audit(c.u, 'LGPD: anonimizou titular', cl.id); save(); return send(c.res, 200, { ok: true }); });
R('GET', /^\/api\/backup$/, async (c) => { need(c, 'team'); const o = c.u.officeId, pick = (t) => db[t].filter((r) => r.officeId === o); audit(c.u, 'Backup exportado'); return send(c.res, 200, { exportadoEm: new Date().toISOString(), escritorio: c.office.name, clients: pick('clients'), cases: pick('cases'), tasks: pick('tasks'), docs: pick('docs'), fin: pick('fin') }); });
R('GET', /^\/api\/billing$/, async (c) => { need(c, 'billing'); return send(c.res, 200, { ...pubOffice(c.office), invoices: (c.office.invoices || []).slice().reverse(), provider: billing.name, taxas: billing.fees }); }, { allowExpired: true });
R('POST', /^\/api\/billing\/card$/, async (c) => { need(c, 'billing', true); const r = billing.setCard(c.office, c.body, c.ip); audit(c.u, 'Cartão cadastrado e cobrança recorrente autorizada'); save(); return send(c.res, 200, { ...pubOffice(c.office), ...r }); }, { allowExpired: true });
R('POST', /^\/api\/billing\/cancel$/, async (c) => { need(c, 'billing', true); c.office.plan = 'cancelado'; c.office.card = null; audit(c.u, 'Assinatura cancelada'); save(); return send(c.res, 200, pubOffice(c.office)); }, { allowExpired: true });

/* ---------- servidor ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  try {
    if (p.startsWith('/api/')) {
      const sid = cookie(req, 'lxs'), s = sid && db.sessions[sid]; const u = s && s.exp > Date.now() ? db.users.find((x) => x.id === s.userId && !x.disabled) : null;
      const office = u ? db.offices.find((o) => o.id === u.officeId) : null;
      for (const r of routes) {
        if (r.method !== req.method) continue; const m = p.match(r.re); if (!m) continue;
        if (!r.opts.public && !u) throw fail(401, 'Faça login para continuar.');
        if (u && !r.opts.public && !r.opts.allowExpired && req.method !== 'GET' && ['vencido', 'cancelado'].includes(officeState(office))) throw fail(402, 'Período de teste encerrado. Ative a assinatura para continuar editando — seus dados continuam disponíveis para consulta.', { code: 'EXPIRED' });
        const body = ['POST', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : {};
        return await r.fn({ req, res, u, office, m, body, query: url.searchParams, ip: req.socket.remoteAddress || '?' });
      }
      throw fail(404, 'Rota inexistente');
    }
    let f = decodeURIComponent(p); if (f === '/') f = '/index.html';
    const file = path.normalize(path.join(PUB, f));
    if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(200, { 'Content-Type': MIME['.html'] }); return fs.createReadStream(path.join(PUB, 'index.html')).pipe(res); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(file).pipe(res);
  } catch (e) { if (e.http) return send(res, e.http, { error: e.message, ...(e.errors ? { errors: e.errors } : {}), ...(e.code ? { code: e.code } : {}) }); console.error(e); send(res, 500, { error: 'Erro interno' }); }
});
process.on('SIGINT', () => { flush(); process.exit(0); }); process.on('SIGTERM', () => { flush(); process.exit(0); });
server.listen(PORT, () => console.log(`Lexora em http://localhost:${PORT} — IA: ${aiInfo().provider} • DataJud: ${process.env.DATAJUD_API_KEY ? 'configurado' : 'sem chave (modo manual)'} • cobrança: ${billing.name}`));
export { db };
