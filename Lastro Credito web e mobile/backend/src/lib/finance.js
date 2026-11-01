// Regras financeiras: tabela Price, taxas por periodicidade, IOF, CET (TIR), encargos de atraso, quitação e amortização.
export const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const PERIOD_DAYS = { diaria: 1, semanal: 7, mensal: 30 };
// Parâmetros regulatórios (configuráveis): multa moratória limitada a 2% (CDC art. 52 §1º); juros de mora de 1% a.m.;
// IOF PF: 0,38% + 0,0082% ao dia (máx. 365 dias). Alíquotas de referência: conferir a norma vigente antes de produção.
export const RULES = { lateFine: 0.02, lateInterestMonthly: 0.01, iofFixed: 0.0038, iofDaily: 0.000082, iofMaxDays: 365 };

export const periodRate = (monthlyPct, periodicity) => Math.pow(1 + monthlyPct / 100, PERIOD_DAYS[periodicity] / 30) - 1;
export const pmt = (pv, r, n) => (r === 0 ? pv / n : (pv * r) / (1 - Math.pow(1 + r, -n)));
export const iso = (d) => d.toISOString().slice(0, 10);
export const parseDate = (s) => new Date(String(s).slice(0, 10) + 'T12:00:00Z');
export const daysBetween = (a, b) => Math.floor((b - a) / 86400000);
export const noon = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12));

export function addPeriod(date, periodicity, k = 1) {
  const d = new Date(date.getTime());
  if (periodicity === 'mensal') {
    const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + k);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last));
  } else d.setUTCDate(d.getUTCDate() + k * PERIOD_DAYS[periodicity]);
  return d;
}

/** Tabela Price sobre `financed`. Devolve parcelas com juros, amortização e saldo. */
export function schedule({ financed, monthlyRate, term, periodicity, start }) {
  const r = periodRate(monthlyRate, periodicity), p = r2(pmt(financed, r, term));
  let bal = financed; const rows = [];
  for (let n = 1; n <= term; n++) {
    const interest = r2(bal * r); let principal = r2(p - interest), amount = p;
    if (n === term) { principal = r2(bal); amount = r2(principal + interest); }
    bal = r2(bal - principal);
    rows.push({ n, due_date: iso(addPeriod(start, periodicity, n)), principal, interest, amount, balance_after: Math.max(0, bal) });
  }
  return { rate: r, installment: p, rows };
}

/** IOF: alíquota fixa sobre o principal + alíquota diária sobre a amortização de cada parcela. */
export function iofFor(principal, rows, startDate) {
  let iof = principal * RULES.iofFixed;
  for (const row of rows) {
    const days = Math.min(RULES.iofMaxDays, Math.max(0, Math.round((parseDate(row.due_date) - startDate) / 86400000)));
    iof += row.principal * RULES.iofDaily * days;
  }
  return r2(iof);
}

/** CET mensal: taxa interna de retorno do fluxo (recebido hoje x parcelas) convertida para 30 dias. */
export function cetMonthly(received, rows, startDate) {
  const f = (rate) => rows.reduce((a, row) => a + row.amount / Math.pow(1 + rate, Math.max(1, (parseDate(row.due_date) - startDate) / 86400000)), 0) - received;
  let lo = 0, hi = 1;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
  return Math.round((Math.pow(1 + lo, 30) - 1) * 10000) / 100;
}

/** Simulação completa de empréstimo. */
export function simulate({ principal, term, periodicity = 'mensal', monthlyRate, start = new Date(), withIof = true }) {
  const st = noon(start);
  let s = schedule({ financed: principal, monthlyRate, term, periodicity, start: st });
  const iof = withIof ? iofFor(principal, s.rows, st) : 0;
  if (iof) s = schedule({ financed: r2(principal + iof), monthlyRate, term, periodicity, start: st });
  const total = r2(s.rows.reduce((a, x) => a + x.amount, 0)), cet = cetMonthly(principal, s.rows, st);
  return { principal, iof, financed: r2(principal + iof), term, periodicity, monthlyRate, periodRate: s.rate, installment: s.installment, total, interestTotal: r2(total - principal - iof), cet, cetYear: Math.round((Math.pow(1 + cet / 100, 12) - 1) * 10000) / 100, rows: s.rows, firstDue: s.rows[0].due_date };
}

