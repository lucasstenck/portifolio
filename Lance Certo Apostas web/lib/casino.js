// Jogos de cassino com resultado verificável (provably fair): Dados, Roleta europeia, Slots e Crash (multiplayer).
import crypto from 'node:crypto';
import { rnd, sha256, newSeed, newFair } from './fair.js';

export const EDGE = 0.03; // vantagem da casa nos dados e no crash (RTP 97%)
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

/** Consome uma "rodada" justa do usuário: devolve [serverSeed, clientSeed, nonce] e incrementa o nonce. */
function ticket(u) {
  if (!u.fair) u.fair = newFair();
  return [u.fair.serverSeed, u.fair.clientSeed, u.fair.nonce++];
}

/* ---------- Dados ---------- */
export function dice(u, target, over) {
  if (!(target >= 2 && target <= 98)) throw new Error('Alvo deve estar entre 2,00 e 98,00');
  const [s, c, n] = ticket(u);
  const roll = Math.floor(rnd(s, c, n) * 10000) / 100; // 0,00 a 99,99
  const chance = over ? 99.99 - target : target;          // % de ganhar
  const mult = Math.floor((100 * (1 - EDGE)) / chance * 100) / 100;
  const win = over ? roll > target : roll < target;
  return { roll, win, chance: Math.round(chance * 100) / 100, mult, nonce: n };
}

/* ---------- Roleta ---------- */
export function roulette(u, bets) {
  const [s, c, n] = ticket(u);
  const num = Math.floor(rnd(s, c, n) * 37);
  const color = num === 0 ? 'green' : RED.has(num) ? 'red' : 'black';
  let returned = 0;
  const detail = bets.map((b) => {
    let mult = 0;
    switch (b.type) {
      case 'straight': mult = +b.value === num ? 36 : 0; break;
      case 'color': mult = num !== 0 && color === b.value ? 2 : 0; break;
      case 'parity': mult = num !== 0 && (b.value === 'even' ? num % 2 === 0 : num % 2 === 1) ? 2 : 0; break;
      case 'half': mult = num !== 0 && (b.value === 'low' ? num <= 18 : num >= 19) ? 2 : 0; break;
      case 'dozen': mult = num !== 0 && Math.ceil(num / 12) === +b.value ? 3 : 0; break;
      case 'column': mult = num !== 0 && ((num - 1) % 3) + 1 === +b.value ? 3 : 0; break;
    }
    const pay = b.amount * mult; returned += pay;
    return { ...b, win: pay > 0, pay };
  });
  return { number: num, color, returned, detail, nonce: n };
}

/* ---------- Slots (3 rolos, 1 linha) ---------- */
export const SYMBOLS = [
  { k: 'cherry', e: '🍒', w: 30, pay3: 8 }, { k: 'lemon', e: '🍋', w: 25, pay3: 12 }, { k: 'bell', e: '🔔', w: 18, pay3: 25 },
  { k: 'grape', e: '🍇', w: 14, pay3: 40 }, { k: 'gem', e: '💎', w: 8, pay3: 100 }, { k: 'seven', e: '7️⃣', w: 5, pay3: 250 },
];
const PAY_TWO_CHERRY = 1.1;
function pick(r) { let acc = 0; for (const s of SYMBOLS) { acc += s.w; if (r * 100 < acc) return s; } return SYMBOLS[0]; }
export function slotsPay(a, b, c) {
  if (a.k === b.k && b.k === c.k) return a.pay3;
  return [a, b, c].filter((x) => x.k === 'cherry').length === 2 ? PAY_TWO_CHERRY : 0;
}
export function slots(u) {
  const [s, c, n] = ticket(u);
  const reels = [0, 1, 2].map((i) => pick(rnd(s, c, n, i)));
  const mult = slotsPay(...reels);
  return { reels: reels.map((r) => ({ k: r.k, e: r.e })), mult, nonce: n };
}
export function slotsRtp() {
  let rtp = 0; const T = 100;
  for (const a of SYMBOLS) for (const b of SYMBOLS) for (const c of SYMBOLS) rtp += (a.w / T) * (b.w / T) * (c.w / T) * slotsPay(a, b, c);
  return rtp;
}

