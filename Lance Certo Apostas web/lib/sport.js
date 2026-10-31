// Motor esportivo: liga simulada em tempo acelerado, precificação por Poisson (pré-jogo e ao vivo),
// apostas simples/múltiplas, cash-out e liquidação automática.
import crypto from 'node:crypto';

export const SEC_PER_MIN = 2;           // 1 minuto de jogo = 2 s reais (partida completa em 3 min)
const MARGIN = 0.06;                    // margem da casa nas odds
const LEAGUES = [
  { id: 'brs', name: 'Liga Nacional Série A', teams: ['Estrela do Norte', 'Real Cerrado', 'Porto Azul', 'União Serrana', 'Tigres da Baía', 'Leões do Sul', 'Ferroviário', 'Atlético Planalto'] },
  { id: 'cop', name: 'Copa Continental', teams: ['Dragões FC', 'Sporting Vale', 'Olímpico', 'Vulcão', 'Náutico Real', 'Guerreiros', 'Corsários', 'Inter Litoral'] },
];
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const strength = (name) => { const h = hash(name); return { att: 0.85 + (h % 61) / 100, def: 0.82 + ((h >> 8) % 41) / 100 }; };
const rand = () => crypto.randomInt(0, 1e9) / 1e9;
const fact = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800];
const pois = (k, l) => Math.exp(-l) * l ** k / fact[k];
const r2 = (n) => Math.round(n * 100) / 100;

export const MARKETS = {
  '1X2': { name: 'Resultado final', picks: { 1: 'Casa', X: 'Empate', 2: 'Fora' } },
  DC: { name: 'Dupla chance', picks: { '1X': 'Casa ou empate', '12': 'Casa ou fora', X2: 'Empate ou fora' } },
  OU25: { name: 'Total de gols', picks: { over: 'Mais de 2,5', under: 'Menos de 2,5' } },
  BTTS: { name: 'Ambos marcam', picks: { yes: 'Sim', no: 'Não' } },
};

export class Sport {
  constructor(store) {
    this.s = store;
    if (!store.d.matches.length) this.seed();
    setInterval(() => this.tick(), 500);
  }
  get matches() { return this.s.d.matches; }

  seed() {
    const now = Date.now();
    // começa já com partidas em andamento e outras agendadas, para a plataforma nunca ficar vazia
    for (let i = 0; i < 3; i++) this.newMatch(now - (20 + i * 25) * SEC_PER_MIN * 1000 * 0.9);
    let t = now + 25000;
    for (let i = 0; i < 12; i++) { this.newMatch(t); t += 40000 + crypto.randomInt(0, 45000); }
    this.tick();
  }
  busy(at) { return new Set(this.matches.filter((m) => m.status !== 'finished' && Math.abs(m.startAt - at) < 200000).flatMap((m) => [m.home, m.away])); }
  newMatch(startAt) {
    const league = LEAGUES[crypto.randomInt(0, LEAGUES.length)];
    const busy = this.busy(startAt), free = league.teams.filter((t) => !busy.has(t));
    if (free.length < 2) return null;
    const home = free.splice(crypto.randomInt(0, free.length), 1)[0], away = free[crypto.randomInt(0, free.length)];
    const H = strength(home), A = strength(away);
    const m = { id: this.s.id('round') + 10000, league: league.id, leagueName: league.name, home, away, startAt: Math.round(startAt), status: 'upcoming', minute: 0, sim: 0, hg: 0, ag: 0, events: [], lh: r2(1.25 * H.att * A.def * 1.08), la: r2(1.25 * A.att * H.def * 0.94), suspendedUntil: 0 };
    this.matches.push(m); this.s.save(); return m;
  }

  tick() {
    const now = Date.now();
    for (const m of this.matches) {
      if (m.status === 'upcoming' && now >= m.startAt) { m.status = 'live'; m.events.push({ min: 0, type: 'start' }); }
      if (m.status === 'live') {
        const minute = Math.min(90, Math.floor((now - m.startAt) / (SEC_PER_MIN * 1000)));
        while (m.sim < minute) {
          m.sim++;
          if (rand() < m.lh / 90) { m.hg++; m.events.push({ min: m.sim, type: 'goal', team: 'home', hg: m.hg, ag: m.ag }); m.suspendedUntil = now + 6000; }
          if (rand() < m.la / 90) { m.ag++; m.events.push({ min: m.sim, type: 'goal', team: 'away', hg: m.hg, ag: m.ag }); m.suspendedUntil = now + 6000; }
          if (m.sim === 45) m.events.push({ min: 45, type: 'half' });
        }
        m.minute = m.sim;
        if (m.minute >= 90) { m.status = 'finished'; m.finishedAt = now; m.events.push({ min: 90, type: 'end' }); this.settleMatch(m); }
      }
    }
    // mantém a grade abastecida
    const up = this.matches.filter((m) => m.status === 'upcoming');
    if (up.length < 10) { const last = Math.max(now, ...this.matches.map((m) => m.startAt)); this.newMatch(last + 40000 + crypto.randomInt(0, 45000)); }
    // descarta partidas antigas já liquidadas (mantém 24)
    const fin = this.matches.filter((m) => m.status === 'finished');
    if (fin.length > 24) { const drop = new Set(fin.slice(0, fin.length - 24).map((m) => m.id)); this.s.d.matches = this.matches.filter((m) => !drop.has(m.id)); }
    this.s.save();
  }