/** Encargos de atraso: multa de 2% + juros de mora de 1% a.m. pro rata die (juros simples). */
export function lateCharges(amount, daysLate) {
  if (daysLate <= 0) return { fine: 0, interest: 0, total: r2(amount) };
  const fine = r2(amount * RULES.lateFine), interest = r2(amount * (RULES.lateInterestMonthly / 30) * daysLate);
  return { fine, interest, total: r2(amount + fine + interest) };
}

/** Saldo devedor e valor de quitação antecipada (juros proporcionais ao prazo restante, CDC art. 52 §2º). */
export function payoff({ installments, monthlyRate, periodicity, today = new Date() }) {
  const open = installments.filter((i) => i.status !== 'paga' && i.status !== 'renegociada').sort((a, b) => a.n - b.n);
  const t = noon(today), r = periodRate(monthlyRate, periodicity), pd = PERIOD_DAYS[periodicity];
  const due = (i) => parseDate(i.due_date), left = (i) => Number(i.amount) - Number(i.paid_amount || 0);
  const overdueRows = open.filter((i) => due(i) < t), futureRows = open.filter((i) => due(i) >= t);
  let fines = 0, lateInt = 0, overdue = 0;
  for (const i of overdueRows) { const c = lateCharges(left(i), daysBetween(due(i), t)); overdue += left(i); fines += c.fine; lateInt += c.interest; }
  const futurePrincipal = futureRows.reduce((a, i) => a + Number(i.principal), 0);
  const next = futureRows[0]; let accrued = 0;
  if (next) {
    const prev = open.find((i) => i.n === next.n - 1) || null;
    const periodStart = prev ? due(prev) : new Date(due(next).getTime() - pd * 86400000);
    const elapsed = Math.max(0, Math.min(pd, daysBetween(periodStart, t)));
    accrued = futurePrincipal * r * (elapsed / pd);
  }
  return { outstanding: r2(open.reduce((a, i) => a + Number(i.principal), 0)), payoffToday: r2(futurePrincipal + accrued + overdue + fines + lateInt), overdue: r2(overdue), fines: r2(fines), lateInterest: r2(lateInt), remaining: open.length };
}

/** Amortização extraordinária: abate o principal e recalcula as parcelas futuras mantendo o prazo. */
export function amortize({ openRows, amount, monthlyRate, periodicity }) {
  const r = periodRate(monthlyRate, periodicity), rows = openRows.slice().sort((a, b) => a.n - b.n);
  const balance = r2(rows.reduce((a, x) => a + Number(x.principal), 0)), newBal = r2(Math.max(0, balance - amount)), n = rows.length;
  if (!newBal) return rows.map((x) => ({ ...x, principal: 0, interest: 0, amount: 0, balance_after: 0 }));
  const p = r2(pmt(newBal, r, n)); let bal = newBal;
  return rows.map((x, idx) => {
    const interest = r2(bal * r); let principal = r2(p - interest), amt = p;
    if (idx === n - 1) { principal = r2(bal); amt = r2(principal + interest); }
    bal = r2(bal - principal);
    return { ...x, principal, interest, amount: amt, balance_after: Math.max(0, bal) };
  });
}

/** Renegociação: desconto sobre o total devido, entrada e novas parcelas (Price). */
export function renegotiate({ balanceWithCharges, discountPct, downPayment, terms, monthlyRate }) {
  const discount = r2(balanceWithCharges * discountPct / 100), base = r2(balanceWithCharges - discount), financed = r2(base - downPayment);
  const r = periodRate(monthlyRate, 'mensal'), p = r2(pmt(financed, r, terms));
  return { discount, newTotal: r2(downPayment + p * terms), installment: p, financed };
}
