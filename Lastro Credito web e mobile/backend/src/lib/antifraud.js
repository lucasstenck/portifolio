// Motor antifraude baseado em regras. Cada regra gera um alerta com evidências para REVISÃO HUMANA:
// nenhuma decisão de recusa é automática — o alerta apenas sinaliza e bloqueia a aprovação até ser analisado.
import { one, all } from '../db.js';

const UF_BY_ZIP = [[1, 19, 'SP'], [20, 28, 'RJ'], [29, 29, 'ES'], [30, 39, 'MG'], [40, 48, 'BA'], [49, 49, 'SE'], [50, 56, 'PE'], [57, 57, 'AL'], [58, 58, 'PB'], [59, 59, 'RN'], [60, 63, 'CE'], [64, 64, 'PI'], [65, 65, 'MA'], [66, 68, 'PA'], [69, 69, 'AM'], [70, 73, 'DF'], [74, 76, 'GO'], [77, 77, 'TO'], [78, 78, 'MT'], [79, 79, 'MS'], [80, 87, 'PR'], [88, 89, 'SC'], [90, 99, 'RS']];
const ufOfZip = (zip) => { const n = parseInt(String(zip).replace(/\D/g, '').slice(0, 2), 10); const r = UF_BY_ZIP.find(([a, b]) => n >= a && n <= b); return r ? r[2] : null; };

export const RULES = {
  PHONE_SHARED: 'Telefone compartilhado entre cadastros', PHONE_UNVERIFIED: 'Telefone não verificado', CPF_DUPLICATE_ATTEMPT: 'Tentativa de cadastro com CPF já existente',
  DOC_MISMATCH: 'Divergência entre documento e cadastro', DOC_REUSED: 'Documento idêntico usado em outro cadastro', DOC_SUSPECT: 'Documento marcado como suspeito',
  ADDRESS_MISMATCH: 'CEP incompatível com o estado informado', INCOME_RATIO: 'Parcela incompatível com a renda declarada', DELINQUENCY: 'Histórico de inadimplência', VELOCITY: 'Várias solicitações em curto período', KYC_MISSING: 'Cadastro sem verificação de identidade aprovada',
};

