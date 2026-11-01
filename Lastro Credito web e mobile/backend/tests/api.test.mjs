// Testes de integração de ponta a ponta contra a API real + PostgreSQL (base temporária com dados de demonstração).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lastro-test-'));
Object.assign(process.env, { PG_DATA_DIR: path.join(TMP, 'pg'), PGPORT: '54331', NO_RATE_LIMIT: '1', FIXED_OTP: '123456', ALLOW_ANY_HOUR: '1', PORT: '3399' });
const { createServer } = await import('../src/server.js');
const { DEMO } = await import('../src/seed.js');
const { totp, genCpf, decrypt } = await import('../src/lib/crypto.js');
const { signWebhook } = await import('../src/lib/pix.js');
const { one, all, q } = await import('../src/db.js');
const { sandboxPsp } = await import('../src/lib/pix.js');
let srv, B;

const call = async (method, url, { token, body, raw } = {}) => {
  const r = await fetch(B + url, { method, headers: { ...(body || raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  const ct = r.headers.get('content-type') || ''; return { s: r.status, j: ct.includes('json') ? await r.json() : null, buf: ct.includes('pdf') ? Buffer.from(await r.arrayBuffer()) : null, h: r.headers };
};
const login = async (email, password = DEMO.password) => { const r = await call('POST', '/api/auth/login', { body: { email, password } }); if (r.j.mfa_required) { const m = await call('POST', '/api/auth/mfa', { body: { mfa_token: r.j.mfa_token, code: totp(DEMO.adminTotpSecret) } }); return m.j; } return r.j; };

before(async () => { srv = await createServer({ port: 3399, reset: true }); B = 'http://localhost:3399'; });
after(async () => { await srv.close(); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {} });

test('dados de demonstração coerentes', async () => {
  const n = await one(`SELECT (SELECT COUNT(*) FROM customers)::int AS c, (SELECT COUNT(*) FROM loans)::int AS l, (SELECT COUNT(*) FROM payments)::int AS p, (SELECT COUNT(*) FROM fraud_alerts)::int AS f, (SELECT COUNT(*) FROM collection_cases WHERE closed_at IS NULL)::int AS cc`);
  assert.ok(n.c >= 35 && n.l >= 30 && n.p > 100 && n.f >= 6 && n.cc >= 5, JSON.stringify(n));
  const bad = await one(`SELECT COUNT(*)::int AS n FROM loans l WHERE l.status='ativo' AND ABS(l.total_amount - (SELECT SUM(amount) FROM installments i WHERE i.loan_id=l.id)) > 0.05`); assert.equal(bad.n, 0, 'total do contrato = soma das parcelas');
});
test('CPF e documentos sensíveis ficam criptografados no banco', async () => {
  const c = await one(`SELECT cpf_enc, cpf_idx FROM customers WHERE id=1`); assert.ok(!/\d{3}\.?\d{3}\.?\d{3}/.test(c.cpf_enc)); assert.match(decrypt(c.cpf_enc), /^\d{11}$/); assert.equal(c.cpf_idx.length, 64);
});

test('autenticação: login, senha errada genérica, bloqueio após 5 tentativas', async () => {
  assert.equal((await call('POST', '/api/auth/login', { body: { email: DEMO.clientEmail, password: 'errada-12345' } })).s, 401);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'naoexiste@x.com', password: 'qualquer-12345' } })).s, 401);
  for (let i = 0; i < 5; i++) await call('POST', '/api/auth/login', { body: { email: 'letícia'.length ? 'bruno.carvalho3@exemplo.com.br' : '', password: 'errada-12345' } });
  const locked = await call('POST', '/api/auth/login', { body: { email: 'bruno.carvalho3@exemplo.com.br', password: DEMO.password } }); assert.equal(locked.s, 429);
  const ok = await login(DEMO.clientEmail); assert.ok(ok.access_token && ok.refresh_token);
});
test('rotas protegidas exigem token e perfil', async () => {
  assert.equal((await call('GET', '/api/me')).s, 401); assert.equal((await call('GET', '/api/admin/dashboard')).s, 401);
  const cl = await login(DEMO.clientEmail); assert.equal((await call('GET', '/api/admin/dashboard', { token: cl.access_token })).s, 403);
  const st = await login(DEMO.staffEmail); assert.equal((await call('GET', '/api/admin/users', { token: st.access_token })).s, 403, 'staff não gerencia usuários');
  assert.equal((await call('GET', '/api/admin/dashboard', { token: st.access_token })).s, 200);
  assert.equal((await call('GET', '/api/me', { token: 'x.y.z' })).s, 401);
});
test('2FA: admin exige código TOTP', async () => {
  const r = await call('POST', '/api/auth/login', { body: { email: DEMO.adminEmail, password: DEMO.password } }); assert.equal(r.j.mfa_required, true); assert.equal(r.j.access_token, undefined);
  assert.equal((await call('POST', '/api/auth/mfa', { body: { mfa_token: r.j.mfa_token, code: '000000' } })).s, 401);
  const ok = await call('POST', '/api/auth/mfa', { body: { mfa_token: r.j.mfa_token, code: totp(DEMO.adminTotpSecret) } }); assert.equal(ok.s, 200); assert.ok(ok.j.access_token);
});
test('refresh token com rotação e revogação de sessão', async () => {
  const s = await login(DEMO.clientEmail); const r1 = await call('POST', '/api/auth/refresh', { body: { refresh_token: s.refresh_token } }); assert.equal(r1.s, 200);
  assert.equal((await call('POST', '/api/auth/refresh', { body: { refresh_token: s.refresh_token } })).s, 401, 'token antigo não funciona mais');
  const sessions = await call('GET', '/api/auth/sessions', { token: s.access_token }); assert.ok(sessions.j.sessions.length >= 1);
  assert.equal((await call('POST', '/api/auth/logout', { token: s.access_token })).s, 200); assert.equal((await call('GET', '/api/me', { token: s.access_token })).s, 401, 'sessão encerrada invalida o access token');
});
test('cadastro de cliente + confirmação de telefone + recuperação de senha', async () => {
  const cpf = genCpf(9001), email = 'novo.cliente@exemplo.com.br';
  const bad = await call('POST', '/api/auth/register', { body: { name: 'A', cpf: '111.111.111-11', email: 'x', phone: '1', password: '123', consent_terms: false } }); assert.equal(bad.s, 422); assert.ok(bad.j.errors.cpf && bad.j.errors.email && bad.j.errors.password && bad.j.errors.consent_terms);
  const r = await call('POST', '/api/auth/register', { body: { name: 'Novo Cliente Teste', cpf, email, phone: '(11) 98877-6655', password: 'Senha-Forte-2026', consent_terms: true, consent_marketing: false } }); assert.equal(r.s, 201);
  assert.equal((await call('POST', '/api/auth/register', { body: { name: 'Outro Nome Teste', cpf, email: 'outro@x.com', phone: '11988776655', password: 'Senha-Forte-2026', consent_terms: true } })).j.errors.cpf.includes('já possui'), true, 'CPF duplicado');
  assert.ok((await one(`SELECT 1 FROM fraud_alerts WHERE rule='CPF_DUPLICATE_ATTEMPT' AND evidence->>'email'='outro@x.com'`)), 'tentativa duplicada gera alerta antifraude');
  const tok = r.j.access_token; assert.equal((await call('POST', '/api/auth/phone/verify', { token: tok, body: { code: '000000' } })).s, 400); assert.equal((await call('POST', '/api/auth/phone/verify', { token: tok, body: { code: '123456' } })).s, 200);
  assert.equal((await call('GET', '/api/me', { token: tok })).j.user.phone_verified, true);
  assert.equal((await call('POST', '/api/auth/forgot', { body: { email: 'inexistente@x.com' } })).s, 200, 'não revela se a conta existe'); await call('POST', '/api/auth/forgot', { body: { email } });
  assert.equal((await call('POST', '/api/auth/reset', { body: { email, code: '123456', password: 'curta' } })).s, 422);
  assert.equal((await call('POST', '/api/auth/reset', { body: { email, code: '123456', password: 'NovaSenha-2026-x' } })).s, 200);
  assert.equal((await call('GET', '/api/me', { token: tok })).s, 401, 'sessões antigas encerradas após redefinição'); assert.ok((await call('POST', '/api/auth/login', { body: { email, password: 'NovaSenha-2026-x' } })).j.access_token);
});

