// API do cliente (app): perfil, KYC, produtos, simulação, solicitação, contratos, Pix, histórico, notificações e suporte.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { route, fail, need, clean, digits, num, audit, created } from '../http.js';
import { one, all, q } from '../db.js';
import { simulate, parseDate, noon, daysBetween } from '../lib/finance.js';
import { encrypt, sha256 } from '../lib/crypto.js';
import { evaluateLoan, evaluateCustomer, scoreCustomer } from '../lib/antifraud.js';
import { getLoanFull, generateContract, contractFile, signContract, createPixCharge, simulatePixPayment, settleFromWebhook, receiptFile, customerView, acceptRenegotiation } from '../services/loans.js';
import { notifyStaff, notify } from '../notify.js';
import { qrSvg } from '../lib/pix.js';

const here = path.dirname(fileURLToPath(import.meta.url)), DOC_DIR = path.join(here, '..', '..', 'data', 'docs');
const CLIENT = ['client'];
export const myCustomer = async (ctx) => { const c = await one(`SELECT * FROM customers WHERE user_id=$1`, [ctx.user.id]); if (!c) throw fail(404, 'Cadastro de cliente não encontrado.'); return c; };
const ownsLoan = async (ctx, id) => { const c = await myCustomer(ctx); const l = await one(`SELECT id FROM loans WHERE id=$1 AND customer_id=$2`, [id, c.id]); if (!l) throw fail(404, 'Empréstimo não encontrado.'); return c; };

