// API administrativa (painel web): dashboard, clientes, empréstimos (alçada), cobranças, antifraude, relatórios, equipe e auditoria.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { route, fail, need, clean, digits, num, audit, created, money } from '../http.js';
import { one, all, q } from '../db.js';
import { hashPassword, decrypt } from '../lib/crypto.js';
import { evaluateLoan, evaluateCustomer, scoreCustomer, RULES } from '../lib/antifraud.js';
import { getLoanFull, generateContract, customerView, createRenegotiation, runDailyJobs } from '../services/loans.js';
import { notify, sendSms, sendWhatsapp } from '../notify.js';

const OPS = ['admin', 'staff'], ADM = ['admin'];
const APPROVAL_LIMIT_STAFF = 15000;                       // alçada: acima disso só administrador aprova

const periodSql = (ctx) => { const from = ctx.query.get('from') || new Date(Date.now() - 179 * 864e5).toISOString().slice(0, 10), to = ctx.query.get('to') || new Date().toISOString().slice(0, 10); return { from, to }; };

route('GET', '/api/admin/dashboard', { auth: OPS }, async (ctx) => {
  const { from, to } = periodSql(ctx);
  const k = await one(`SELECT
    COALESCE((SELECT SUM(principal) FROM loans WHERE status IN ('ativo','quitado','renegociado') AND disbursed_at::date BETWEEN $1 AND $2),0) AS lent,
    COALESCE((SELECT SUM(amount + fine + interest_late) FROM payments WHERE paid_at::date BETWEEN $1 AND $2),0) AS received,
    COALESCE((SELECT SUM(i.amount - i.paid_amount) FROM installments i JOIN loans l ON l.id=i.loan_id WHERE l.status='ativo' AND i.status IN ('aberta','atrasada')),0) AS receivable,
    COALESCE((SELECT SUM(i.amount - i.paid_amount) FROM installments i JOIN loans l ON l.id=i.loan_id WHERE l.status='ativo' AND i.status='atrasada'),0) AS overdue,
    COALESCE((SELECT SUM(principal) FROM loans WHERE status='ativo'),0) AS portfolio,
    (SELECT COUNT(*)::int FROM loans WHERE status IN ('pendente','em_analise')) AS pending,
    (SELECT COUNT(*)::int FROM loans WHERE status IN ('ativo','assinatura')) AS active_loans,
    (SELECT COUNT(*)::int FROM customers WHERE anonymized_at IS NULL) AS customers,
    (SELECT COUNT(*)::int FROM customers WHERE kyc_status='em_analise') AS kyc_pending,
    (SELECT COUNT(*)::int FROM fraud_alerts WHERE status IN ('aberto','em_analise')) AS fraud_open`, [from, to]);
  const loanRows = await one(`SELECT COALESCE(SUM(i.principal) FILTER (WHERE i.due_date < CURRENT_DATE - 30 AND i.status='atrasada'),0) AS par30, COALESCE(SUM(i.principal) FILTER (WHERE i.status IN ('aberta','atrasada')),0) AS open_principal FROM installments i JOIN loans l ON l.id=i.loan_id WHERE l.status='ativo'`);
  const flow = await all(`WITH d AS (SELECT generate_series(date_trunc('month', $1::date), date_trunc('month', $2::date), interval '1 month')::date AS m)
    SELECT to_char(d.m,'YYYY-MM') AS month,
      COALESCE((SELECT SUM(principal) FROM loans WHERE disbursed_at IS NOT NULL AND date_trunc('month', disbursed_at)=d.m),0) AS lent,
      COALESCE((SELECT SUM(amount+fine+interest_late) FROM payments WHERE date_trunc('month', paid_at)=d.m),0) AS received,
      COALESCE((SELECT SUM(amount) FROM installments WHERE date_trunc('month', due_date)=d.m AND status IN ('aberta','atrasada')),0) AS expected FROM d ORDER BY d.m`, [from, to]);
  const aging = await one(`SELECT COALESCE(SUM(amount-paid_amount) FILTER (WHERE CURRENT_DATE-due_date BETWEEN 1 AND 15),0) AS d15, COALESCE(SUM(amount-paid_amount) FILTER (WHERE CURRENT_DATE-due_date BETWEEN 16 AND 30),0) AS d30, COALESCE(SUM(amount-paid_amount) FILTER (WHERE CURRENT_DATE-due_date BETWEEN 31 AND 60),0) AS d60, COALESCE(SUM(amount-paid_amount) FILTER (WHERE CURRENT_DATE-due_date > 60),0) AS d60p FROM installments WHERE status='atrasada'`);
  const mix = await all(`SELECT periodicity, COUNT(*)::int AS n, COALESCE(SUM(principal),0) AS total FROM loans WHERE status IN ('ativo','quitado') GROUP BY periodicity`);
  const recent = await all(`SELECT * FROM (
      SELECT 'emprestimo' AS kind, l.id, c.full_name, l.principal AS amount, l.status AS detail, l.created_at AS at FROM loans l JOIN customers c ON c.id=l.customer_id
      UNION ALL SELECT 'pagamento', p.id, c.full_name, p.amount + p.fine + p.interest_late, p.kind, p.paid_at FROM payments p JOIN customers c ON c.id=p.customer_id) x ORDER BY at DESC LIMIT 8`);
  const inad = Number(loanRows.open_principal) ? Number(loanRows.par30) / Number(loanRows.open_principal) * 100 : 0;
  return { period: { from, to }, kpis: { lent: Number(k.lent), received: Number(k.received), receivable: Number(k.receivable), overdue: Number(k.overdue), portfolio: Number(k.portfolio), delinquency_rate: Math.round(inad * 10) / 10, pending: k.pending, active_loans: k.active_loans, customers: k.customers, kyc_pending: k.kyc_pending, fraud_open: k.fraud_open }, cashflow: flow.map((f) => ({ ...f, lent: Number(f.lent), received: Number(f.received), expected: Number(f.expected) })), aging: [['1–15 dias', aging.d15], ['16–30', aging.d30], ['31–60', aging.d60], ['60+', aging.d60p]].map(([label, v]) => ({ label, value: Number(v) })), mix: mix.map((m) => ({ ...m, total: Number(m.total) })), recent };
});