test('simulação de empréstimo e validações', async () => {
  const t = (await login(DEMO.clientEmail)).access_token;
  const s = await call('POST', '/api/simulate', { token: t, body: { amount: 10000, term: 12, periodicity: 'mensal' } }); assert.equal(s.s, 200); assert.equal(s.j.rows.length, 12); assert.ok(s.j.cet > s.j.monthlyRate); assert.ok(s.j.iof > 0);
  assert.equal((await call('POST', '/api/simulate', { token: t, body: { amount: 50, term: 12 } })).s, 422); assert.equal((await call('POST', '/api/simulate', { token: t, body: { amount: 2000, term: 4, periodicity: 'diaria' } })).s, 200);
  assert.equal((await call('POST', '/api/simulate', { token: t, body: { amount: 2000, term: 4, periodicity: 'anual' } })).s, 422);
});

let flow = {};
test('fluxo completo: solicitação → antifraude → aprovação (alçada) → contrato → assinatura → desembolso', async () => {
  const c = await login(DEMO.clientEmail), st = await login(DEMO.staffEmail), ad = await login(DEMO.adminEmail);
  const req = await call('POST', '/api/loans', { token: c.access_token, body: { amount: 25000, term: 24, periodicity: 'mensal', purpose: 'Capital de giro' } }); assert.equal(req.s, 201, JSON.stringify(req.j)); flow.id = req.j.loan.id;
  assert.equal((await call('POST', '/api/loans', { token: c.access_token, body: { amount: 1000, term: 5, periodicity: 'mensal' } })).s, 422, 'só uma solicitação em andamento');
  assert.equal((await call('POST', `/api/admin/loans/${flow.id}/decision`, { token: st.access_token, body: { decision: 'aprovado' } })).s, 403, 'alçada: staff não aprova acima de R$ 15 mil');
  assert.equal((await call('POST', `/api/admin/loans/${flow.id}/decision`, { token: ad.access_token, body: { decision: 'recusado' } })).s, 422, 'recusa exige motivo');
  const ap = await call('POST', `/api/admin/loans/${flow.id}/decision`, { token: ad.access_token, body: { decision: 'aprovado', note: 'Renda e histórico compatíveis.' } }); assert.equal(ap.s, 200, JSON.stringify(ap.j));
  const pdf = await call('GET', `/api/loans/${flow.id}/contract.pdf`, { token: c.access_token }); assert.equal(pdf.s, 200); assert.equal(pdf.buf.subarray(0, 5).toString(), '%PDF-'); assert.ok(pdf.buf.length > 5000);
  assert.equal((await call('POST', `/api/loans/${flow.id}/sign`, { token: c.access_token, body: { accept: false } })).s, 422);
  const sg = await call('POST', `/api/loans/${flow.id}/sign`, { token: c.access_token, body: { accept: true } }); assert.equal(sg.s, 200); assert.ok(sg.j.hash.length === 64);
  assert.equal((await call('POST', `/api/loans/${flow.id}/sign`, { token: c.access_token, body: { accept: true } })).s, 422, 'não assina duas vezes');
  const d = await call('GET', `/api/loans/${flow.id}`, { token: c.access_token }); assert.equal(d.j.loan.status, 'ativo'); assert.equal(d.j.installments.length, 24); assert.ok(d.j.contract.signed_at);
  assert.equal(d.j.contract.doc_sha256.length, 64);
});
test('Pix sandbox: cobrança, BR Code, webhook assinado, conciliação idempotente e recibo', async () => {
  const c = await login(DEMO.clientEmail);
  const ch = await call('POST', `/api/loans/${flow.id}/pix`, { token: c.access_token, body: { kind: 'parcela' } }); assert.equal(ch.s, 201); assert.ok(ch.j.brcode.startsWith('000201')); assert.ok(ch.j.qr_svg.includes('<svg')); assert.equal(ch.j.sandbox, true);
  const { validBrcode } = await import('../src/lib/pix.js'); assert.ok(validBrcode(ch.j.brcode));
  const ev = JSON.stringify({ type: 'pix.paid', txid: ch.j.txid, amount: Number(ch.j.amount), endToEndId: 'E123', sandbox: true });
  assert.equal((await call('POST', '/webhooks/pix', { raw: ev })).s, 401, 'webhook sem assinatura é rejeitado');
  const wrong = JSON.stringify({ type: 'pix.paid', txid: ch.j.txid, amount: Number(ch.j.amount) - 10, endToEndId: 'E1', sandbox: true });
  const bad = await fetch(B + '/webhooks/pix', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': signWebhook(wrong) }, body: wrong }); assert.equal(bad.status, 409, 'valor divergente não baixa');
  assert.ok(await one(`SELECT 1 FROM fraud_alerts WHERE rule='PIX_AMOUNT_MISMATCH'`)); assert.equal((await call('GET', `/api/pix/${ch.j.txid}`, { token: c.access_token })).j.status, 'pendente');
  const paid = await call('POST', `/api/sandbox/pix/${ch.j.txid}/pay`, { token: c.access_token }); assert.equal(paid.s, 200); assert.equal(paid.j.paid, true);
  const again = await call('POST', `/api/sandbox/pix/${ch.j.txid}/pay`, { token: c.access_token }); assert.equal(again.j.duplicate, true, 'baixa idempotente');
  const d = await call('GET', `/api/loans/${flow.id}`, { token: c.access_token }); assert.equal(d.j.installments[0].status, 'paga'); assert.equal(d.j.payments.length, 1); assert.equal(d.j.payments[0].sandbox, true);
  const rc = await call('GET', `/api/payments/${d.j.payments[0].id}/receipt.pdf`, { token: c.access_token }); assert.equal(rc.s, 200); assert.equal(rc.buf.subarray(0, 5).toString(), '%PDF-');
  const other = await login('rodrigo.mendona1@exemplo.com.br').catch(() => null); const anyOther = await one(`SELECT u.email FROM users u JOIN customers c ON c.user_id=u.id WHERE u.id<>(SELECT id FROM users WHERE email=$1) AND u.role='client' LIMIT 1`, [DEMO.clientEmail]);
  const o = await login(anyOther.email); assert.equal((await call('GET', `/api/payments/${d.j.payments[0].id}/receipt.pdf`, { token: o.access_token })).s, 404, 'cliente não acessa recibo alheio'); assert.equal((await call('GET', `/api/loans/${flow.id}`, { token: o.access_token })).s, 404, 'nem empréstimo alheio');
});
test('quitação e amortização: regras de valor', async () => {
  const c = await login(DEMO.clientEmail); const d = await call('GET', `/api/loans/${flow.id}`, { token: c.access_token });
  assert.ok(d.j.payoff.payoffToday < d.j.installments.reduce((a, i) => a + (i.status === 'paga' ? 0 : Number(i.amount)), 0), 'quitação < soma das parcelas (desconto de juros)');
  assert.equal((await call('POST', `/api/loans/${flow.id}/pix`, { token: c.access_token, body: { kind: 'amortizacao', amount: 10 } })).s, 422);
  const am = await call('POST', `/api/loans/${flow.id}/pix`, { token: c.access_token, body: { kind: 'amortizacao', amount: 3000 } }); assert.equal(am.s, 201); await call('POST', `/api/sandbox/pix/${am.j.txid}/pay`, { token: c.access_token });
  const d2 = await call('GET', `/api/loans/${flow.id}`, { token: c.access_token }); assert.ok(Number(d2.j.installments[5].amount) < Number(d.j.installments[5].amount), 'parcela futura diminui');
  const q2 = await call('POST', `/api/loans/${flow.id}/pix`, { token: c.access_token, body: { kind: 'quitacao' } }); await call('POST', `/api/sandbox/pix/${q2.j.txid}/pay`, { token: c.access_token });
  assert.equal((await call('GET', `/api/loans/${flow.id}`, { token: c.access_token })).j.loan.status, 'quitado');
});

test('antifraude: alertas das fixtures e bloqueio de aprovação com alerta alto', async () => {
  const ad = await login(DEMO.adminEmail), f = await call('GET', '/api/admin/fraud', { token: ad.access_token }); const rules = new Set(f.j.alerts.map((a) => a.rule));
  for (const r of ['PHONE_SHARED', 'PHONE_UNVERIFIED', 'DOC_MISMATCH', 'DOC_REUSED', 'DOC_SUSPECT', 'ADDRESS_MISMATCH', 'INCOME_RATIO', 'DELINQUENCY', 'CPF_DUPLICATE_ATTEMPT']) assert.ok(rules.has(r), 'regra ' + r);
  const loan = await one(`SELECT l.id FROM loans l JOIN fraud_alerts a ON a.customer_id=l.customer_id AND a.severity='alta' AND a.status IN ('aberto','em_analise') WHERE l.status IN ('pendente','em_analise') LIMIT 1`);
  const r = await call('POST', `/api/admin/loans/${loan.id}/decision`, { token: ad.access_token, body: { decision: 'aprovado' } }); assert.equal(r.s, 422); assert.match(r.j.error, /antifraude|identidade/i);
  const a = f.j.alerts.find((x) => x.rule === 'DOC_MISMATCH'); assert.equal((await call('POST', `/api/admin/fraud/${a.id}/review`, { token: ad.access_token, body: { status: 'descartado' } })).s, 422, 'revisão exige justificativa');
  assert.equal((await call('POST', `/api/admin/fraud/${a.id}/review`, { token: ad.access_token, body: { status: 'confirmado', note: 'Nome divergente confirmado.' } })).s, 200);
});
test('cobrança: contato respeita consentimento, registra histórico e proposta de acordo é aceita', async () => {
  const st = await login(DEMO.staffEmail); const cs = await call('GET', '/api/admin/collections', { token: st.access_token }); assert.ok(cs.j.cases.length >= 5);
  const noConsent = cs.j.cases.find((x) => x.consent_contact === false), withConsent = cs.j.cases.find((x) => x.consent_contact === true);
  if (noConsent) assert.equal((await call('POST', `/api/admin/collections/${noConsent.id}/contact`, { token: st.access_token, body: { channel: 'whatsapp', message: 'Teste de contato' } })).s, 403, 'sem consentimento: bloqueia WhatsApp');
  const ok = await call('POST', `/api/admin/collections/${withConsent.id}/contact`, { token: st.access_token, body: { channel: 'sms', message: 'Lembrete de parcela em aberto.', outcome: 'enviado' } }); assert.equal(ok.s, 201); assert.equal(ok.j.consent_checked, true);
  assert.ok(await one(`SELECT 1 FROM outbox WHERE purpose='collection' ORDER BY id DESC LIMIT 1`));
  const prop = await call('POST', `/api/admin/collections/${withConsent.id}/renegotiate`, { token: st.access_token, body: { discount_pct: 20, down_payment: 300, terms: 6 } }); assert.equal(prop.s, 201);
  const cu = await one(`SELECT u.email FROM users u JOIN customers c ON c.user_id=u.id WHERE c.id=$1`, [withConsent.customer_id]); const ct = await login(cu.email);
  const offers = await call('GET', '/api/me/renegotiations', { token: ct.access_token }); assert.ok(offers.j.offers.length >= 1);
  const acc = await call('POST', `/api/renegotiations/${prop.j.id}/accept`, { token: ct.access_token }); assert.equal(acc.s, 200); const nl = await one(`SELECT * FROM loans WHERE id=$1`, [acc.j.new_loan_id]); assert.equal(nl.status, 'ativo');
  assert.equal((await one(`SELECT status FROM loans WHERE id=$1`, [withConsent.loan_id])).status, 'renegociado');
});
test('painel: indicadores, relatórios CSV e auditoria', async () => {
  const ad = await login(DEMO.adminEmail), d = await call('GET', '/api/admin/dashboard', { token: ad.access_token }); const k = d.j.kpis;
  assert.ok(k.lent > 50000 && k.received > 50000 && k.receivable > 0 && k.overdue > 0 && k.delinquency_rate > 0 && d.j.cashflow.length >= 3 && d.j.aging.length === 4 && d.j.recent.length > 0, JSON.stringify(k));
  const csv = await fetch(B + '/api/admin/reports/emprestimos', { headers: { Authorization: 'Bearer ' + ad.access_token } }); assert.equal(csv.status, 200); assert.match(csv.headers.get('content-type'), /csv/); assert.ok((await csv.text()).split('\n').length > 30);
  const au = await call('GET', '/api/admin/audit?action=loan.', { token: ad.access_token }); assert.ok(au.j.entries.length > 0);
  const cl = await call('GET', '/api/admin/customers?q=marina', { token: ad.access_token }); assert.equal(cl.j.customers[0].cpf_masked.startsWith('***.***.'), true, 'CPF mascarado na listagem');
  const det = await call('GET', `/api/admin/customers/${cl.j.customers[0].id}?reveal=1`, { token: ad.access_token }); assert.match(det.j.customer.cpf, /^\d{11}$/); assert.ok(await one(`SELECT 1 FROM audit_log WHERE action='customer.cpf_revealed'`), 'revelar CPF é auditado');
  const st = await login(DEMO.staffEmail); assert.equal((await call('GET', `/api/admin/customers/${cl.j.customers[0].id}?reveal=1`, { token: st.access_token })).j.customer.cpf, undefined, 'só admin vê o CPF completo');
});
test('cliente: perfil, documentos, KYC e LGPD', async () => {
  const email = 'kyc.teste@exemplo.com.br', r = await call('POST', '/api/auth/register', { body: { name: 'Teste de Verificação', cpf: genCpf(9100), email, phone: '11977665544', password: 'Senha-Forte-2026', consent_terms: true } }); const t = r.j.access_token;
  assert.equal((await call('POST', '/api/me/kyc/submit', { token: t })).s, 422, 'perfil incompleto não envia');
  assert.equal((await call('PATCH', '/api/me/profile', { token: t, body: { zip: '123', birth_date: '2015-01-01' } })).s, 422);
  assert.equal((await call('PATCH', '/api/me/profile', { token: t, body: { birth_date: '1990-04-12', mother_name: 'Maria Teste', monthly_income: 4200, occupation: 'Designer', zip: '01310-100', street: 'Av. Paulista', number: '1000', district: 'Bela Vista', city: 'São Paulo', state: 'SP' } })).s, 200);
  const file = Buffer.from('imagem-demonstrativa').toString('base64');
  for (const kind of ['rg_frente', 'selfie', 'comprovante_residencia']) assert.equal((await call('POST', '/api/me/documents', { token: t, body: { kind, file_name: kind + '.jpg', mime: 'image/jpeg', data_base64: file } })).s, 201);
  assert.equal((await call('POST', '/api/me/documents', { token: t, body: { kind: 'selfie', file_name: 'x.exe', mime: 'application/x-msdownload', data_base64: file } })).s, 422);
  assert.equal((await call('POST', '/api/me/kyc/submit', { token: t })).s, 422, 'telefone precisa estar confirmado');
  await call('POST', '/api/auth/phone/verify', { token: t, body: { code: '123456' } }); assert.equal((await call('POST', '/api/me/kyc/submit', { token: t })).j.kyc_status, 'em_analise');
  const ad = await login(DEMO.adminEmail), id = (await one(`SELECT id FROM customers WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [email])).id;
  assert.equal((await call('POST', `/api/admin/customers/${id}/kyc`, { token: ad.access_token, body: { decision: 'aprovado' } })).s, 200);
  assert.equal((await call('PATCH', '/api/me/profile', { token: t, body: { city: 'Campinas', zip: '13015-904' } })).j.reverification, true, 'alterar endereço exige nova verificação');
  assert.equal((await call('GET', '/api/me', { token: t })).j.customer.kyc_status, 'em_analise');
  const ex = await call('GET', '/api/me/export', { token: t }); assert.ok(ex.j.profile && !ex.j.profile.cpf_enc, 'exportação LGPD sem dados criptografados internos');
});
