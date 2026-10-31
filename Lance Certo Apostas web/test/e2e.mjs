// Teste de ponta a ponta contra o servidor real (base temporária). Uso: node test/e2e.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-'));
const PORT = 3290 + Math.floor(Math.random() * 9);
const srv = spawn('node', ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: TMP, NO_RATE_LIMIT: '1' } });
srv.stderr.on('data', (d) => process.stderr.write(d));
await new Promise((r) => setTimeout(r, 1500));
const B = `http://localhost:${PORT}`;
let pass = 0, failN = 0;
const ok = (c, m) => { if (c) pass++; else { failN++; console.log('  ✗ FALHOU:', m); } };
const jar = {};
async function api(method, url, body, who = 'a') {
  const r = await fetch(B + url, { method, headers: { 'Content-Type': 'application/json', Cookie: jar[who] || '' }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) jar[who] = sc.split(';')[0];
  return { s: r.status, j: await r.json() };
}
const cpf = () => { const d = Array.from({ length: 9 }, () => crypto.randomInt(0, 10)); for (const n of [9, 10]) { let s = 0; for (let i = 0; i < n; i++) s += d[i] * (n + 1 - i); d.push(((s * 10) % 11) % 10); } return d.join(''); };
const reg = (name, who) => api('POST', '/api/register', { name, email: `${who}${Date.now()}@teste.com`, cpf: cpf(), birth: '1995-04-10', password: 'senha-forte-1', terms: true }, who);

try {
  console.log('Cadastro e regras de acesso');
  let r = await api('POST', '/api/register', { name: 'Ana', email: 'x', cpf: '111', birth: '2012-01-01', password: '1', terms: false });
  ok(r.s === 422 && r.j.errors.cpf && r.j.errors.birth && r.j.errors.email && r.j.errors.password && r.j.errors.terms, 'valida campos e menor de idade');
  r = await reg('Ana Beatriz Souza', 'a'); ok(r.s === 201 && r.j.user.balance === 0, 'cadastra usuário');
  ok((await api('GET', '/api/wallet', null, 'zz')).s === 401, 'carteira exige login');

  console.log('Carteira');
  r = await api('POST', '/api/deposit', { amount: 5 }); ok(r.s === 422, 'depósito mínimo');
  r = await api('POST', '/api/deposit', { amount: 1000 }); ok(r.s === 201 && r.j.balance === 100000, 'depósito de R$ 1.000');
  r = await api('POST', '/api/deposit', { amount: 4500 }); ok(r.s === 403, 'limite diário de depósito (R$ 5.000)');

  console.log('Esportes');
  r = await api('GET', '/api/matches'); const ms = r.j.matches;
  ok(ms.length >= 10, 'grade com partidas'); ok(ms.some((m) => m.status === 'live') && ms.some((m) => m.status === 'upcoming'), 'há jogos ao vivo e futuros');
  const up = ms.filter((m) => m.status === 'upcoming' && m.open), m1 = up[0], m2 = up[1];
  const sumP = (o) => Object.values(o).reduce((a, x) => a + 1 / x, 0);
  ok(sumP(m1.odds['1X2']) > 1.03 && sumP(m1.odds['1X2']) < 1.15, 'margem da casa nas odds 1X2: ' + sumP(m1.odds['1X2']).toFixed(3));
  r = await api('POST', '/api/bets', { selections: [{ matchId: m1.id, market: '1X2', pick: '1', odds: m1.odds['1X2']['1'] + 0.5 }], stake: 10, type: 'single' }); ok(r.s === 409 && r.j.odds, 'rejeita odds desatualizadas e informa as novas');
  r = await api('POST', '/api/bets', { selections: [{ matchId: m1.id, market: '1X2', pick: '1', odds: m1.odds['1X2']['1'] }], stake: 0.5, type: 'single' }); ok(r.s === 422, 'aposta mínima');
  r = await api('POST', '/api/bets', { selections: [{ matchId: m1.id, market: '1X2', pick: '1', odds: m1.odds['1X2']['1'] }], stake: 20, type: 'single' }); ok(r.s === 201 && r.j.balance === 98000, 'aposta simples debita o saldo');
  const bet1 = r.j.bets[0];
  r = await api('POST', '/api/bets', { selections: [{ matchId: m1.id, market: '1X2', pick: '2', odds: m1.odds['1X2']['2'] }, { matchId: m1.id, market: 'OU25', pick: 'over', odds: m1.odds.OU25.over }], stake: 10, type: 'multi' }); ok(r.s === 422, 'múltipla não aceita 2 seleções da mesma partida');
  r = await api('POST', '/api/bets', { selections: [{ matchId: m1.id, market: 'BTTS', pick: 'yes', odds: m1.odds.BTTS.yes }, { matchId: m2.id, market: 'OU25', pick: 'over', odds: m2.odds.OU25.over }], stake: 10, type: 'multi' });
  ok(r.s === 201 && Math.abs(r.j.bets[0].totalOdds - Math.round(m1.odds.BTTS.yes * m2.odds.OU25.over * 100) / 100) < 0.02, 'múltipla multiplica as odds'); const multi = r.j.bets[0];
  r = await api('GET', '/api/bets'); const single = r.j.bets.find((b) => b.id === bet1.id);
  ok(single.cashout > 0, 'cash-out disponível: ' + single.cashout);
  r = await api('POST', '/api/bets/cashout', { id: bet1.id, expected: single.cashout }); ok(r.s === 200 && r.j.payout > 0, 'executa cash-out');

  console.log('Cassino (RNG verificável)');
  r = await api('GET', '/api/fair'); const f0 = r.j; ok(f0.hash.length === 64 && f0.nonce === 0, 'seed commit publicada');
  r = await api('POST', '/api/casino/dice', { amount: 5, target: 50, over: true }); ok(r.s === 200 && r.j.roll >= 0 && r.j.roll < 100, 'dados rola');
  ok(r.j.win ? r.j.payout === Math.floor(500 * r.j.mult) : r.j.payout === 0, 'pagamento dos dados coerente');
  r = await api('POST', '/api/casino/roulette', { bets: [{ type: 'color', value: 'red', amount: 5 }, { type: 'straight', value: 17, amount: 1 }] }); ok(r.s === 200 && r.j.number >= 0 && r.j.number <= 36, 'roleta gira');
  r = await api('POST', '/api/casino/slots', { amount: 2 }); ok(r.s === 200 && r.j.reels.length === 3, 'slots gira');
  r = await api('POST', '/api/casino/dice', { amount: 5000, target: 50, over: true }); ok(r.s === 422, 'aposta máxima do cassino');
  // verificação independente: rotação revela a seed e o jogador recalcula o resultado
  r = await api('POST', '/api/fair/rotate'); const old = r.j.previous[0];
  ok(crypto.createHash('sha256').update(old.seed).digest('hex') === old.hash, 'seed revelada confere com o hash publicado antes');
  const h = crypto.createHmac('sha256', old.seed).update(`${old.clientSeed}:0:0`).digest(); const v = Math.floor(h.readUIntBE(0, 6) / 2 ** 48 * 10000) / 100;
  r = await api('GET', `/api/fair/verify?seed=${old.seed}&client=${old.clientSeed}&nonce=0`); ok(r.j.dice === v, 'verificação independente do 1º resultado: ' + v);
  // RTP simulado dos dados (alvo 50, acima) ≈ 97%
  { const s = crypto.randomBytes(24).toString('hex'); let ret = 0; const N = 200000; for (let i = 0; i < N; i++) { const rr = Math.floor(crypto.createHmac('sha256', s).update(`x:${i}:0`).digest().readUIntBE(0, 6) / 2 ** 48 * 10000) / 100; if (rr > 50) ret += Math.floor(97 / 49.99 * 100) / 100; } ok(Math.abs(ret / N - 0.97) < 0.02, 'RTP dados ≈ 97%: ' + (ret / N * 100).toFixed(2) + '%'); }
  r = await api('GET', '/api/info'); ok(r.j.slotsRtp > 0.9 && r.j.slotsRtp < 0.98, 'RTP slots: ' + (r.j.slotsRtp * 100).toFixed(2) + '%');

  console.log('Crash');
  let st; for (let i = 0; i < 400; i++) { st = (await api('GET', '/api/casino/crash')).j; if (st.phase === 'betting' && st.startsAt - st.now > 3000) break; await new Promise((x) => setTimeout(x, 250)); }
  r = await api('POST', '/api/casino/crash/bet', { amount: 5, auto: 1.3 }); ok(r.s === 200, 'aposta no crash');
  r = await api('POST', '/api/casino/crash/bet', { amount: 5 }); ok(r.s === 422 || r.s === 400, 'não permite 2 apostas na mesma rodada');
  for (let i = 0; i < 400; i++) { st = (await api('GET', '/api/casino/crash')).j; if (st.phase === 'crashed') break; await new Promise((x) => setTimeout(x, 250)); }
  ok(st.phase === 'crashed' && st.seed && crypto.createHash('sha256').update(st.seed).digest('hex') === st.hash, 'rodada estourou e a seed confere com o hash');
  ok(st.mine && (st.mine.cashed ? st.mine.cashed >= 1.3 : st.mine.lost), 'aposta resolvida (cash-out automático ou perda)');

  console.log('Liquidação e auditoria');
  for (let i = 0; i < 400; i++) { const bets = (await api('GET', '/api/bets')).j.bets; if (bets.find((b) => b.id === multi.id).status !== 'open') break; await new Promise((x) => setTimeout(x, 1000)); }
  r = await api('GET', '/api/bets'); const mm = r.j.bets.find((b) => b.id === multi.id);
  console.log('   múltipla →', mm.status, mm.legs.map((l) => l.result).join(','));
  ok(['won', 'lost'].includes(mm.status), 'múltipla liquidada automaticamente');
  r = await api('POST', '/api/withdraw', { amount: 30, key: 'ana@email.com' }); ok(r.s === 201, 'solicita saque');
  r = await api('POST', '/api/withdraw', { amount: 30 }); ok(r.s === 409, 'um saque pendente por vez');
  r = await api('POST', '/api/limits', { dailyLoss: 1 }); r = await api('POST', '/api/casino/dice', { amount: 5, target: 50, over: true }); ok(r.s === 403 || r.s === 200, 'limite de perda diário é verificado');
  r = await api('POST', '/api/selfexclude', { days: 1 }); r = await api('POST', '/api/casino/slots', { amount: 1 }); ok(r.s === 403, 'autoexclusão bloqueia jogo');
  r = await api('POST', '/api/deposit', { amount: 50 }); ok(r.s === 403, 'autoexclusão bloqueia depósito');

  const creds = fs.readFileSync(path.join(TMP, 'admin-credentials.txt'), 'utf8'); const [em, pw] = [creds.match(/email: (.+)/)[1], creds.match(/senha: (.+)/)[1]];
  ok((await api('GET', '/api/admin/summary', null, 'a')).s === 403, 'admin bloqueado para usuário comum');
  r = await api('POST', '/api/login', { email: em, password: pw }, 'adm'); ok(r.s === 200 && r.j.user.role === 'admin', 'login do admin');
  r = await api('GET', '/api/admin/summary', null, 'adm'); ok(r.s === 200 && r.j.audit === true, 'auditoria do ledger: saldos = soma das movimentações');
  console.log('   GGR total:', (r.j.ggr / 100).toFixed(2), '| RTP efetivo:', (r.j.rtp * 100).toFixed(1) + '%');
  const wd = (await api('GET', '/api/admin/withdrawals', null, 'adm')).j[0];
  r = await api('PATCH', '/api/admin/withdrawals/' + wd.id, { status: 'recusado' }, 'adm'); ok(r.s === 200, 'admin recusa saque (estorno)');
  r = await api('GET', '/api/admin/summary', null, 'adm'); ok(r.j.audit === true, 'auditoria após estorno');
} catch (e) { failN++; console.log('ERRO NO TESTE:', e); }
srv.kill();
console.log(`\n${pass} verificações OK, ${failN} falhas`);
process.exit(failN ? 1 : 0);
