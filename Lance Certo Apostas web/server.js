// Lance Certo — plataforma de apostas esportivas e cassino (ambiente com SALDO VIRTUAL, sem dinheiro real).
// Servidor sem dependências (Node 20+): contas, carteira com ledger, odds ao vivo, cassino verificável, painel administrativo.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store, startOfDay } from './lib/store.js';
import { Sport, MARKETS } from './lib/sport.js';
import { dice, roulette, slots, slotsRtp, Crash, EDGE, SYMBOLS, crashAt } from './lib/casino.js';
import { newFair, newSeed, sha256, rnd } from './lib/fair.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, 'public');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = +process.env.PORT || 3203;
const store = new Store(path.join(DATA, 'db.json'));
const D = store.d;
const MIN_BET = 100, MAX_BET = 100000;         // R$ 1,00 a R$ 1.000,00 (em centavos)
const MAX_DEPOSIT = 500000, DEFAULT_DEP_LIMIT = 500000;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

/* ---------- utilidades ---------- */
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(pw, salt, 32).toString('hex') });
const checkPw = (pw, u) => crypto.timingSafeEqual(Buffer.from(hashPw(pw, u.pw.salt).hash, 'hex'), Buffer.from(u.pw.hash, 'hex'));
const clean = (s, n = 120) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const isCpf = (c) => {
  c = digits(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const n of [9, 10]) { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const d = ((s * 10) % 11) % 10; if (d !== +c[n]) return false; }
  return true;
};
const age = (iso) => { const b = new Date(iso + 'T12:00:00'), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, cpf: u.cpfMask, balance: u.balance, role: u.role, limits: u.limits, excludedUntil: u.excludedUntil || 0, createdAt: u.createdAt });
const cents = (v) => Math.round(Number(v) * 100);
const fail = (code, msg, extra = {}) => Object.assign(new Error(msg), { http: code, ...extra });
const hits = new Map();
const rate = (key, max, win = 600000) => { const now = Date.now(), h = (hits.get(key) || []).filter((t) => now - t < win); if (h.length >= max && !process.env.NO_RATE_LIMIT) return true; h.push(now); hits.set(key, h); return false; };

function ensureAdmin() {
  if (D.users.some((u) => u.role === 'admin')) return;
  const email = process.env.ADMIN_EMAIL || 'admin@lancecerto.com.br', pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(7).toString('base64url');
  D.users.push({ id: store.id('user'), name: 'Administrador', email, cpfMask: '—', cpfHash: 'admin', birth: '1990-01-01', role: 'admin', pw: hashPw(pw), balance: 0, createdAt: Date.now(), limits: {}, fair: newFair() });
  fs.writeFileSync(path.join(DATA, 'admin-credentials.txt'), `email: ${email}\nsenha: ${pw}\n`);
  store.save();
}
ensureAdmin();

const sport = new Sport(store);
const crash = new Crash(store, (u, amount, type, ref) => store.move(u, amount, type, ref));

/* ---------- jogo responsável ---------- */
const todayTx = (u) => D.tx.filter((t) => t.userId === u.id && t.at >= startOfDay());
function guard(u, stake) {
  if (u.excludedUntil && u.excludedUntil > Date.now()) throw fail(403, `Conta em autoexclusão até ${new Date(u.excludedUntil).toLocaleDateString('pt-BR')}.`);
  if (stake < MIN_BET) throw fail(422, 'Aposta mínima: R$ 1,00.');
  if (stake > MAX_BET) throw fail(422, 'Aposta máxima: R$ 1.000,00.');
  const lim = u.limits?.dailyLoss;
  if (lim) {
    const net = -todayTx(u).filter((t) => ['bet', 'casino_bet', 'win', 'casino_win', 'cashout'].includes(t.type)).reduce((a, t) => a + t.amount, 0);
    if (net + stake > lim) throw fail(403, `Limite diário de perdas atingido (${(lim / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`);
  }
}
const debit = (u, amount, type, ref, meta) => { try { return store.move(u, -amount, type, ref, meta); } catch (e) { if (e.code === 'FUNDS') throw fail(402, 'Saldo insuficiente. Adicione saldo na carteira.'); throw e; } };