route('GET', '/api/admin/customers', { auth: OPS }, async (ctx) => {
  const s = clean(ctx.query.get('q'), 60).toLowerCase(), kyc = ctx.query.get('kyc'), page = Math.max(1, num(ctx.query.get('page'), 1)), size = 20;
  const where = [`c.anonymized_at IS NULL`], vals = []; if (s) { vals.push(`%${s}%`); where.push(`(lower(c.full_name) LIKE $${vals.length} OR c.cpf_last3 LIKE $${vals.length} OR lower(u.email) LIKE $${vals.length})`); } if (kyc) { vals.push(kyc); where.push(`c.kyc_status=$${vals.length}`); }
  const rows = await all(`SELECT c.id, c.full_name, c.cpf_last3, c.city, c.state, c.kyc_status, c.risk_score, c.created_at, c.monthly_income, u.email, u.phone, (u.phone_verified_at IS NOT NULL) AS phone_verified,
      (SELECT COUNT(*)::int FROM loans l WHERE l.customer_id=c.id AND l.status='ativo') AS active_loans,
      (SELECT COALESCE(SUM(i.principal),0) FROM installments i JOIN loans l ON l.id=i.loan_id WHERE l.customer_id=c.id AND l.status='ativo' AND i.status IN ('aberta','atrasada')) AS outstanding,
      (SELECT COALESCE(MAX(CURRENT_DATE - i.due_date),0) FROM installments i JOIN loans l ON l.id=i.loan_id WHERE l.customer_id=c.id AND i.status='atrasada')::int AS days_late
    FROM customers c LEFT JOIN users u ON u.id=c.user_id WHERE ${where.join(' AND ')} ORDER BY c.created_at DESC LIMIT ${size} OFFSET ${(page - 1) * size}`, vals);
  const total = await one(`SELECT COUNT(*)::int AS n FROM customers c LEFT JOIN users u ON u.id=c.user_id WHERE ${where.join(' AND ')}`, vals);
  return { customers: rows.map((r) => ({ ...r, cpf_masked: `***.***.${r.cpf_last3}-**`, outstanding: Number(r.outstanding) })), total: total.n, page, size };
});
route('GET', '/api/admin/customers/:id', { auth: OPS }, async (ctx) => {
  const c = await customerView(+ctx.params.id); if (!c) throw fail(404, 'Cliente não encontrado.');
  const u = c.user_id ? await one(`SELECT email, phone, phone_verified_at, totp_enabled FROM users WHERE id=$1`, [c.user_id]) : null;
  const { cpf_enc, cpf_idx, ...safe } = c;
  const revealCpf = ctx.query.get('reveal') === '1' && ctx.user.role === 'admin'; if (revealCpf) await audit(ctx, 'customer.cpf_revealed', 'customer', c.id);
  await audit(ctx, 'customer.viewed', 'customer', c.id);
  return { customer: { ...safe, cpf: revealCpf ? decrypt(cpf_enc) : undefined }, user: u, documents: await all(`SELECT id, kind, status, file_name, size_bytes, review_note, created_at FROM documents WHERE customer_id=$1 ORDER BY id`, [c.id]), loans: await all(`SELECT * FROM loans WHERE customer_id=$1 ORDER BY id DESC`, [c.id]), payments: await all(`SELECT * FROM payments WHERE customer_id=$1 ORDER BY paid_at DESC LIMIT 20`, [c.id]), alerts: await all(`SELECT * FROM fraud_alerts WHERE customer_id=$1 ORDER BY id DESC`, [c.id]), contacts: await all(`SELECT cl.*, us.name AS by_name FROM contact_logs cl LEFT JOIN users us ON us.id=cl.by_user WHERE cl.customer_id=$1 ORDER BY cl.id DESC LIMIT 15`, [c.id]), consents: await all(`SELECT DISTINCT ON (purpose) purpose, granted, created_at FROM consents WHERE customer_id=$1 ORDER BY purpose, id DESC`, [c.id]) };
});
route('POST', '/api/admin/customers/:id/kyc', { auth: OPS }, async (ctx) => {
  const id = +ctx.params.id, decision = ctx.body.decision; need(['aprovado', 'recusado'].includes(decision), 'Decisão inválida.');
  const open = await one(`SELECT COUNT(*)::int AS n FROM fraud_alerts WHERE customer_id=$1 AND severity='alta' AND status IN ('aberto','em_analise')`, [id]);
  need(decision === 'recusado' || !open.n, 'Há alertas antifraude de alta gravidade em aberto. Conclua a análise antes de aprovar.');
  await q(`UPDATE customers SET kyc_status=$2, kyc_reviewed_by=$3, kyc_reviewed_at=now(), kyc_note=$4 WHERE id=$1`, [id, decision, ctx.user.id, clean(ctx.body.note, 300)]);
  if (decision === 'aprovado') await q(`UPDATE documents SET status='aprovado' WHERE customer_id=$1 AND status='pendente'`, [id]);
  const c = await one(`SELECT user_id FROM customers WHERE id=$1`, [id]); await notify(c.user_id, 'kyc', decision === 'aprovado' ? 'Identidade verificada' : 'Cadastro precisa de ajustes', decision === 'aprovado' ? 'Sua identidade foi aprovada. Você já pode solicitar um empréstimo.' : (clean(ctx.body.note, 200) || 'Revise seus dados e documentos e envie novamente.'));
  await q(`UPDATE customers SET risk_score=$2 WHERE id=$1`, [id, await scoreCustomer(id)]); await audit(ctx, 'kyc.reviewed', 'customer', id, { decision }); return { ok: true };
});
route('POST', '/api/admin/documents/:id/review', { auth: OPS }, async (ctx) => { need(['aprovado', 'recusado', 'suspeito'].includes(ctx.body.status), 'Status inválido.'); const d = await one(`UPDATE documents SET status=$2, review_note=$3 WHERE id=$1 RETURNING customer_id`, [ctx.params.id, ctx.body.status, clean(ctx.body.note, 300)]); if (ctx.body.status === 'suspeito') await evaluateCustomer(d.customer_id); await audit(ctx, 'document.reviewed', 'document', ctx.params.id, ctx.body); return { ok: true }; });

