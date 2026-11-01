// Serviços de crédito: contrato, desembolso, cobrança Pix, conciliação, quitação, amortização, renegociação e atrasos.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { one, all, q, tx } from '../db.js';
import { fail } from '../http.js';
import { schedule, simulate, lateCharges, payoff, amortize, renegotiate, parseDate, noon, iso, daysBetween, r2, addPeriod, periodRate, pmt } from '../lib/finance.js';
import { sandboxPsp, qrSvg, verifyWebhook } from '../lib/pix.js';
import { contractPdf, receiptPdf } from '../lib/pdf.js';
import { decrypt, sha256 } from '../lib/crypto.js';
import { notify, sendSms, notifyStaff } from '../notify.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_DIR = path.join(here, '..', '..', 'data', 'contracts');
const todayUtc = () => noon(new Date());
export const maskCpf = (last3) => `***.***.${String(last3).padStart(3, '*')}-**`;

export async function customerView(id) {
  const c = await one(`SELECT * FROM customers WHERE id=$1`, [id]); if (!c) return null;
  return { ...c, cpf_masked: maskCpf(c.cpf_last3) };
}

export async function getLoanFull(id) {
  const loan = await one(`SELECT l.*, c.full_name, c.cpf_last3, c.user_id FROM loans l JOIN customers c ON c.id=l.customer_id WHERE l.id=$1`, [id]); if (!loan) return null;
  const installments = await all(`SELECT * FROM installments WHERE loan_id=$1 ORDER BY n`, [id]);
  const today = todayUtc();
  for (const i of installments) { const late = i.status !== 'paga' && i.status !== 'renegociada' && parseDate(i.due_date) < today; i.days_late = late ? daysBetween(parseDate(i.due_date), today) : 0; if (late) { const c = lateCharges(Number(i.amount) - Number(i.paid_amount), i.days_late); i.late_fine = c.fine; i.late_interest = c.interest; i.amount_due = c.total; } else { i.late_fine = 0; i.late_interest = 0; i.amount_due = r2(Number(i.amount) - Number(i.paid_amount)); } }
  const contract = await one(`SELECT id, code, generated_at, signed_at, doc_sha256 FROM contracts WHERE loan_id=$1`, [id]);
  const pay = ['ativo', 'quitado', 'renegociado'].includes(loan.status) ? payoff({ installments, monthlyRate: Number(loan.monthly_rate), periodicity: loan.periodicity }) : null;
  return { loan, installments, contract, payoff: pay };
}

/** Gera o contrato PDF (aguardando assinatura) e grava o hash. */
export async function generateContract(loanId) {
  const { loan } = await getLoanFull(loanId), c = await customerView(loan.customer_id);
  const sim = simulate({ principal: Number(loan.principal), term: loan.term, periodicity: loan.periodicity, monthlyRate: Number(loan.monthly_rate), start: new Date() });
  const code = `LST-${new Date().getFullYear()}-${String(loanId).padStart(6, '0')}`;
  const { buffer, sha256: hash } = await contractPdf({ code, loan: { ...loan, first_due: sim.firstDue, installment_value: sim.installment, total_amount: sim.total, iof: sim.iof }, customer: c, rows: sim.rows, cet: sim.cet, cetYear: sim.cetYear });
  fs.mkdirSync(CONTRACT_DIR, { recursive: true }); fs.writeFileSync(path.join(CONTRACT_DIR, `${code}.pdf`), buffer);
  await q(`INSERT INTO contracts (loan_id, code, doc_sha256) VALUES ($1,$2,$3) ON CONFLICT (loan_id) DO UPDATE SET doc_sha256=$3, generated_at=now(), signed_at=NULL, sign_ref=NULL, signature_hash=NULL`, [loanId, code, hash]);
  await q(`UPDATE loans SET installment_value=$2, total_amount=$3, iof=$4, first_due=$5, cet_monthly=$6 WHERE id=$1`, [loanId, sim.installment, sim.total, sim.iof, sim.firstDue, sim.cet]);
  return code;
}
export async function contractFile(loanId, signed) {
  const { loan, contract } = await getLoanFull(loanId); if (!contract) throw fail(404, 'Contrato ainda não gerado.');
  const c = await customerView(loan.customer_id), sig = await one(`SELECT * FROM contracts WHERE loan_id=$1`, [loanId]);
  const rows = (await all(`SELECT * FROM installments WHERE loan_id=$1 ORDER BY n`, [loanId]));
  const sched = rows.length ? rows : simulate({ principal: Number(loan.principal), term: loan.term, periodicity: loan.periodicity, monthlyRate: Number(loan.monthly_rate), start: new Date() }).rows;
  const { buffer } = await contractPdf({ code: contract.code, loan, customer: c, rows: sched, cet: Number(loan.cet_monthly), cetYear: Math.round((Math.pow(1 + Number(loan.cet_monthly) / 100, 12) - 1) * 10000) / 100, signature: sig.signed_at ? { at: sig.signed_at, ip: sig.signer_ip, provider: sig.sign_provider, ref: sig.sign_ref, hash: sig.signature_hash } : null });
  return buffer;
}