/* ---------- Crash (rodadas compartilhadas) ---------- */
const GROWTH = 0.09;           // m(t) = e^(0,09·t[s])
const BETTING_MS = 8000, CRASHED_MS = 4500;
export const crashAt = (seed) => { const r = rnd(seed, 'crash', 0); return Math.min(1000, Math.max(1, Math.floor((100 * (1 - EDGE)) / (1 - r)) / 100)); };
export const multAt = (ms) => Math.floor(Math.exp(GROWTH * ms / 1000) * 100) / 100;

export class Crash {
  constructor(store, wallet) {
    this.s = store; this.wallet = wallet; this.history = (store.d.crashHistory ||= []);
    this.round = null; this.next();
    setInterval(() => this.tick(), 100);
  }
  next() {
    const seed = newSeed();
    this.round = { id: this.s.id('round'), seed, hash: sha256(seed), point: crashAt(seed), phase: 'betting', startsAt: Date.now() + BETTING_MS, bets: [] };
    this.round.crashMs = Math.ceil(Math.log(this.round.point) / GROWTH * 1000);
  }
  tick() {
    const r = this.round, now = Date.now();
    if (r.phase === 'betting' && now >= r.startsAt) { r.phase = 'running'; r.runStart = r.startsAt; }
    if (r.phase === 'running') {
      const el = now - r.runStart, m = multAt(el);
      for (const b of r.bets) if (!b.cashed && !b.lost && b.auto && m >= b.auto && el < r.crashMs) this.cashout(b.userId, Math.min(b.auto, m));
      if (el >= r.crashMs) {
        r.phase = 'crashed'; r.crashedAt = now;
        for (const b of r.bets) if (!b.cashed) b.lost = true;
        this.history.unshift({ id: r.id, point: r.point, hash: r.hash, seed: r.seed });
        this.history.length = Math.min(this.history.length, 30);
        this.s.d.crashHistory = this.history; this.s.save();
      }
    }
    if (r.phase === 'crashed' && now - r.crashedAt >= CRASHED_MS) this.next();
  }
  bet(user, amount, auto) {
    const r = this.round;
    if (r.phase !== 'betting') throw new Error('Apostas encerradas nesta rodada. Aguarde a próxima.');
    if (r.bets.some((b) => b.userId === user.id)) throw new Error('Você já apostou nesta rodada.');
    this.wallet(user, -amount, 'casino_bet', `Crash #${r.id}`);
    r.bets.push({ userId: user.id, name: this.mask(user.name), amount, auto: auto && auto >= 1.01 ? auto : null, cashed: null, payout: 0 });
    return { roundId: r.id };
  }
  cashout(userId, atMult) {
    const r = this.round, b = r.bets.find((x) => x.userId === userId);
    if (!b || b.cashed || b.lost) throw new Error('Nada para sacar.');
    if (r.phase !== 'running') throw new Error('A rodada não está em andamento.');
    const el = Date.now() - r.runStart;
    if (el >= r.crashMs) throw new Error('Tarde demais: a rodada já estourou.');
    const m = atMult || multAt(el);
    b.cashed = m; b.payout = Math.floor(b.amount * m);
    this.wallet(this.s.user(userId), b.payout, 'casino_win', `Crash #${r.id} @ ${m.toFixed(2)}x`);
    return { mult: m, payout: b.payout };
  }
  mask(name) { const p = name.trim().split(/\s+/); return p[0] + (p[1] ? ' ' + p[1][0] + '.' : ''); }
  state(userId) {
    const r = this.round, now = Date.now();
    const mine = r.bets.find((b) => b.userId === userId);
    return {
      id: r.id, phase: r.phase, hash: r.hash, now, startsAt: r.startsAt, runStart: r.runStart || null,
      mult: r.phase === 'running' ? multAt(now - r.runStart) : r.phase === 'crashed' ? r.point : 1,
      point: r.phase === 'crashed' ? r.point : null, seed: r.phase === 'crashed' ? r.seed : null,
      players: r.bets.map((b) => ({ name: b.name, amount: b.amount, cashed: b.cashed, payout: b.payout, lost: !!b.lost })),
      mine: mine ? { amount: mine.amount, cashed: mine.cashed, payout: mine.payout, auto: mine.auto, lost: !!mine.lost } : null,
      history: this.history.slice(0, 16).map((h) => ({ id: h.id, point: h.point })),
    };
  }
}
export const verifyCrash = (seed, hash) => sha256(seed) === hash ? crashAt(seed) : null;
export { sha256 };