route('GET', '/api/admin/loans', { auth: OPS }, async (ctx) => {
  const st = ctx.query.get('status'), s = clean(ctx.query.get('q'), 60).toLowerCase(), vals = [], where = ['TRUE'];
  if (st) { vals.push(st.split(',')); where.push(`l.status = ANY($${vals.length})`); } if (s) { vals.push(`%${s}%`); where.push(`lower(c.full_name) LIKE $${vals.length}`); }
  const rows = await all(`SELECT l.id, l.principal, l.term, l.periodicity, l.monthly_rate, l.installment_value, l.total_amount, l.status, l.created_at, l.purpose, c.id AS customer_id, c.full_name, c.risk_score, c.kyc_status,
      (SELECT COUNT(*)::int FROM fraud_alerts f WHERE f.customer_id=c.id AND f.status IN ('aberto','em_analise')) AS alerts,
      (SELECT COALESCE(MAX(CURRENT_DATE - i.due_date),0) FROM installments i WHERE i.loan_id=l.id AND i.status='atrasada')::int AS days_late
    FROM loans l JOIN customers c ON c.id=l.customer_id WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC LIMIT 100`, vals);
  return { loans: rows, approval_limit_staff: APPROVAL_LIMIT_STAFF };
});
route('GET', '/api/admin/loans/:id', { auth: OPS }, async (ctx) => { const f = await getLoanFull(+ctx.params.id); if (!f) throw fail(404, 'Empréstimo não encontrado.'); const c = await customerView(f.loan.customer_id); const { cpf_enc, cpf_idx, ...safe } = c; return { ...f, customer: safe, alerts: await all(`SELECT * FROM fraud_alerts WHERE customer_id=$1 ORDER BY id DESC`, [c.id]) }; });
route('POST', '/api/admin/loans/:id/decision', { auth: OPS }, async (ctx) => {
  const id = +ctx.params.id, f = await getLoanFull(id); if (!f) throw fail(404, 'Empréstimo não encontrado.'); const { loan } = f, d = ctx.body.decision;
  need(['aprovado', 'recusado', 'em_analise'].includes(d), 'Decisão inválida.'); need(['pendente', 'em_analise'].includes(loan.status), 'Esta solicitação já foi decidida.');
  if (d === 'em_analise') { await q(`UPDATE loans SET status='em_analise', analyst_id=$2 WHERE id=$1`, [id, ctx.user.id]); await audit(ctx, 'loan.review_started', 'loan', id); return { ok: true }; }
  need(d === 'recusado' ? clean(ctx.body.note, 300).length >= 5 : true, 'Informe o motivo da recusa (será comunicado ao cliente).');
  if (d === 'aprovado') {
    if (ctx.user.role === 'staff' && Number(loan.principal) > APPROVAL_LIMIT_STAFF) throw fail(403, `Valores acima de R$ ${APPROVAL_LIMIT_STAFF.toLocaleString('pt-BR')} exigem aprovação de um administrador (alçada).`);
    const high = await one(`SELECT COUNT(*)::int AS n FROM fraud_alerts WHERE customer_id=$1 AND severity='alta' AND status IN ('aberto','em_analise')`, [loan.customer_id]); need(!high.n, 'Existem alertas antifraude de alta gravidade em aberto. Revise na Central Antifraude antes de aprovar.');
    need((await one(`SELECT kyc_status FROM customers WHERE id=$1`, [loan.customer_id])).kyc_status === 'aprovado', 'A identidade do cliente precisa estar aprovada.');
    await q(`UPDATE loans SET status='assinatura', analyst_id=$2, decision_note=$3, decided_at=now() WHERE id=$1`, [id, ctx.user.id, clean(ctx.body.note, 300)]); const code = await generateContract(id);
    await notify(loan.user_id, 'loan', 'Empréstimo aprovado', `Seu empréstimo de R$ ${Number(loan.principal).toFixed(2)} foi aprovado. Assine o contrato ${code} para receber o valor.`);
  } else { await q(`UPDATE loans SET status='recusado', analyst_id=$2, decision_note=$3, decided_at=now() WHERE id=$1`, [id, ctx.user.id, clean(ctx.body.note, 300)]); await notify(loan.user_id, 'loan', 'Solicitação não aprovada', clean(ctx.body.note, 200)); }
  await audit(ctx, `loan.${d}`, 'loan', id, { note: ctx.body.note }); return { ok: true };
});