/** Assinatura eletrônica SANDBOX: registra evidências (IP, agente, horário, hash). Produção: Clicksign, D4Sign, ZapSign etc. */
export async function signContract(loanId, ctx) {
  const row = await one(`SELECT * FROM contracts WHERE loan_id=$1`, [loanId]); if (!row) throw fail(404, 'Contrato não encontrado.');
  if (row.signed_at) throw fail(409, 'Contrato já assinado.');
  const ref = 'sbx-sign-' + crypto.randomBytes(5).toString('hex'), at = new Date();
  const hash = sha256(`${row.doc_sha256}|${ctx.user.id}|${ctx.ip}|${at.toISOString()}|${ref}`);
  await q(`UPDATE contracts SET signed_at=$2, signer_ip=$3, signer_user_agent=$4, sign_ref=$5, signature_hash=$6 WHERE loan_id=$1`, [loanId, at, ctx.ip, ctx.device, ref, hash]);
  await disburse(loanId);
  return { ref, hash, at };
}

/** Desembolso SANDBOX (simula a transferência via Pix para o cliente) e criação do cronograma. */
export async function disburse(loanId) {
  const { loan } = await getLoanFull(loanId); if (!['aprovado', 'assinatura'].includes(loan.status)) throw fail(409, 'Empréstimo não está apto ao desembolso.');
  const start = todayUtc(), sim = simulate({ principal: Number(loan.principal), term: loan.term, periodicity: loan.periodicity, monthlyRate: Number(loan.monthly_rate), start });
  await tx(async (t) => {
    await t.q(`DELETE FROM installments WHERE loan_id=$1`, [loanId]);
    for (const r of sim.rows) await t.q(`INSERT INTO installments (loan_id, n, due_date, principal, interest, amount, balance_after) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [loanId, r.n, r.due_date, r.principal, r.interest, r.amount, r.balance_after]);
    await t.q(`UPDATE loans SET status='ativo', disbursed_at=now(), first_due=$2, installment_value=$3, total_amount=$4, iof=$5, cet_monthly=$6 WHERE id=$1`, [loanId, sim.firstDue, sim.installment, sim.total, sim.iof, sim.cet]);
  });
  if (loan.user_id) { await notify(loan.user_id, 'loan', 'Empréstimo liberado', `O valor de R$ ${Number(loan.principal).toFixed(2)} foi liberado (sandbox). Primeira parcela em ${sim.firstDue.split('-').reverse().join('/')}.`); const u = await one(`SELECT phone FROM users WHERE id=$1`, [loan.user_id]); if (u?.phone) await sendSms(u.phone, `Lastro: seu empréstimo foi liberado. Primeira parcela em ${sim.firstDue.split('-').reverse().join('/')}.`, 'disbursement'); }
}

/** Cria cobrança Pix (parcela, quitação ou amortização) com encargos de atraso calculados no momento. */
export async function createPixCharge({ loanId, customerId, kind = 'parcela', installmentId = null, amount = null }) {
  const full = await getLoanFull(loanId); if (!full) throw fail(404, 'Empréstimo não encontrado.');
  const { loan, installments, payoff: po } = full; if (loan.customer_id !== customerId) throw fail(403, 'Sem acesso a este empréstimo.');
  if (loan.status !== 'ativo') throw fail(409, 'Este empréstimo não está ativo.');
  let total, fine = 0, lateInt = 0, inst = null;
  if (kind === 'parcela') {
    inst = installmentId ? installments.find((i) => i.id === +installmentId) : installments.find((i) => i.status !== 'paga' && i.status !== 'renegociada');
    if (!inst || inst.status === 'paga') throw fail(409, 'Parcela indisponível para pagamento.');
    fine = inst.late_fine; lateInt = inst.late_interest; total = r2(Number(inst.amount) - Number(inst.paid_amount) + fine + lateInt);
  } else if (kind === 'quitacao') { total = po.payoffToday; fine = po.fines; lateInt = po.lateInterest; }
  else if (kind === 'amortizacao') { const a = Number(amount); if (!(a >= 50)) throw fail(422, 'Valor mínimo de amortização: R$ 50,00.'); if (a >= po.outstanding) throw fail(422, 'Para valores acima do saldo use a quitação.'); if (po.overdue > 0) throw fail(409, 'Regularize as parcelas em atraso antes de amortizar.'); total = r2(a); }
  else throw fail(422, 'Tipo de cobrança inválido.');
  await q(`UPDATE pix_charges SET status='cancelada' WHERE loan_id=$1 AND status='pendente' AND COALESCE(installment_id,0)=COALESCE($2,0)`, [loanId, inst?.id || null]);
  const txid = 'LST' + crypto.randomBytes(10).toString('hex').toUpperCase(), psp = sandboxPsp.createCharge({ amount: total, txid });
  const charge = await one(`INSERT INTO pix_charges (txid, loan_id, installment_id, customer_id, amount, fine, interest_late, brcode, provider, provider_ref, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'sandbox',$9, now() + interval '30 minutes') RETURNING *`, [txid, loanId, inst?.id || null, customerId, total, fine, lateInt, psp.brcode, psp.providerRef]);
  charge.kind = kind; if (kind === 'amortizacao') await q(`UPDATE pix_charges SET provider_ref=$2 WHERE id=$1`, [charge.id, `${psp.providerRef}|amort`]);
  return { ...charge, kind, qr_svg: await qrSvg(charge.brcode), installment_n: inst?.n || null };
}

/** Conciliação: baixa idempotente a partir do evento (assinado) do PSP. Valor divergente NÃO baixa e abre alerta. */
export async function settleFromWebhook(rawBody, signature) {
  if (!verifyWebhook(rawBody, signature)) throw fail(401, 'Assinatura do webhook inválida.');
  const ev = JSON.parse(rawBody); if (ev.type !== 'pix.paid') return { ignored: true };
  const pre = await one(`SELECT * FROM pix_charges WHERE txid=$1`, [ev.txid]); if (!pre) throw fail(404, 'Cobrança desconhecida.');
  if (pre.status === 'pendente' && Math.abs(Number(ev.amount) - Number(pre.amount)) > 0.001) { await q(`INSERT INTO fraud_alerts (customer_id, loan_id, rule, severity, detail, evidence) VALUES ($1,$2,'PIX_AMOUNT_MISMATCH','alta',$3,$4)`, [pre.customer_id, pre.loan_id, `Pix recebido com valor diferente do cobrado (esperado R$ ${pre.amount}, recebido R$ ${ev.amount}).`, JSON.stringify(ev)]); throw fail(409, 'Valor do Pix diverge da cobrança. Baixa não realizada; enviado para análise.'); }
  return tx(async (t) => {
    const ch = await t.one(`SELECT * FROM pix_charges WHERE txid=$1 FOR UPDATE`, [ev.txid]); if (!ch) throw fail(404, 'Cobrança desconhecida.');
    if (ch.status === 'paga') return { duplicate: true, charge: ch };
    if (ch.status !== 'pendente') throw fail(409, 'Cobrança não está pendente.');
    const loan = await t.one(`SELECT * FROM loans WHERE id=$1 FOR UPDATE`, [ch.loan_id]);
    const kind = (ch.provider_ref || '').includes('|amort') ? 'amortizacao' : ch.installment_id ? 'parcela' : 'quitacao';
    const base = r2(Number(ch.amount) - Number(ch.fine) - Number(ch.interest_late)), code = 'RCB-' + crypto.randomBytes(5).toString('hex').toUpperCase();
    if (kind === 'parcela') await t.q(`UPDATE installments SET paid_amount=amount, paid_at=now(), status='paga' WHERE id=$1`, [ch.installment_id]);
    else if (kind === 'quitacao') await t.q(`UPDATE installments SET paid_amount=amount, paid_at=now(), status='paga' WHERE loan_id=$1 AND status IN ('aberta','atrasada')`, [ch.loan_id]);
    else { const open = await t.all(`SELECT * FROM installments WHERE loan_id=$1 AND status IN ('aberta','atrasada') ORDER BY n`, [ch.loan_id]); for (const r of amortize({ openRows: open, amount: base, monthlyRate: Number(loan.monthly_rate), periodicity: loan.periodicity })) await t.q(`UPDATE installments SET principal=$2, interest=$3, amount=$4, balance_after=$5 WHERE id=$1`, [r.id, r.principal, r.interest, r.amount, r.balance_after]); }
    await t.q(`UPDATE pix_charges SET status='paga', paid_at=now(), end_to_end=$2 WHERE id=$1`, [ch.id, ev.endToEndId]);
    const pay = await t.one(`INSERT INTO payments (loan_id, installment_id, customer_id, charge_id, kind, amount, fine, interest_late, sandbox, receipt_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [ch.loan_id, ch.installment_id, ch.customer_id, ch.id, kind, base, ch.fine, ch.interest_late, !!ev.sandbox, code]);
    const left = await t.one(`SELECT COUNT(*)::int AS n FROM installments WHERE loan_id=$1 AND status IN ('aberta','atrasada')`, [ch.loan_id]);
    if (!left.n) await t.q(`UPDATE loans SET status='quitado', closed_at=now() WHERE id=$1`, [ch.loan_id]);
    await t.q(`UPDATE collection_cases SET closed_at=now(), stage='encerrado' WHERE loan_id=$1 AND closed_at IS NULL AND NOT EXISTS (SELECT 1 FROM installments WHERE loan_id=$1 AND status='atrasada')`, [ch.loan_id]);
    const cu = await t.one(`SELECT user_id FROM customers WHERE id=$1`, [ch.customer_id]);
    await t.q(`INSERT INTO notifications (user_id, kind, title, body) VALUES ($1,'payment','Pagamento confirmado',$2)`, [cu.user_id, `Recebemos R$ ${Number(ch.amount).toFixed(2)} (sandbox). Seu comprovante já está disponível.`]);
    return { paid: true, payment: pay, loanClosed: !left.n };
  });
}
/** Dispara no sandbox o evento que o PSP enviaria — passa pelo mesmo caminho do webhook real. */
export async function simulatePixPayment(txid) {
  const ch = await one(`SELECT * FROM pix_charges WHERE txid=$1`, [txid]); if (!ch) throw fail(404, 'Cobrança não encontrada.');
  const ev = sandboxPsp.paidEvent({ txid, amount: Number(ch.amount) }); return settleFromWebhook(ev.body, ev.signature);
}

export async function receiptFile(paymentId) {
  const pay = await one(`SELECT * FROM payments WHERE id=$1`, [paymentId]); if (!pay) throw fail(404, 'Recibo não encontrado.');
  const customer = await customerView(pay.customer_id), loan = (await getLoanFull(pay.loan_id)).loan, inst = pay.installment_id ? await one(`SELECT * FROM installments WHERE id=$1`, [pay.installment_id]) : null;
  return { buffer: await receiptPdf({ code: pay.receipt_code, payment: pay, customer, loan, installment: inst }), pay };
}

/** Marca atrasos, abre/atualiza casos de cobrança e dispara lembretes (D-3 e D-0). Idempotente. */
export async function runDailyJobs() {
  await q(`UPDATE installments SET status='atrasada' WHERE status='aberta' AND due_date < CURRENT_DATE`);
  const late = await all(`SELECT l.id AS loan_id, l.customer_id, MAX(CURRENT_DATE - i.due_date)::int AS days, SUM(i.amount - i.paid_amount) AS amount FROM installments i JOIN loans l ON l.id=i.loan_id WHERE i.status='atrasada' AND l.status='ativo' GROUP BY l.id, l.customer_id`);
  for (const l of late) {
    const stage = l.days <= 3 ? 'lembrete' : l.days <= 15 ? 'contato' : l.days <= 45 ? 'negociacao' : 'juridico';
    const open = await one(`SELECT id, stage FROM collection_cases WHERE loan_id=$1 AND closed_at IS NULL`, [l.loan_id]);
    if (open) await q(`UPDATE collection_cases SET days_overdue=$2, amount_overdue=$3, stage=CASE WHEN stage IN ('acordo') THEN stage ELSE $4 END WHERE id=$1`, [open.id, l.days, l.amount, stage]);
    else await q(`INSERT INTO collection_cases (loan_id, customer_id, stage, days_overdue, amount_overdue) VALUES ($1,$2,$3,$4,$5)`, [l.loan_id, l.customer_id, stage, l.days, l.amount]);
  }
  const due = await all(`SELECT i.id, i.n, i.due_date, i.amount, c.user_id, (i.due_date - CURRENT_DATE)::int AS d FROM installments i JOIN loans l ON l.id=i.loan_id JOIN customers c ON c.id=l.customer_id WHERE i.status='aberta' AND l.status='ativo' AND (i.due_date - CURRENT_DATE) IN (0,3)`);
  for (const d of due) {
    const title = d.d === 0 ? 'Sua parcela vence hoje' : 'Parcela vence em 3 dias';
    const exists = await one(`SELECT id FROM notifications WHERE user_id=$1 AND title=$2 AND body LIKE $3 AND created_at::date=CURRENT_DATE`, [d.user_id, title, `%parcela ${d.n}%`]);
    if (!exists) await notify(d.user_id, 'due', title, `A parcela ${d.n} de R$ ${Number(d.amount).toFixed(2)} vence em ${String(d.due_date).slice(0, 10).split('-').reverse().join('/')}. Pague via Pix no app.`);
  }
  await q(`UPDATE pix_charges SET status='expirada' WHERE status='pendente' AND expires_at < now()`);
}

export async function createRenegotiation({ loanId, discountPct, downPayment, terms, userId }) {
  const full = await getLoanFull(loanId); if (!full) throw fail(404, 'Empréstimo não encontrado.');
  const { loan, payoff: po } = full; if (loan.status !== 'ativo' || !(po.overdue > 0)) throw fail(409, 'Só é possível renegociar contratos ativos com parcelas em atraso.');
  const balance = r2(po.payoffToday), disc = Math.min(30, Math.max(0, Number(discountPct) || 0)); const r = renegotiate({ balanceWithCharges: balance, discountPct: disc, downPayment: Number(downPayment) || 0, terms: Math.max(1, Math.min(24, Number(terms) || 6)), monthlyRate: Number(loan.monthly_rate) });
  return one(`INSERT INTO renegotiations (loan_id, customer_id, original_balance, discount, new_total, down_payment, terms, installment_value, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [loanId, loan.customer_id, balance, r.discount, r.newTotal, Number(downPayment) || 0, Math.max(1, Math.min(24, Number(terms) || 6)), r.installment, userId]);
}
/** Aceite do acordo: encerra o contrato antigo como 'renegociado' e cria novo contrato com entrada + parcelas. */
export async function acceptRenegotiation(id, customerId) {
  return tx(async (t) => {
    const r = await t.one(`SELECT * FROM renegotiations WHERE id=$1 FOR UPDATE`, [id]); if (!r || (customerId && r.customer_id !== customerId)) throw fail(404, 'Proposta não encontrada.'); if (r.status !== 'proposta') throw fail(409, 'Proposta já respondida.');
    const old = await t.one(`SELECT * FROM loans WHERE id=$1`, [r.loan_id]);
    await t.q(`UPDATE installments SET status='renegociada' WHERE loan_id=$1 AND status IN ('aberta','atrasada')`, [r.loan_id]); await t.q(`UPDATE loans SET status='renegociado', closed_at=now() WHERE id=$1`, [r.loan_id]);
    const financed = r2(Number(r.original_balance) - Number(r.discount) - Number(r.down_payment)), rate = periodRate(Number(old.monthly_rate), 'mensal'), p = r2(pmt(financed, rate, r.terms));
    const nl = await t.one(`INSERT INTO loans (customer_id, product_id, principal, term, periodicity, monthly_rate, period_rate, iof, installment_value, total_amount, cet_monthly, purpose, status, analyst_id, decision_note, decided_at, first_due, disbursed_at) VALUES ($1,$2,$3,$4,'mensal',$5,$6,0,$7,$8,$5,$9,'ativo',$10,$11,now(),$12,now()) RETURNING *`, [r.customer_id, old.product_id, r.original_balance - r.discount, r.terms + (Number(r.down_payment) > 0 ? 1 : 0), old.monthly_rate, rate, p, r.new_total, `Acordo do contrato #${old.id}`, r.created_by, `Renegociação #${r.id}`, iso(addPeriod(noon(new Date()), 'mensal', 1))]);
    let n = 1, bal = r2(financed + Number(r.down_payment));
    if (Number(r.down_payment) > 0) { await t.q(`INSERT INTO installments (loan_id, n, due_date, principal, interest, amount, balance_after) VALUES ($1,1,$2,$3,0,$3,$4)`, [nl.id, iso(addPeriod(noon(new Date()), 'diaria', 3)), r.down_payment, r2(bal - Number(r.down_payment))]); n = 2; bal = r2(bal - Number(r.down_payment)); }
    for (const row of schedule({ financed, monthlyRate: Number(old.monthly_rate), term: r.terms, periodicity: 'mensal', start: noon(new Date()) }).rows) { await t.q(`INSERT INTO installments (loan_id, n, due_date, principal, interest, amount, balance_after) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [nl.id, n++, row.due_date, row.principal, row.interest, row.amount, row.balance_after]); }
    await t.q(`UPDATE renegotiations SET status='aceita', decided_at=now() WHERE id=$1`, [id]); await t.q(`UPDATE collection_cases SET stage='acordo' WHERE loan_id=$1 AND closed_at IS NULL`, [r.loan_id]);
    return { renegotiation: r.id, new_loan_id: nl.id };
  });
}