/* ---------- HTTP ---------- */
const send = (res, code, body, headers = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((ok, no) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 50000) { no(new Error('grande')); req.destroy(); } }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch (e) { no(e); } }); });
const cookie = (req, n) => (req.headers.cookie || '').split(/;\s*/).map((c) => c.split('=')).find((c) => c[0] === n)?.[1];
const session = (req) => { const sid = cookie(req, 'sid'); const s = sid && D.sessions[sid]; if (!s || s.exp < Date.now()) return null; return store.user(s.userId) || null; };

const routes = {
  'POST /api/register': async (req, res, b) => {
    if (rate('reg' + req.socket.remoteAddress, 8)) throw fail(429, 'Muitas tentativas. Aguarde.');
    const name = clean(b.name, 80), email = clean(b.email).toLowerCase(), cpf = digits(b.cpf), err = {};
    if (name.split(/\s+/).filter(Boolean).length < 2) err.name = 'Informe nome e sobrenome.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) err.email = 'E-mail inválido.';
    if (!isCpf(cpf)) err.cpf = 'CPF inválido.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.birth || '') || age(b.birth) < 18) err.birth = 'É preciso ter 18 anos ou mais.';
    if (String(b.password || '').length < 8) err.password = 'A senha deve ter ao menos 8 caracteres.';
    if (!b.terms) err.terms = 'Aceite os termos para continuar.';
    if (!err.email && D.users.some((u) => u.email === email)) err.email = 'E-mail já cadastrado.';
    if (!err.cpf && D.users.some((u) => u.cpfHash === sha256(cpf))) err.cpf = 'CPF já cadastrado.';
    if (Object.keys(err).length) throw fail(422, 'Verifique os campos.', { errors: err });
    const u = { id: store.id('user'), name, email, cpfHash: sha256(cpf), cpfMask: `***.***.${cpf.slice(6, 9)}-${cpf.slice(9)}`, birth: b.birth, role: 'user', pw: hashPw(String(b.password)), balance: 0, createdAt: Date.now(), limits: { dailyDeposit: DEFAULT_DEP_LIMIT }, fair: newFair() };
    D.users.push(u); store.save();
    return login(res, u, 201);
  },
  'POST /api/login': async (req, res, b) => {
    if (rate('login' + req.socket.remoteAddress, 15)) throw fail(429, 'Muitas tentativas. Aguarde alguns minutos.');
    const u = D.users.find((x) => x.email === clean(b.email).toLowerCase());
    if (!u || !checkPw(String(b.password || ''), u)) throw fail(401, 'E-mail ou senha incorretos.');
    return login(res, u, 200);
  },
  'POST /api/logout': async (req, res) => { const sid = cookie(req, 'sid'); if (sid) delete D.sessions[sid]; store.save(); return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' }); },
  'GET /api/me': async (req, res, b, u) => send(res, 200, { user: u ? pub(u) : null, today: u ? stats(u) : null }),

  /* carteira (saldo virtual) */
  'GET /api/wallet': async (req, res, b, u) => send(res, 200, { balance: u.balance, tx: store.txOf(u.id, 80), withdrawals: D.withdrawals.filter((w) => w.userId === u.id).slice(-10).reverse(), limits: u.limits, depositedToday: depositedToday(u) }),
  'POST /api/deposit': async (req, res, b, u) => {
    const amount = cents(b.amount);
    if (!(amount >= 1000 && amount <= MAX_DEPOSIT)) throw fail(422, 'Depósito entre R$ 10,00 e R$ 5.000,00.');
    if (u.excludedUntil > Date.now()) throw fail(403, 'Conta em autoexclusão.');
    const lim = u.limits?.dailyDeposit || DEFAULT_DEP_LIMIT;
    if (depositedToday(u) + amount > lim) throw fail(403, `Limite diário de depósito: ${(lim / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`);
    const t = store.move(u, amount, 'deposit', 'Depósito (saldo virtual de demonstração)', { method: clean(b.method, 12) || 'pix' });
    return send(res, 201, { balance: u.balance, tx: t });
  },
  'POST /api/withdraw': async (req, res, b, u) => {
    const amount = cents(b.amount);
    if (!(amount >= 2000)) throw fail(422, 'Saque mínimo: R$ 20,00.');
    if (u.balance < amount) throw fail(402, 'Saldo insuficiente.');
    if (D.withdrawals.some((w) => w.userId === u.id && w.status === 'pendente')) throw fail(409, 'Você já tem um saque pendente.');
    const w = { id: store.id('wd'), userId: u.id, name: u.name, amount, key: clean(b.key, 60) || 'chave não informada', status: 'pendente', at: Date.now() };
    store.move(u, -amount, 'withdraw', `Saque #${w.id} (pendente)`, { wdId: w.id });
    D.withdrawals.push(w); store.save();
    return send(res, 201, { withdrawal: w, balance: u.balance });
  },
  'POST /api/limits': async (req, res, b, u) => {
    const l = u.limits || (u.limits = {});
    for (const k of ['dailyDeposit', 'dailyLoss']) if (k in b) {
      const v = b[k] === null || b[k] === '' ? null : cents(b[k]);
      if (v !== null && (v < 1000 || v > 100000000)) throw fail(422, 'Limite inválido.');
      const cur = l[k] || (k === 'dailyDeposit' ? DEFAULT_DEP_LIMIT : 0);
      // aumentar limites só vale após 24h (regra de proteção); reduzir é imediato
      if (v === null || (cur && v > cur)) { l[k + 'Pending'] = { value: v, at: Date.now() + 86400000 }; } else { l[k] = v; delete l[k + 'Pending']; }
    }
    store.save(); return send(res, 200, { limits: l });
  },
  'POST /api/selfexclude': async (req, res, b, u) => {
    const days = +b.days; if (![1, 7, 30, 90, 180, 365].includes(days)) throw fail(422, 'Período inválido.');
    u.excludedUntil = Date.now() + days * 86400000; store.save(); return send(res, 200, { excludedUntil: u.excludedUntil });
  },

  /* esportes */
  'GET /api/matches': async (req, res) => send(res, 200, { now: Date.now(), matches: sport.list(), markets: MARKETS }),
  'POST /api/bets': async (req, res, b, u) => {
    const sel = Array.isArray(b.selections) ? b.selections.slice(0, 12) : [];
    if (!sel.length) throw fail(422, 'Selecione ao menos uma opção.');
    const type = b.type === 'multi' && sel.length > 1 ? 'multi' : 'single', stake = cents(b.stake);
    const total = type === 'multi' ? stake : stake * sel.length;
    guard(u, stake); if (total > u.balance) throw fail(402, 'Saldo insuficiente. Adicione saldo na carteira.');
    let created = [];
    try {
      if (type === 'multi') created = [mk(u, sport.place(u, sel, stake, 'multi'), stake, 'multi')];
      else created = sel.map((s) => mk(u, sport.place(u, [s], stake, 'single'), stake, 'single'));
    } catch (e) { if (e.code) throw fail(e.code === 'ODDS' ? 409 : 422, e.message, { code: e.code, odds: e.odds, matchId: e.matchId, market: e.market, pick: e.pick }); throw e; }
    for (const bet of created) { debit(u, bet.stake, 'bet', `Aposta #${bet.id}`, { betId: bet.id }); D.bets.push(bet); }
    store.save();
    return send(res, 201, { bets: created, balance: u.balance });
  },
  'GET /api/bets': async (req, res, b, u) => send(res, 200, { bets: D.bets.filter((x) => x.userId === u.id).slice(-60).reverse().map((x) => ({ ...x, cashout: sport.cashoutValue(x) })) }),
  'POST /api/bets/cashout': async (req, res, b, u) => {
    const bet = D.bets.find((x) => x.id === +b.id && x.userId === u.id);
    if (!bet) throw fail(404, 'Aposta não encontrada.');
    const v = sport.cashoutValue(bet); if (!v) throw fail(409, 'Cash-out indisponível agora.');
    if (b.expected && Math.abs(v - +b.expected) > Math.max(2, v * 0.01)) throw fail(409, 'O valor mudou.', { cashout: v });
    bet.status = 'cashout'; bet.payout = v; bet.settledAt = Date.now();
    store.move(u, v, 'cashout', `Cash-out aposta #${bet.id}`, { betId: bet.id }); store.save();
    return send(res, 200, { payout: v, balance: u.balance });
  },

  /* cassino */
  'POST /api/casino/dice': async (req, res, b, u) => {
    const stake = cents(b.amount); guard(u, stake); const mark = u.fair?.nonce;
    debit(u, stake, 'casino_bet', 'Dados');
    const r = dice(u, +b.target, !!b.over);
    const pay = r.win ? Math.floor(stake * r.mult) : 0; if (pay) store.move(u, pay, 'casino_win', `Dados ${r.roll.toFixed(2)}`);
    logRound(u, 'dice', stake, pay, r);
    return send(res, 200, { ...r, payout: pay, balance: u.balance, fair: fairInfo(u) });
  },
  'POST /api/casino/roulette': async (req, res, b, u) => {
    const bets = (Array.isArray(b.bets) ? b.bets : []).slice(0, 30).map((x) => ({ type: x.type, value: x.value, amount: cents(x.amount) })).filter((x) => x.amount >= MIN_BET && ['straight', 'color', 'parity', 'half', 'dozen', 'column'].includes(x.type));
    if (!bets.length) throw fail(422, 'Faça ao menos uma aposta (mín. R$ 1,00).');
    const stake = bets.reduce((a, x) => a + x.amount, 0); guard(u, Math.min(stake, MAX_BET)); if (stake > MAX_BET) throw fail(422, 'Total máximo por giro: R$ 1.000,00.');
    debit(u, stake, 'casino_bet', 'Roleta');
    const r = roulette(u, bets); if (r.returned) store.move(u, r.returned, 'casino_win', `Roleta ${r.number}`);
    logRound(u, 'roulette', stake, r.returned, { number: r.number, color: r.color });
    return send(res, 200, { ...r, stake, balance: u.balance, fair: fairInfo(u) });
  },
  'POST /api/casino/slots': async (req, res, b, u) => {
    const stake = cents(b.amount); guard(u, stake); debit(u, stake, 'casino_bet', 'Slots');
    const r = slots(u); const pay = Math.floor(stake * r.mult); if (pay) store.move(u, pay, 'casino_win', 'Slots');
    logRound(u, 'slots', stake, pay, { reels: r.reels.map((x) => x.k) });
    return send(res, 200, { ...r, payout: pay, balance: u.balance, fair: fairInfo(u) });
  },
  'GET /api/casino/crash': async (req, res, b, u) => send(res, 200, { ...crash.state(u?.id), balance: u?.balance ?? null }),
  'POST /api/casino/crash/bet': async (req, res, b, u) => { const stake = cents(b.amount); guard(u, stake); const r = crash.bet(u, stake, +b.auto || null); return send(res, 200, { ...r, balance: u.balance }); },
  'POST /api/casino/crash/cashout': async (req, res, b, u) => { const r = crash.cashout(u.id); return send(res, 200, { ...r, balance: u.balance }); },

  /* provably fair */
  'GET /api/fair': async (req, res, b, u) => send(res, 200, fairInfo(u, true)),
  'POST /api/fair/client-seed': async (req, res, b, u) => { const s = clean(b.seed, 40); if (s.length < 4) throw fail(422, 'Use ao menos 4 caracteres.'); u.fair.clientSeed = s; u.fair.nonce = 0; store.save(); return send(res, 200, fairInfo(u, true)); },
  'POST /api/fair/rotate': async (req, res, b, u) => { const old = u.fair; u.fair = { ...newFair(), clientSeed: old.clientSeed, previous: [{ seed: old.serverSeed, hash: old.hash, clientSeed: old.clientSeed, nonces: old.nonce }, ...old.previous].slice(0, 10) }; store.save(); return send(res, 200, fairInfo(u, true)); },
  'GET /api/fair/verify': async (req, res, b, u, url) => {
    const seed = url.searchParams.get('seed') || '', cs = url.searchParams.get('client') || '', n = +url.searchParams.get('nonce') || 0;
    return send(res, 200, { hash: sha256(seed), value: rnd(seed, cs, n), dice: Math.floor(rnd(seed, cs, n) * 10000) / 100, roulette: Math.floor(rnd(seed, cs, n) * 37) });
  },
  'GET /api/info': async (req, res) => send(res, 200, { slotsRtp: slotsRtp(), edge: EDGE, symbols: SYMBOLS.map((s) => ({ e: s.e, pay3: s.pay3 })), minBet: MIN_BET, maxBet: MAX_BET }),
  'GET /api/leaderboard': async (req, res) => {
    const day = startOfDay(), by = {};
    for (const t of D.tx) if (t.at >= day && ['win', 'casino_win', 'cashout'].includes(t.type)) by[t.userId] = (by[t.userId] || 0) + t.amount;
    return send(res, 200, Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, v]) => ({ name: crash.mask(store.user(+id)?.name || '—'), won: v })));
  },
};
const PUBLIC = new Set(['POST /api/register', 'POST /api/login', 'GET /api/me', 'GET /api/matches', 'GET /api/casino/crash', 'GET /api/info', 'GET /api/leaderboard', 'POST /api/logout', 'GET /api/fair/verify']);