route('GET', '/api/admin/collections', { auth: OPS }, async (ctx) => ({ cases: await all(`SELECT cc.*, c.full_name, c.cpf_last3, u.phone, l.principal, l.installment_value, (SELECT MAX(created_at) FROM contact_logs WHERE case_id=cc.id) AS last_contact, (SELECT COUNT(*)::int FROM contact_logs WHERE case_id=cc.id) AS contacts, (SELECT COUNT(*)::int FROM renegotiations r WHERE r.loan_id=cc.loan_id AND r.status='proposta') AS offers, (SELECT granted FROM consents k WHERE k.customer_id=c.id AND k.purpose='comunicacao_sms_whatsapp' ORDER BY k.id DESC LIMIT 1) AS consent_contact FROM collection_cases cc JOIN customers c ON c.id=cc.customer_id LEFT JOIN users u ON u.id=c.user_id JOIN loans l ON l.id=cc.loan_id WHERE cc.closed_at IS NULL ORDER BY cc.days_overdue DESC`), renegotiations: await all(`SELECT r.*, c.full_name FROM renegotiations r JOIN customers c ON c.id=r.customer_id ORDER BY r.id DESC LIMIT 20`) }));
route('GET', '/api/admin/collections/:id', { auth: OPS }, async (ctx) => { const cc = await one(`SELECT cc.*, c.full_name FROM collection_cases cc JOIN customers c ON c.id=cc.customer_id WHERE cc.id=$1`, [ctx.params.id]); if (!cc) throw fail(404, 'Caso não encontrado.'); return { case: cc, contacts: await all(`SELECT cl.*, u.name AS by_name FROM contact_logs cl LEFT JOIN users u ON u.id=cl.by_user WHERE case_id=$1 ORDER BY cl.id DESC`, [cc.id]), loan: await getLoanFull(cc.loan_id) }; });
route('POST', '/api/admin/collections/:id/contact', { auth: OPS }, async (ctx) => {
  const cc = await one(`SELECT cc.*, c.user_id, c.full_name FROM collection_cases cc JOIN customers c ON c.id=cc.customer_id WHERE cc.id=$1`, [ctx.params.id]); if (!cc) throw fail(404, 'Caso não encontrado.');
  const ch = ctx.body.channel; need(['sms', 'whatsapp', 'ligacao', 'email', 'app'].includes(ch), 'Canal inválido.'); const msg = clean(ctx.body.message, 400); need(msg.length >= 5, 'Escreva a mensagem ou o resumo do contato.');
  const consent = await one(`SELECT granted FROM consents WHERE customer_id=$1 AND purpose='comunicacao_sms_whatsapp' ORDER BY id DESC LIMIT 1`, [cc.customer_id]);
  if (['sms', 'whatsapp'].includes(ch) && !consent?.granted) throw fail(403, 'O cliente não autorizou contato por SMS/WhatsApp. Use ligação, e-mail ou notificação no app.');
  const h = new Date().getHours(); if (['sms', 'whatsapp', 'ligacao'].includes(ch) && (h < 8 || h >= 20) && !process.env.ALLOW_ANY_HOUR) throw fail(403, 'Contatos de cobrança só podem ser feitos entre 8h e 20h.');
  const u = await one(`SELECT phone FROM users WHERE id=$1`, [cc.user_id]); if (ch === 'sms') await sendSms(u.phone, msg, 'collection'); if (ch === 'whatsapp') await sendWhatsapp(u.phone, msg, 'collection'); if (ch === 'app') await notify(cc.user_id, 'collection', 'Mensagem da Lastro', msg);
  const log = await one(`INSERT INTO contact_logs (case_id, customer_id, channel, outcome, message, consent_checked, by_user) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [cc.id, cc.customer_id, ch, clean(ctx.body.outcome, 40) || 'enviado', msg, !!consent?.granted, ctx.user.id]);
  await q(`UPDATE collection_cases SET stage=CASE WHEN stage='lembrete' THEN 'contato' ELSE stage END, assigned_to=COALESCE(assigned_to,$2) WHERE id=$1`, [cc.id, ctx.user.id]); await audit(ctx, 'collection.contact', 'collection', cc.id, { channel: ch }); return created(log);
});
route('POST', '/api/admin/collections/:id/renegotiate', { auth: OPS }, async (ctx) => {
  const cc = await one(`SELECT * FROM collection_cases WHERE id=$1`, [ctx.params.id]); if (!cc) throw fail(404, 'Caso não encontrado.');
  const r = await createRenegotiation({ loanId: cc.loan_id, discountPct: ctx.body.discount_pct, downPayment: ctx.body.down_payment, terms: ctx.body.terms, userId: ctx.user.id });
  const cu = await one(`SELECT user_id FROM customers WHERE id=$1`, [cc.customer_id]); await notify(cu.user_id, 'renegotiation', 'Proposta de acordo', `Preparamos uma proposta para regularizar seu contrato: ${r.terms}x de R$ ${Number(r.installment_value).toFixed(2)}. Veja no app.`);
  await q(`UPDATE collection_cases SET stage='negociacao' WHERE id=$1 AND stage<>'acordo'`, [cc.id]); await audit(ctx, 'renegotiation.proposed', 'renegotiation', r.id, ctx.body); return created(r);
});

route('GET', '/api/admin/fraud', { auth: OPS }, async (ctx) => {
  const st = ctx.query.get('status'); const rows = await all(`SELECT f.*, c.full_name, c.risk_score, l.principal FROM fraud_alerts f LEFT JOIN customers c ON c.id=f.customer_id LEFT JOIN loans l ON l.id=f.loan_id ${st ? 'WHERE f.status=ANY($1)' : ''} ORDER BY CASE f.severity WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, f.created_at DESC LIMIT 100`, st ? [st.split(',')] : []);
  const sum = await one(`SELECT COUNT(*) FILTER (WHERE status IN ('aberto','em_analise'))::int AS open, COUNT(*) FILTER (WHERE severity='alta' AND status IN ('aberto','em_analise'))::int AS high, COUNT(*) FILTER (WHERE status='confirmado')::int AS confirmed, COUNT(*) FILTER (WHERE status='descartado')::int AS dismissed FROM fraud_alerts`);
  return { alerts: rows, summary: sum, rules: RULES };
});
route('POST', '/api/admin/fraud/:id/review', { auth: OPS }, async (ctx) => { need(['em_analise', 'confirmado', 'descartado'].includes(ctx.body.status), 'Status inválido.'); if (ctx.body.status !== 'em_analise') need(clean(ctx.body.note, 300).length >= 5, 'Registre a justificativa da revisão.'); const a = await one(`UPDATE fraud_alerts SET status=$2, reviewer_id=$3, reviewer_note=$4, reviewed_at=now() WHERE id=$1 RETURNING *`, [ctx.params.id, ctx.body.status, ctx.user.id, clean(ctx.body.note, 300)]); if (!a) throw fail(404, 'Alerta não encontrado.'); if (ctx.body.status === 'confirmado' && a.loan_id) await q(`UPDATE loans SET status='recusado', decision_note='Recusado após análise antifraude', decided_at=now() WHERE id=$1 AND status IN ('pendente','em_analise')`, [a.loan_id]); if (a.customer_id) await q(`UPDATE customers SET risk_score=$2 WHERE id=$1`, [a.customer_id, await scoreCustomer(a.customer_id)]); await audit(ctx, 'fraud.reviewed', 'fraud_alert', a.id, ctx.body); return a; });

const csv = (rows, cols) => '﻿' + [cols.map((c) => c[0]).join(';'), ...rows.map((r) => cols.map((c) => { const v = c[1](r); return `"${String(v ?? '').replace(/"/g, '""')}"`; }).join(';'))].join('\n');
route('GET', '/api/admin/reports/:type', { auth: OPS }, async (ctx) => {
  const t = ctx.params.type, { from, to } = periodSql(ctx); let body, name;
  if (t === 'emprestimos') { name = 'emprestimos'; body = csv(await all(`SELECT l.id, c.full_name, l.principal, l.term, l.periodicity, l.monthly_rate, l.total_amount, l.status, l.created_at::date AS data FROM loans l JOIN customers c ON c.id=l.customer_id WHERE l.created_at::date BETWEEN $1 AND $2 ORDER BY l.id`, [from, to]), [['id', (r) => r.id], ['cliente', (r) => r.full_name], ['valor', (r) => r.principal], ['parcelas', (r) => r.term], ['periodicidade', (r) => r.periodicity], ['taxa_mensal', (r) => r.monthly_rate], ['total', (r) => r.total_amount], ['status', (r) => r.status], ['data', (r) => String(r.data).slice(0, 10)]]); }
  else if (t === 'pagamentos') { name = 'pagamentos'; body = csv(await all(`SELECT p.id, c.full_name, p.loan_id, p.kind, p.amount, p.fine, p.interest_late, p.receipt_code, p.sandbox, p.paid_at FROM payments p JOIN customers c ON c.id=p.customer_id WHERE p.paid_at::date BETWEEN $1 AND $2 ORDER BY p.paid_at`, [from, to]), [['id', (r) => r.id], ['cliente', (r) => r.full_name], ['emprestimo', (r) => r.loan_id], ['tipo', (r) => r.kind], ['valor', (r) => r.amount], ['multa', (r) => r.fine], ['juros_mora', (r) => r.interest_late], ['recibo', (r) => r.receipt_code], ['sandbox', (r) => r.sandbox], ['pago_em', (r) => new Date(r.paid_at).toISOString()]]); }
  else if (t === 'inadimplencia') { name = 'inadimplencia'; body = csv(await all(`SELECT c.full_name, l.id AS loan_id, i.n, i.due_date, i.amount - i.paid_amount AS saldo, CURRENT_DATE - i.due_date AS dias FROM installments i JOIN loans l ON l.id=i.loan_id JOIN customers c ON c.id=l.customer_id WHERE i.status='atrasada' ORDER BY dias DESC`), [['cliente', (r) => r.full_name], ['emprestimo', (r) => r.loan_id], ['parcela', (r) => r.n], ['vencimento', (r) => String(r.due_date).slice(0, 10)], ['saldo', (r) => r.saldo], ['dias_atraso', (r) => r.dias]]); }
  else if (t === 'clientes') { name = 'clientes'; body = csv(await all(`SELECT c.id, c.full_name, c.cpf_last3, c.city, c.state, c.kyc_status, c.risk_score, c.created_at::date AS d FROM customers c WHERE anonymized_at IS NULL ORDER BY c.id`), [['id', (r) => r.id], ['nome', (r) => r.full_name], ['cpf', (r) => `***.***.${r.cpf_last3}-**`], ['cidade', (r) => r.city], ['uf', (r) => r.state], ['kyc', (r) => r.kyc_status], ['score', (r) => r.risk_score], ['cadastro', (r) => String(r.d).slice(0, 10)]]); }
  else throw fail(404, 'Relatório inexistente.');
  await audit(ctx, 'report.exported', 'report', t, { from, to }); ctx.res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="lastro-${name}-${from}_${to}.csv"`, 'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*' }); ctx.res.end(body);
});

route('GET', '/api/admin/users', { auth: ADM }, async () => ({ users: await all(`SELECT id, role, name, email, phone, totp_enabled, disabled, created_at FROM users WHERE role IN ('admin','staff') ORDER BY id`) }));
route('POST', '/api/admin/users', { auth: ADM }, async (ctx) => { const b = ctx.body, email = clean(b.email, 120).toLowerCase(); need(['admin', 'staff'].includes(b.role), 'Perfil inválido.'); need(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email), 'E-mail inválido.'); need(clean(b.name).length >= 3, 'Informe o nome.'); need(String(b.password || '').length >= 10, 'Senha com ao menos 10 caracteres.'); if (await one(`SELECT 1 FROM users WHERE email=$1`, [email])) throw fail(422, 'E-mail já cadastrado.'); const u = await one(`INSERT INTO users (role, name, email, phone, password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id, role, name, email`, [b.role, clean(b.name, 100), email, digits(b.phone), hashPassword(b.password)]); await audit(ctx, 'user.created', 'user', u.id, { role: b.role }); return created(u); });
route('PATCH', '/api/admin/users/:id', { auth: ADM }, async (ctx) => { need(+ctx.params.id !== ctx.user.id, 'Você não pode alterar sua própria conta aqui.'); if (typeof ctx.body.disabled === 'boolean') { await q(`UPDATE users SET disabled=$2 WHERE id=$1 AND role IN ('admin','staff')`, [ctx.params.id, ctx.body.disabled]); if (ctx.body.disabled) await q(`UPDATE sessions SET revoked_at=now() WHERE user_id=$1`, [ctx.params.id]); } if (['admin', 'staff'].includes(ctx.body.role)) await q(`UPDATE users SET role=$2 WHERE id=$1 AND role IN ('admin','staff')`, [ctx.params.id, ctx.body.role]); await audit(ctx, 'user.updated', 'user', ctx.params.id, ctx.body); return { ok: true }; });
route('GET', '/api/admin/audit', { auth: ADM }, async (ctx) => ({ entries: await all(`SELECT * FROM audit_log WHERE ($1::text IS NULL OR action LIKE $1 || '%') ORDER BY id DESC LIMIT 100`, [ctx.query.get('action')]) }));
route('GET', '/api/admin/outbox', { auth: OPS }, async () => ({ messages: await all(`SELECT * FROM outbox ORDER BY id DESC LIMIT 30`) }));
route('GET', '/api/admin/support', { auth: OPS }, async () => ({ tickets: await all(`SELECT t.*, c.full_name FROM support_tickets t JOIN customers c ON c.id=t.customer_id ORDER BY t.id DESC LIMIT 30`) }));
route('POST', '/api/admin/support/:id/answer', { auth: OPS }, async (ctx) => { need(clean(ctx.body.answer, 800).length >= 3, 'Escreva a resposta.'); const t = await one(`UPDATE support_tickets SET answer=$2, status='resolvido', answered_by=$3 WHERE id=$1 RETURNING customer_id, subject`, [ctx.params.id, clean(ctx.body.answer, 800), ctx.user.id]); const c = await one(`SELECT user_id FROM customers WHERE id=$1`, [t.customer_id]); await notify(c.user_id, 'support', 'Chamado respondido', `Resposta ao chamado "${t.subject}" disponível no app.`); return { ok: true }; });
route('POST', '/api/admin/jobs/run', { auth: ADM }, async (ctx) => { await runDailyJobs(); await audit(ctx, 'jobs.run'); return { ok: true }; });
route('GET', '/api/admin/products', { auth: OPS }, async () => ({ products: await all(`SELECT * FROM loan_products ORDER BY id`) }));
route('POST', '/api/admin/customers/:id/anonymize', { auth: ADM }, async (ctx) => {
  const open = await one(`SELECT COUNT(*)::int AS n FROM loans WHERE customer_id=$1 AND status IN ('ativo','assinatura','aprovado')`, [ctx.params.id]); need(!open.n, 'Não é possível anonimizar clientes com contratos em andamento (obrigação legal de guarda).');
  await q(`UPDATE customers SET full_name='Titular anonimizado #'||id, mother_name=NULL, street=NULL, number=NULL, district=NULL, zip=NULL, anonymized_at=now() WHERE id=$1`, [ctx.params.id]); await audit(ctx, 'lgpd.anonymize', 'customer', ctx.params.id); return { ok: true };
});