route('GET', '/api/me', async (ctx) => {
  const u = ctx.user; const base = { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, phone_verified: !!u.phone_verified_at, totp_enabled: u.totp_enabled };
  if (u.role !== 'client') return { user: base };
  const c = await myCustomer(ctx), docs = await all(`SELECT id, kind, status, file_name, review_note, created_at FROM documents WHERE customer_id=$1 ORDER BY id`, [c.id]);
  const unread = await one(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL`, [u.id]);
  const { cpf_enc, cpf_idx, ...safe } = await customerView(c.id);
  return { user: base, customer: safe, documents: docs, unread: unread.n, kyc_missing: ['street', 'zip', 'birth_date', 'monthly_income'].filter((k) => !c[k]).concat(['rg_frente', 'selfie', 'comprovante_residencia'].filter((k) => !docs.some((d) => d.kind === k)).map((k) => 'doc:' + k)) };
});

route('PATCH', '/api/me/profile', { auth: CLIENT }, async (ctx) => {
  const c = await myCustomer(ctx), b = ctx.body, err = {};
  const f = { birth_date: b.birth_date, mother_name: clean(b.mother_name, 120), monthly_income: b.monthly_income != null ? num(b.monthly_income) : undefined, occupation: clean(b.occupation, 80), zip: digits(b.zip).slice(0, 8), street: clean(b.street, 120), number: clean(b.number, 12), district: clean(b.district, 80), city: clean(b.city, 80), state: clean(b.state, 2).toUpperCase() };
  if (f.zip && f.zip.length !== 8) err.zip = 'CEP inválido.';
  if (f.birth_date) { const age = (Date.now() - new Date(f.birth_date).getTime()) / 31557600000; if (!(age >= 18)) err.birth_date = 'É necessário ter 18 anos ou mais.'; }
  if (f.monthly_income !== undefined && !(f.monthly_income >= 0)) err.monthly_income = 'Renda inválida.';
  need(!Object.keys(err).length, 'Verifique os campos.', err);
  const sets = [], vals = [c.id]; let sensitive = false;
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '') { vals.push(v); sets.push(`${k}=$${vals.length}`); if (['zip', 'street', 'number', 'city', 'state', 'monthly_income', 'birth_date'].includes(k) && String(c[k] ?? '') !== String(v)) sensitive = true; }
  if (sets.length) await q(`UPDATE customers SET ${sets.join(', ')} ${sensitive && c.kyc_status === 'aprovado' ? ", kyc_status='em_analise', kyc_note='Atualização cadastral — nova verificação'" : ''} WHERE id=$1`, vals);
  await audit(ctx, 'profile.update', 'customer', c.id, { fields: Object.keys(f).filter((k) => f[k]), reverify: sensitive && c.kyc_status === 'aprovado' });
  return { ok: true, reverification: sensitive && c.kyc_status === 'aprovado' };
});

const KINDS = ['rg_frente', 'rg_verso', 'cnh', 'selfie', 'comprovante_residencia', 'comprovante_renda'];
route('POST', '/api/me/documents', { auth: CLIENT, bodyLimit: 10_000_000, limit: [30, 3600000] }, async (ctx) => {
  const c = await myCustomer(ctx), b = ctx.body; need(KINDS.includes(b.kind), 'Tipo de documento inválido.');
  const buf = Buffer.from(String(b.data_base64 || ''), 'base64'); need(buf.length > 0 && buf.length <= 7_000_000, 'Arquivo inválido ou maior que 7 MB.');
  const mime = clean(b.mime, 40); need(['image/jpeg', 'image/png', 'application/pdf'].includes(mime), 'Formato aceito: JPG, PNG ou PDF.');
  fs.mkdirSync(DOC_DIR, { recursive: true }); const stored = `${c.id}-${b.kind}-${crypto.randomBytes(6).toString('hex')}.enc`; fs.writeFileSync(path.join(DOC_DIR, stored), encrypt(buf));   // arquivo criptografado em repouso
  const hash = sha256(buf), name = clean(b.file_name, 120);
  const note = /diverg/i.test(name) ? 'Leitura automática (sandbox): nome no documento divergente do cadastro.' : /suspeit|edit/i.test(name) ? 'Possível adulteração detectada (sandbox).' : null;
  const status = /suspeit|edit/i.test(name) ? 'suspeito' : 'pendente';
  await q(`DELETE FROM documents WHERE customer_id=$1 AND kind=$2`, [c.id, b.kind]);
  const d = await one(`INSERT INTO documents (customer_id, kind, file_name, mime, size_bytes, sha256, storage_path, status, review_note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, kind, status, file_name`, [c.id, b.kind, name, mime, buf.length, hash, stored, status, note]);
  await audit(ctx, 'kyc.document_uploaded', 'document', d.id, { kind: b.kind }); return created(d);
});
route('POST', '/api/me/kyc/submit', { auth: CLIENT }, async (ctx) => {
  const c = await myCustomer(ctx), docs = await all(`SELECT kind FROM documents WHERE customer_id=$1`, [c.id]);
  const miss = ['street', 'zip', 'birth_date', 'monthly_income'].filter((k) => !c[k]); need(!miss.length, 'Complete seus dados cadastrais antes de enviar.', { fields: miss.join(', ') });
  need(['rg_frente', 'selfie', 'comprovante_residencia'].every((k) => docs.some((d) => d.kind === k)) || docs.some((d) => d.kind === 'cnh'), 'Envie documento com foto, selfie e comprovante de residência.');
  need(ctx.user.phone_verified_at, 'Confirme seu telefone por SMS antes de enviar.');
  await q(`UPDATE customers SET kyc_status='em_analise', kyc_note=NULL WHERE id=$1`, [c.id]); await evaluateCustomer(c.id);
  await q(`UPDATE customers SET risk_score=$2 WHERE id=$1`, [c.id, await scoreCustomer(c.id)]); await notifyStaff('kyc', 'Nova análise documental', `${c.full_name} enviou documentos para verificação.`);
  await audit(ctx, 'kyc.submitted', 'customer', c.id); return { ok: true, kyc_status: 'em_analise' };
});
route('POST', '/api/me/consents', { auth: CLIENT }, async (ctx) => { const c = await myCustomer(ctx); need(['comunicacao_sms_whatsapp', 'analise_credito', 'termos_privacidade'].includes(ctx.body.purpose), 'Finalidade inválida.'); await q(`INSERT INTO consents (customer_id, purpose, granted, version, ip) VALUES ($1,$2,$3,'2026-01',$4)`, [c.id, ctx.body.purpose, !!ctx.body.granted, ctx.ip]); await audit(ctx, 'consent.changed', 'customer', c.id, ctx.body); return { ok: true }; });
route('GET', '/api/me/consents', { auth: CLIENT }, async (ctx) => { const c = await myCustomer(ctx); return { consents: await all(`SELECT DISTINCT ON (purpose) purpose, granted, created_at FROM consents WHERE customer_id=$1 ORDER BY purpose, id DESC`, [c.id]) }; });
route('GET', '/api/me/export', { auth: CLIENT }, async (ctx) => { const c = await customerView((await myCustomer(ctx)).id); const { cpf_enc, cpf_idx, ...safe } = c; await audit(ctx, 'lgpd.export', 'customer', c.id); return { exported_at: new Date().toISOString(), profile: safe, loans: await all(`SELECT * FROM loans WHERE customer_id=$1`, [c.id]), payments: await all(`SELECT * FROM payments WHERE customer_id=$1`, [c.id]), consents: await all(`SELECT * FROM consents WHERE customer_id=$1`, [c.id]) }; });

route('GET', '/api/products', async () => ({ products: await all(`SELECT * FROM loan_products WHERE active ORDER BY id`) }));
async function productFor(amount, term) { return one(`SELECT * FROM loan_products WHERE active AND $1 BETWEEN min_amount AND max_amount AND $2 BETWEEN min_term AND max_term ORDER BY monthly_rate LIMIT 1`, [amount, term]); }
route('POST', '/api/simulate', async (ctx) => {
  const amount = num(ctx.body.amount), term = Math.round(num(ctx.body.term)), per = ctx.body.periodicity || 'mensal';
  need(['diaria', 'semanal', 'mensal'].includes(per), 'Periodicidade inválida.'); need(amount >= 300 && amount <= 100000, 'O valor deve estar entre R$ 300 e R$ 100.000.'); need(term >= 1 && term <= 120, 'Prazo inválido.');
  const p = await productFor(amount, per === 'mensal' ? term : per === 'semanal' ? Math.ceil(term / 4.34) : Math.ceil(term / 30)); need(p, 'Não há produto disponível para essa combinação de valor e prazo.');
  if (!p.periodicities.includes(per)) throw fail(422, `A periodicidade ${per} não está disponível para ${p.name}.`);
  const s = simulate({ principal: amount, term, periodicity: per, monthlyRate: Number(p.monthly_rate) }); return { product: p.name, ...s };
});

route('POST', '/api/loans', { auth: CLIENT, limit: [10, 3600000] }, async (ctx) => {
  const c = await myCustomer(ctx), b = ctx.body, amount = num(b.amount), term = Math.round(num(b.term)), per = b.periodicity || 'mensal';
  need(c.kyc_status !== 'incompleto', 'Complete sua verificação de identidade para solicitar um empréstimo.');
  need(c.kyc_status !== 'recusado', 'Seu cadastro não foi aprovado. Atualize seus dados e envie novamente.');
  const open = await one(`SELECT COUNT(*)::int AS n FROM loans WHERE customer_id=$1 AND status IN ('pendente','em_analise','aprovado','assinatura')`, [c.id]); need(open.n === 0, 'Você já possui uma solicitação em andamento.');
  const p = await productFor(amount, per === 'mensal' ? term : per === 'semanal' ? Math.ceil(term / 4.34) : Math.ceil(term / 30)); need(p && p.periodicities.includes(per), 'Combinação de valor, prazo e periodicidade indisponível.');
  const s = simulate({ principal: amount, term, periodicity: per, monthlyRate: Number(p.monthly_rate) });
  const loan = await one(`INSERT INTO loans (customer_id, product_id, principal, term, periodicity, monthly_rate, period_rate, iof, installment_value, total_amount, cet_monthly, purpose, first_due) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [c.id, p.id, amount, term, per, p.monthly_rate, s.periodRate, s.iof, s.installment, s.total, s.cet, clean(b.purpose, 80), s.firstDue]);
  const alerts = await evaluateLoan(loan.id); await q(`UPDATE customers SET risk_score=$2 WHERE id=$1`, [c.id, await scoreCustomer(c.id)]);
  await notifyStaff('loan', 'Nova solicitação de empréstimo', `${c.full_name} solicitou R$ ${amount.toFixed(2)} em ${term}x (${alerts.length} alerta(s) antifraude).`);
  await audit(ctx, 'loan.requested', 'loan', loan.id, { amount, term, per }); return created({ loan, alerts: alerts.length });
});
route('GET', '/api/loans', { auth: CLIENT }, async (ctx) => {
  const c = await myCustomer(ctx); const loans = await all(`SELECT l.*, (SELECT json_build_object('n', i.n, 'due_date', i.due_date, 'amount', i.amount, 'status', i.status) FROM installments i WHERE i.loan_id=l.id AND i.status IN ('aberta','atrasada') ORDER BY i.n LIMIT 1) AS next, (SELECT COUNT(*)::int FROM installments i WHERE i.loan_id=l.id AND i.status='paga') AS paid_count FROM loans l WHERE customer_id=$1 ORDER BY l.id DESC`, [c.id]);
  const dash = await one(`SELECT COALESCE(SUM(i.principal) FILTER (WHERE i.status IN ('aberta','atrasada')),0) AS outstanding, COALESCE(SUM(i.amount - i.paid_amount) FILTER (WHERE i.status='atrasada'),0) AS overdue FROM installments i JOIN loans l ON l.id=i.loan_id WHERE l.customer_id=$1 AND l.status='ativo'`, [c.id]);
  return { loans, summary: { outstanding: Number(dash.outstanding), overdue: Number(dash.overdue), risk_score: c.risk_score } };
});
route('GET', '/api/loans/:id', { auth: CLIENT }, async (ctx) => { await ownsLoan(ctx, +ctx.params.id); const f = await getLoanFull(+ctx.params.id); const pays = await all(`SELECT id, kind, amount, fine, interest_late, paid_at, receipt_code, sandbox FROM payments WHERE loan_id=$1 ORDER BY paid_at DESC`, [f.loan.id]); const { user_id, ...loan } = f.loan; return { ...f, loan, payments: pays }; });
route('GET', '/api/loans/:id/contract.pdf', async (ctx) => {
  const id = +ctx.params.id; if (ctx.user.role === 'client') await ownsLoan(ctx, id); const buf = await contractFile(id); await audit(ctx, 'contract.viewed', 'loan', id);
  ctx.res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="contrato-${id}.pdf"`, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*' }); ctx.res.end(buf);
});
route('POST', '/api/loans/:id/sign', { auth: CLIENT }, async (ctx) => {
  const id = +ctx.params.id; await ownsLoan(ctx, id); const f = await getLoanFull(id); need(f.loan.status === 'assinatura', 'Este contrato não está aguardando assinatura.'); need(ctx.body.accept === true, 'É necessário aceitar as condições do contrato.');
  const sig = await signContract(id, ctx); await audit(ctx, 'contract.signed', 'loan', id, { ref: sig.ref }); return { ok: true, ...sig };
});
route('POST', '/api/loans/:id/pix', { auth: CLIENT, limit: [30, 3600000] }, async (ctx) => { const c = await ownsLoan(ctx, +ctx.params.id); const ch = await createPixCharge({ loanId: +ctx.params.id, customerId: c.id, kind: ctx.body.kind || 'parcela', installmentId: ctx.body.installment_id, amount: ctx.body.amount }); await audit(ctx, 'pix.charge_created', 'pix', ch.txid, { amount: ch.amount }); return created({ ...ch, sandbox: true }); });
route('GET', '/api/pix/:txid', { auth: CLIENT }, async (ctx) => { const c = await myCustomer(ctx); const ch = await one(`SELECT txid, status, amount, fine, interest_late, brcode, expires_at, paid_at, end_to_end FROM pix_charges WHERE txid=$1 AND customer_id=$2`, [ctx.params.txid, c.id]); if (!ch) throw fail(404, 'Cobrança não encontrada.'); return { ...ch, qr_svg: await qrSvg(ch.brcode), sandbox: true }; });
// Somente SANDBOX: representa o pagador concluindo o Pix no app do banco. Em produção a baixa vem apenas do webhook do PSP.
route('POST', '/api/sandbox/pix/:txid/pay', { auth: CLIENT }, async (ctx) => { if (process.env.NODE_ENV === 'production') throw fail(404, 'Indisponível.'); const c = await myCustomer(ctx); const ch = await one(`SELECT id FROM pix_charges WHERE txid=$1 AND customer_id=$2`, [ctx.params.txid, c.id]); if (!ch) throw fail(404, 'Cobrança não encontrada.'); return simulatePixPayment(ctx.params.txid); });
route('POST', '/webhooks/pix', { auth: 'public' }, async (ctx) => { const r = await settleFromWebhook(ctx.raw, ctx.req.headers['x-signature']); return r.payment ? { ok: true, receipt: r.payment.receipt_code } : { ok: true, ...r }; });

route('GET', '/api/payments', { auth: CLIENT }, async (ctx) => { const c = await myCustomer(ctx); return { payments: await all(`SELECT p.id, p.kind, p.amount, p.fine, p.interest_late, p.paid_at, p.receipt_code, p.sandbox, p.loan_id, i.n AS installment_n FROM payments p LEFT JOIN installments i ON i.id=p.installment_id WHERE p.customer_id=$1 ORDER BY p.paid_at DESC`, [c.id]) }; });
route('GET', '/api/payments/:id/receipt.pdf', async (ctx) => { const { buffer, pay } = await receiptFile(+ctx.params.id); if (ctx.user.role === 'client') { const c = await myCustomer(ctx); if (pay.customer_id !== c.id) throw fail(404, 'Recibo não encontrado.'); } ctx.res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${pay.receipt_code}.pdf"`, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*' }); ctx.res.end(buffer); });

route('GET', '/api/notifications', async (ctx) => ({ notifications: await all(`SELECT * FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 50`, [ctx.user.id]) }));
route('POST', '/api/notifications/read', async (ctx) => { await q(`UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL`, [ctx.user.id]); return { ok: true }; });
route('GET', '/api/support', { auth: CLIENT }, async (ctx) => ({ tickets: await all(`SELECT * FROM support_tickets WHERE customer_id=$1 ORDER BY id DESC`, [(await myCustomer(ctx)).id]) }));
route('POST', '/api/support', { auth: CLIENT, limit: [10, 3600000] }, async (ctx) => { const c = await myCustomer(ctx); need(clean(ctx.body.subject, 80).length >= 3 && clean(ctx.body.message, 1000).length >= 10, 'Informe assunto e uma mensagem com mais detalhes.'); const t = await one(`INSERT INTO support_tickets (customer_id, subject, message) VALUES ($1,$2,$3) RETURNING *`, [c.id, clean(ctx.body.subject, 80), clean(ctx.body.message, 1000)]); await notifyStaff('support', 'Novo chamado de suporte', `${c.full_name}: ${t.subject}`); return created(t); });
route('GET', '/api/me/renegotiations', { auth: CLIENT }, async (ctx) => ({ offers: await all(`SELECT * FROM renegotiations WHERE customer_id=$1 AND status='proposta' ORDER BY id DESC`, [(await myCustomer(ctx)).id]) }));
route('POST', '/api/renegotiations/:id/accept', { auth: CLIENT }, async (ctx) => { const r = await acceptRenegotiation(+ctx.params.id, (await myCustomer(ctx)).id); await audit(ctx, 'renegotiation.accepted', 'renegotiation', ctx.params.id); return r; });
route('POST', '/api/renegotiations/:id/decline', { auth: CLIENT }, async (ctx) => { const c = await myCustomer(ctx); await q(`UPDATE renegotiations SET status='recusada', decided_at=now() WHERE id=$1 AND customer_id=$2 AND status='proposta'`, [ctx.params.id, c.id]); return { ok: true }; });
