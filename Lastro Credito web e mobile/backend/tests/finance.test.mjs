// Testes unitários das regras financeiras (sem banco).
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, schedule, pmt, periodRate, lateCharges, payoff, amortize, renegotiate, parseDate, noon, r2 } from '../src/lib/finance.js';
import { brcode, validBrcode, crc16 } from '../src/lib/pix.js';
import { isValidCpf, genCpf, totp, verifyTotp, encrypt, decrypt, hashPassword, verifyPassword, signJwt, verifyJwt } from '../src/lib/crypto.js';

const START = new Date(Date.UTC(2026, 0, 15, 12));

test('Price: parcela de R$ 10.000 em 12x a 3% a.m. ≈ R$ 1.004,62', () => {
  const p = pmt(10000, 0.03, 12); assert.ok(Math.abs(p - 1004.62) < 0.01, `pmt=${p}`);
});
test('cronograma fecha: soma das amortizações = principal e saldo final = 0', () => {
  const s = schedule({ financed: 10000, monthlyRate: 3, term: 12, periodicity: 'mensal', start: noon(START) });
  assert.equal(r2(s.rows.reduce((a, r) => a + r.principal, 0)), 10000); assert.equal(s.rows.at(-1).balance_after, 0);
  assert.equal(s.rows[0].due_date, '2026-02-15'); assert.equal(s.rows[11].due_date, '2027-01-15');
});
test('vencimento mensal respeita fim de mês (31/01 → 28/02)', () => {
  const s = schedule({ financed: 1000, monthlyRate: 2, term: 2, periodicity: 'mensal', start: noon(new Date(Date.UTC(2026, 0, 31, 12))) });
  assert.equal(s.rows[0].due_date, '2026-02-28'); assert.equal(s.rows[1].due_date, '2026-03-31');
});
test('periodicidades: taxa semanal e diária equivalentes à mensal (juros compostos)', () => {
  const m = periodRate(4.2, 'mensal'), w = periodRate(4.2, 'semanal'), d = periodRate(4.2, 'diaria');
  assert.ok(Math.abs(Math.pow(1 + w, 30 / 7) - 1 - m) < 1e-9); assert.ok(Math.abs(Math.pow(1 + d, 30) - 1 - m) < 1e-9);
});
test('semanal e diária geram vencimentos a cada 7 e 1 dia', () => {
  assert.equal(schedule({ financed: 1000, monthlyRate: 4, term: 3, periodicity: 'semanal', start: noon(START) }).rows.map((r) => r.due_date).join(), '2026-01-22,2026-01-29,2026-02-05');
  assert.equal(schedule({ financed: 500, monthlyRate: 5, term: 3, periodicity: 'diaria', start: noon(START) }).rows.map((r) => r.due_date).join(), '2026-01-16,2026-01-17,2026-01-18');
});
test('simulação: IOF positivo, CET > taxa nominal e total consistente', () => {
  const s = simulate({ principal: 8000, term: 12, periodicity: 'mensal', monthlyRate: 3.49, start: START });
  assert.ok(s.iof > 0 && s.iof < 8000 * 0.05, `iof ${s.iof}`); assert.ok(s.cet > 3.49, `cet ${s.cet}`);
  assert.equal(s.total, r2(s.rows.reduce((a, r) => a + r.amount, 0))); assert.equal(s.financed, r2(8000 + s.iof));
  assert.equal(s.rows.length, 12); assert.ok(s.total > 8000);
});
test('sem IOF o CET aproxima a taxa nominal', () => {
  const s = simulate({ principal: 5000, term: 10, periodicity: 'mensal', monthlyRate: 3, start: START, withIof: false });
  assert.ok(Math.abs(s.cet - 3) < 0.15, `cet ${s.cet}`);
});
test('encargos de atraso: multa 2% + juros 1% a.m. pro rata', () => {
  const c = lateCharges(1000, 15); assert.equal(c.fine, 20); assert.equal(c.interest, 5); assert.equal(c.total, 1025);
  assert.deepEqual(lateCharges(1000, 0), { fine: 0, interest: 0, total: 1000 });
});
test('quitação antecipada: abate juros futuros (valor < soma das parcelas) e inclui encargos do atraso', () => {
  const s = schedule({ financed: 6000, monthlyRate: 3, term: 6, periodicity: 'mensal', start: noon(new Date(Date.UTC(2026, 0, 1, 12))) });
  const inst = s.rows.map((r) => ({ ...r, status: 'aberta', paid_amount: 0 }));
  const today = new Date(Date.UTC(2026, 1, 10, 12));
  const p = payoff({ installments: inst, monthlyRate: 3, periodicity: 'mensal', today });
  assert.ok(p.payoffToday < s.rows.reduce((a, r) => a + r.amount, 0)); assert.ok(p.payoffToday > p.outstanding * 0.9); assert.ok(p.overdue > 0 && p.fines > 0);
});
test('amortização extraordinária reduz parcelas e mantém prazo', () => {
  const s = schedule({ financed: 6000, monthlyRate: 3, term: 6, periodicity: 'mensal', start: noon(START) });
  const out = amortize({ openRows: s.rows, amount: 2000, monthlyRate: 3, periodicity: 'mensal' });
  assert.equal(out.length, 6); assert.ok(out[0].amount < s.rows[0].amount); assert.equal(out.at(-1).balance_after, 0);
  assert.equal(r2(out.reduce((a, r) => a + r.principal, 0)), 4000);
});
test('renegociação: desconto, entrada e parcelas', () => {
  const r = renegotiate({ balanceWithCharges: 5000, discountPct: 10, downPayment: 500, terms: 6, monthlyRate: 3 });
  assert.equal(r.discount, 500); assert.equal(r.financed, 4000); assert.ok(r.installment > 4000 / 6);
});
test('BR Code Pix: CRC16 válido, valor e txid no payload', () => {
  const c = brcode({ key: 'sandbox@lastro.dev', amount: 1234.56, name: 'LASTRO CRÉDITO', city: 'São Paulo', txid: 'LST123' });
  assert.ok(validBrcode(c)); assert.ok(c.includes('5407' + '1234.56')); assert.ok(c.includes('LST123')); assert.ok(c.startsWith('000201')); assert.equal(crc16('123456789'), '29B1');
});
test('CPF: validação e geração sintética única', () => {
  assert.ok(isValidCpf('529.982.247-25')); assert.ok(!isValidCpf('111.111.111-11')); assert.ok(!isValidCpf('529.982.247-24'));
  const set = new Set(Array.from({ length: 200 }, (_, i) => genCpf(i))); assert.equal(set.size, 200); for (const c of set) assert.ok(isValidCpf(c));
});
test('TOTP RFC 6238: vetor de teste (SHA-1, 59s → 94287082 → 287082)', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; assert.equal(totp(secret, 59000), '287082'); assert.ok(verifyTotp('JBSWY3DPEHPK3PXP', totp('JBSWY3DPEHPK3PXP')));
});
test('criptografia AES-GCM, hash de senha e JWT', () => {
  const e = encrypt('123.456.789-09'); assert.notEqual(e, '123.456.789-09'); assert.equal(decrypt(e), '123.456.789-09');
  const t = Buffer.from(e, 'base64'); t[t.length - 1] ^= 1; assert.throws(() => decrypt(t.toString('base64')));       // adulteração é detectada
  const h = hashPassword('Senha-Forte-123'); assert.ok(verifyPassword('Senha-Forte-123', h)); assert.ok(!verifyPassword('outra', h));
  const jwt = signJwt({ uid: 1 }, 60); assert.equal(verifyJwt(jwt).uid, 1); assert.equal(verifyJwt(jwt.slice(0, -2) + 'xx'), null); assert.equal(verifyJwt(signJwt({ uid: 1 }, -5)), null);
});