function login(res, u, code) {
  const sid = crypto.randomBytes(24).toString('hex');
  D.sessions[sid] = { userId: u.id, exp: Date.now() + 7 * 86400000 }; store.save();
  return send(res, code, { user: pub(u) }, { 'Set-Cookie': `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}` });
}
function mk(u, legs, stake, type) {
  return { id: store.id('bet'), userId: u.id, type, legs, stake, totalOdds: Math.round(legs.reduce((a, l) => a * l.odds, 1) * 100) / 100, status: 'open', payout: 0, placedAt: Date.now() };
}
const depositedToday = (u) => todayTx(u).filter((t) => t.type === 'deposit').reduce((a, t) => a + t.amount, 0);
function stats(u) { const t = todayTx(u); const f = (types) => t.filter((x) => types.includes(x.type)).reduce((a, x) => a + x.amount, 0); return { staked: -f(['bet', 'casino_bet']), won: f(['win', 'casino_win', 'cashout']), deposited: f(['deposit']) }; }
function fairInfo(u, full) { const f = u.fair; return { hash: f.hash, clientSeed: f.clientSeed, nonce: f.nonce, ...(full ? { previous: f.previous } : {}) }; }
function logRound(u, game, stake, pay, detail) { D.rounds.push({ id: store.id('round'), userId: u.id, game, stake, pay, at: Date.now(), nonce: u.fair.nonce - 1, clientSeed: u.fair.clientSeed, serverHash: u.fair.hash, detail }); if (D.rounds.length > 5000) D.rounds.splice(0, 1000); store.save(); }
function applyPendingLimits(u) { const l = u.limits || {}; for (const k of ['dailyDeposit', 'dailyLoss']) { const p = l[k + 'Pending']; if (p && p.at <= Date.now()) { if (p.value === null) delete l[k]; else l[k] = p.value; delete l[k + 'Pending']; } } }