  /** Probabilidades "justas" dado placar e minuto. */
  probs(m) {
    const rem = Math.max(0, 1 - m.minute / 90), lh = m.lh * rem, la = m.la * rem;
    let p1 = 0, pX = 0, p2 = 0, over = 0, btts = 0;
    for (let i = 0; i <= 9; i++) for (let j = 0; j <= 9; j++) {
      const p = pois(i, lh) * pois(j, la), h = m.hg + i, a = m.ag + j;
      if (h > a) p1 += p; else if (h === a) pX += p; else p2 += p;
      if (h + a >= 3) over += p;
      if (h > 0 && a > 0) btts += p;
    }
    const t = p1 + pX + p2;
    p1 /= t; pX /= t; p2 /= t;
    return { '1X2': { 1: p1, X: pX, 2: p2 }, DC: { '1X': p1 + pX, '12': p1 + p2, X2: pX + p2 }, OU25: { over, under: 1 - over }, BTTS: { yes: btts, no: 1 - btts } };
  }
  isOpen(m) {
    if (m.status === 'upcoming') return true;
    return m.status === 'live' && m.minute <= 84 && Date.now() >= m.suspendedUntil;
  }
  /** Odds com margem; 0 = mercado suspenso. */
  odds(m) {
    const pr = this.probs(m), open = this.isOpen(m), out = {};
    for (const [mk, picks] of Object.entries(pr)) {
      out[mk] = {};
      for (const [k, p] of Object.entries(picks)) out[mk][k] = open && p > 0.015 && p < 0.97 ? Math.min(60, Math.max(1.01, r2((1 - MARGIN) / p))) : 0;
    }
    return out;
  }
  view(m) {
    return { id: m.id, league: m.league, leagueName: m.leagueName, home: m.home, away: m.away, startAt: m.startAt, status: m.status, minute: m.minute, hg: m.hg, ag: m.ag, events: m.events.filter((e) => e.type === 'goal').slice(-6), open: this.isOpen(m), odds: this.odds(m) };
  }
  list() { return this.matches.map((m) => this.view(m)); }

  legResult(m, market, pick) {
    const h = m.hg, a = m.ag, t = h + a;
    const win = market === '1X2' ? (pick === '1' ? h > a : pick === 'X' ? h === a : a > h)
      : market === 'DC' ? (pick === '1X' ? h >= a : pick === '12' ? h !== a : a >= h)
      : market === 'OU25' ? (pick === 'over' ? t >= 3 : t <= 2)
      : (pick === 'yes' ? h > 0 && a > 0 : !(h > 0 && a > 0));
    return win ? 'won' : 'lost';
  }
  settleMatch(m) {
    for (const b of this.s.d.bets) {
      if (b.status !== 'open') continue;
      let touched = false;
      for (const l of b.legs) if (l.matchId === m.id && !l.result) { l.result = this.legResult(m, l.market, l.pick); touched = true; }
      if (touched) this.settleBet(b);
    }
  }
  settleBet(b) {
    if (b.legs.some((l) => l.result === 'lost')) { b.status = 'lost'; b.settledAt = Date.now(); b.payout = 0; }
    else if (b.legs.every((l) => l.result === 'won')) {
      b.status = 'won'; b.settledAt = Date.now(); b.payout = Math.round(b.stake * b.legs.reduce((a, l) => a * l.odds, 1));
      this.s.move(this.s.user(b.userId), b.payout, 'win', 'Aposta #' + b.id, { betId: b.id });
    }
    this.s.save();
  }

  /** Registra uma aposta já validada (limites e saldo são checados pelo chamador). */
  place(user, legsIn, stake, type) {
    const legs = [];
    const seen = new Set();
    for (const s of legsIn) {
      const m = this.matches.find((x) => x.id === +s.matchId);
      if (!m || m.status === 'finished') throw Object.assign(new Error('Partida indisponível'), { code: 'MATCH' });
      if (!MARKETS[s.market] || !MARKETS[s.market].picks[s.pick]) throw new Error('Mercado inválido');
      if (type === 'multi' && seen.has(m.id)) throw Object.assign(new Error('Em múltiplas, só uma seleção por partida.'), { code: 'SAME' });
      seen.add(m.id);
      if (!this.isOpen(m)) throw Object.assign(new Error(`Mercado fechado: ${m.home} x ${m.away}`), { code: 'CLOSED' });
      const cur = this.odds(m)[s.market][s.pick];
      if (!cur) throw Object.assign(new Error(`Mercado suspenso: ${m.home} x ${m.away}`), { code: 'CLOSED' });
      if (Math.abs(cur - +s.odds) / cur > 0.05) throw Object.assign(new Error('As odds mudaram.'), { code: 'ODDS', matchId: m.id, market: s.market, pick: s.pick, odds: cur });
      legs.push({ matchId: m.id, home: m.home, away: m.away, market: s.market, pick: s.pick, odds: cur, result: null, minuteAt: m.minute, scoreAt: `${m.hg}-${m.ag}`, live: m.status === 'live' });
    }
    return legs;
  }
  cashoutValue(b) {
    if (b.status !== 'open' || b.legs.length !== 1) return null;
    const l = b.legs[0], m = this.matches.find((x) => x.id === l.matchId);
    if (!m || m.status === 'finished' || !this.isOpen(m)) return null;
    const p = this.probs(m)[l.market][l.pick];
    const v = Math.round(b.stake * l.odds * p * 0.95);
    return v >= 1 ? v : null;
  }
}