async function raise(customerId, loanId, rule, severity, detail, evidence = {}) {
  const dup = await one(`SELECT id FROM fraud_alerts WHERE customer_id=$1 AND rule=$2 AND COALESCE(loan_id,0)=COALESCE($3,0) AND status IN ('aberto','em_analise')`, [customerId, rule, loanId]);
  if (dup) return null;
  return one(`INSERT INTO fraud_alerts (customer_id, loan_id, rule, severity, detail, evidence) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [customerId, loanId, rule, severity, detail, JSON.stringify(evidence)]);
}

export async function evaluateCustomer(customerId) {
  const out = [], c = await one(`SELECT c.*, u.phone, u.phone_verified_at FROM customers c LEFT JOIN users u ON u.id=c.user_id WHERE c.id=$1`, [customerId]);
  if (!c) return out;
  if (!c.phone_verified_at) out.push(await raise(c.id, null, 'PHONE_UNVERIFIED', 'media', 'O telefone do cliente ainda não foi confirmado por código.', { phone: c.phone }));
  if (c.phone) { const same = await all(`SELECT c2.id, c2.full_name FROM customers c2 JOIN users u2 ON u2.id=c2.user_id WHERE u2.phone=$1 AND c2.id<>$2`, [c.phone, c.id]); if (same.length) out.push(await raise(c.id, null, 'PHONE_SHARED', 'alta', `O mesmo telefone aparece em outro(s) cadastro(s): ${same.map((s) => s.full_name).join(', ')}.`, { others: same })); }
  const uf = ufOfZip(c.zip); if (uf && c.state && uf !== c.state) out.push(await raise(c.id, null, 'ADDRESS_MISMATCH', 'media', `O CEP ${c.zip} pertence a ${uf}, mas o estado informado é ${c.state}.`, { zip: c.zip, state: c.state, expected: uf }));
  const docs = await all(`SELECT * FROM documents WHERE customer_id=$1`, [c.id]);
  for (const d of docs) {
    if (d.status === 'suspeito') out.push(await raise(c.id, null, 'DOC_SUSPECT', 'alta', `Documento "${d.kind}" marcado como suspeito pela análise documental.`, { document: d.id, note: d.review_note }));
    const reuse = await all(`SELECT d2.customer_id FROM documents d2 WHERE d2.sha256=$1 AND d2.customer_id<>$2`, [d.sha256, c.id]);
    if (reuse.length) out.push(await raise(c.id, null, 'DOC_REUSED', 'alta', `O arquivo "${d.kind}" é idêntico a um enviado por outro cliente.`, { document: d.id, other_customers: reuse.map((r) => r.customer_id) }));
    if (d.review_note && /divergente|diverg/i.test(d.review_note)) out.push(await raise(c.id, null, 'DOC_MISMATCH', 'alta', `A análise documental registrou divergência: ${d.review_note}`, { document: d.id }));
  }
  const late = await one(`SELECT COALESCE(MAX(CURRENT_DATE - i.due_date),0) AS d FROM installments i JOIN loans l ON l.id=i.loan_id WHERE l.customer_id=$1 AND i.status IN ('aberta','atrasada') AND i.due_date<CURRENT_DATE`, [c.id]);
  if (late.d > 30) out.push(await raise(c.id, null, 'DELINQUENCY', late.d > 60 ? 'alta' : 'media', `Cliente possui parcela com ${late.d} dias de atraso.`, { days_overdue: late.d }));
  return out.filter(Boolean);
}

export async function evaluateLoan(loanId) {
  const out = [], l = await one(`SELECT l.*, c.monthly_income, c.kyc_status FROM loans l JOIN customers c ON c.id=l.customer_id WHERE l.id=$1`, [loanId]);
  if (!l) return out;
  out.push(...(await evaluateCustomer(l.customer_id)));
  const perMonth = Number(l.installment_value) * ({ diaria: 30, semanal: 30 / 7, mensal: 1 }[l.periodicity]);
  if (l.monthly_income && perMonth / Number(l.monthly_income) > 0.35) out.push(await raise(l.customer_id, l.id, 'INCOME_RATIO', perMonth / Number(l.monthly_income) > 0.5 ? 'alta' : 'media', `O compromisso mensal estimado (R$ ${perMonth.toFixed(2)}) equivale a ${(perMonth / Number(l.monthly_income) * 100).toFixed(0)}% da renda declarada.`, { monthly_commitment: perMonth, income: Number(l.monthly_income) }));
  const recent = await one(`SELECT COUNT(*)::int AS n FROM loans WHERE customer_id=$1 AND created_at > now() - interval '24 hours'`, [l.customer_id]);
  if (recent.n >= 2) out.push(await raise(l.customer_id, l.id, 'VELOCITY', 'media', `${recent.n} solicitações de empréstimo em 24 horas.`, { count: recent.n }));
  if (l.kyc_status !== 'aprovado') out.push(await raise(l.customer_id, l.id, 'KYC_MISSING', 'media', 'A identidade do cliente ainda não foi aprovada na análise documental.', { kyc: l.kyc_status }));
  return out.filter(Boolean);
}

/** Score interno (0–1000) para apoiar o analista; NÃO é decisão automática. */
export async function scoreCustomer(customerId) {
  const c = await one(`SELECT c.*, u.phone_verified_at FROM customers c LEFT JOIN users u ON u.id=c.user_id WHERE c.id=$1`, [customerId]);
  let s = 600; if (c.kyc_status === 'aprovado') s += 120; if (c.phone_verified_at) s += 40; if (Number(c.monthly_income) >= 3000) s += 50;
  const paid = await one(`SELECT COUNT(*) FILTER (WHERE i.status='paga' AND i.paid_at::date <= i.due_date)::int AS ontime, COUNT(*) FILTER (WHERE i.status='paga' AND i.paid_at::date > i.due_date)::int AS late, COUNT(*) FILTER (WHERE i.status IN ('aberta','atrasada') AND i.due_date < CURRENT_DATE)::int AS overdue FROM installments i JOIN loans l ON l.id=i.loan_id WHERE l.customer_id=$1`, [customerId]);
  s += Math.min(150, paid.ontime * 15) - paid.late * 25 - paid.overdue * 90;
  const alerts = await one(`SELECT COUNT(*) FILTER (WHERE severity='alta' AND status IN ('aberto','em_analise'))::int AS h, COUNT(*) FILTER (WHERE severity='media' AND status IN ('aberto','em_analise'))::int AS m FROM fraud_alerts WHERE customer_id=$1`, [customerId]);
  s -= alerts.h * 120 + alerts.m * 40;
  return Math.max(0, Math.min(1000, Math.round(s)));
}