/* ---------- admin ---------- */
const admin = {
  'GET /api/admin/summary': (u) => {
    const day = startOfDay(), real = D.users.filter((x) => x.role === 'user');
    const sum = (types, since = 0) => D.tx.filter((t) => types.includes(t.type) && t.at >= since).reduce((a, t) => a + t.amount, 0);
    const stakes = -sum(['bet', 'casino_bet']), returns = sum(['win', 'casino_win', 'cashout']), stakesD = -sum(['bet', 'casino_bet'], day), returnsD = sum(['win', 'casino_win', 'cashout'], day);
    return { users: real.length, activeToday: new Set(D.tx.filter((t) => t.at >= day).map((t) => t.userId)).size, deposits: sum(['deposit']), withdrawn: -sum(['withdraw']), stakes, returns, ggr: stakes - returns, ggrToday: stakesD - returnsD, openBets: D.bets.filter((b) => b.status === 'open').length, exposure: D.bets.filter((b) => b.status === 'open').reduce((a, b) => a + Math.round(b.stake * b.totalOdds), 0), pendingWd: D.withdrawals.filter((w) => w.status === 'pendente').length, audit: store.audit().every((a) => a.ok), rtp: stakes ? returns / stakes : 0,
      byGame: Object.entries(D.rounds.reduce((m, r) => { const g = (m[r.game] ||= { stake: 0, pay: 0, n: 0 }); g.stake += r.stake; g.pay += r.pay; g.n++; return m; }, {})).map(([game, v]) => ({ game, ...v })),
      daily: Array.from({ length: 7 }, (_, i) => { const s = day - (6 - i) * 86400000, e = s + 86400000, st = -D.tx.filter((t) => ['bet', 'casino_bet'].includes(t.type) && t.at >= s && t.at < e).reduce((a, t) => a + t.amount, 0), rt = D.tx.filter((t) => ['win', 'casino_win', 'cashout'].includes(t.type) && t.at >= s && t.at < e).reduce((a, t) => a + t.amount, 0); return { day: s, stakes: st, ggr: st - rt }; }) };
  },
  'GET /api/admin/users': () => D.users.filter((x) => x.role === 'user').map((x) => ({ ...pub(x), blocked: !!x.blocked, bets: D.bets.filter((b) => b.userId === x.id).length, ...userTotals(x) })).reverse(),
  'GET /api/admin/bets': () => D.bets.slice(-40).reverse().map((b) => ({ ...b, user: store.user(b.userId)?.name })),
  'GET /api/admin/withdrawals': () => D.withdrawals.slice().reverse(),
};
const userTotals = (u) => { const t = D.tx.filter((x) => x.userId === u.id); const s = (ty) => t.filter((x) => ty.includes(x.type)).reduce((a, x) => a + x.amount, 0); return { deposited: s(['deposit']), staked: -s(['bet', 'casino_bet']), won: s(['win', 'casino_win', 'cashout']) }; };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), key = `${req.method} ${url.pathname}`;
  try {
    if (url.pathname.startsWith('/api/')) {
      const u = session(req); if (u) applyPendingLimits(u);
      if (url.pathname.startsWith('/api/admin/')) {
        if (!u || u.role !== 'admin') throw fail(403, 'Acesso restrito.');
        if (admin[key]) return send(res, 200, admin[key](u));
        let m;
        if (req.method === 'PATCH' && (m = url.pathname.match(/^\/api\/admin\/withdrawals\/(\d+)$/))) {
          const b = await readBody(req), w = D.withdrawals.find((x) => x.id === +m[1]); if (!w || w.status !== 'pendente') throw fail(409, 'Saque não está pendente.');
          if (b.status === 'aprovado') w.status = 'aprovado'; else if (b.status === 'recusado') { w.status = 'recusado'; store.move(store.user(w.userId), w.amount, 'refund', `Saque #${w.id} recusado`); } else throw fail(422, 'Status inválido');
          w.decidedAt = Date.now(); store.save(); return send(res, 200, w);
        }
        if (req.method === 'PATCH' && (m = url.pathname.match(/^\/api\/admin\/users\/(\d+)$/))) { const b = await readBody(req), x = store.user(+m[1]); if (!x || x.role === 'admin') throw fail(404, 'Usuário não encontrado'); if (typeof b.blocked === 'boolean') { x.blocked = b.blocked; if (b.blocked) x.excludedUntil = Date.now() + 3650 * 86400000; else x.excludedUntil = 0; } store.save(); return send(res, 200, pub(x)); }
        throw fail(404, 'Rota inexistente');
      }
      const handler = routes[key];
      if (!handler) throw fail(404, 'Rota inexistente');
      if (!PUBLIC.has(key) && !u) throw fail(401, 'Faça login para continuar.');
      const b = req.method === 'POST' || req.method === 'PATCH' ? await readBody(req) : {};
      return await handler(req, res, b, u, url);
    }
    let f = decodeURIComponent(url.pathname); if (f === '/') f = '/index.html'; if (f === '/admin') f = '/admin.html';
    const file = path.normalize(path.join(PUB, f));
    if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<h1>404</h1><a href="/">Voltar</a>'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    if (e.http) return send(res, e.http, { error: e.message, ...(e.errors ? { errors: e.errors } : {}), ...(e.code ? { code: e.code } : {}), ...(e.odds ? { odds: e.odds, matchId: e.matchId, market: e.market, pick: e.pick } : {}), ...(e.cashout ? { cashout: e.cashout } : {}) });
    if (e.message === 'Saldo insuficiente') return send(res, 402, { error: 'Saldo insuficiente. Adicione saldo na carteira.' });
    if (e.constructor === Error) return send(res, 422, { error: e.message }); console.error(e); send(res, 500, { error: 'Erro interno' });
  }
});
process.on('SIGINT', () => { store.flush(); process.exit(0); });
process.on('SIGTERM', () => { store.flush(); process.exit(0); });
server.listen(PORT, () => {
  console.log(`Lance Certo em http://localhost:${PORT}  (saldo virtual — sem dinheiro real)`);
  console.log(`Painel admin: http://localhost:${PORT}/admin  — credenciais em data/admin-credentials.txt`);
  console.log(`RTP dos slots: ${(slotsRtp() * 100).toFixed(2)}%`);
});
