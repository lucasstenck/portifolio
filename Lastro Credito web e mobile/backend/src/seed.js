// Dados DEMONSTRATIVOS (100% fictícios): clientes, empréstimos em vários estágios, pagamentos, atrasos, contratos e alertas.
// CPFs são sintéticos (válidos matematicamente, gerados por algoritmo); telefones usam DDD real com número fictício.
import crypto from 'node:crypto';
import { one, all, q } from './db.js';
import { hashPassword, encrypt, blindIndex, genCpf, newTotpSecret } from './lib/crypto.js';
import { simulate, noon, iso, parseDate } from './lib/finance.js';
import { evaluateCustomer, evaluateLoan, scoreCustomer } from './lib/antifraud.js';
import { generateContract } from './services/loans.js';
import { runDailyJobs, createRenegotiation } from './services/loans.js';

export const DEMO = { password: 'Lastro@2026demo', adminEmail: 'camila.ribeiro@lastro.dev', adminTotpSecret: 'JBSWY3DPEHPK3PXP', staffEmail: 'rafael.teixeira@lastro.dev', clientEmail: 'marina.albuquerque@exemplo.com.br' };
const rng = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const R = rng(2026), pick = (a) => a[Math.floor(R() * a.length)], between = (a, b) => a + Math.floor(R() * (b - a + 1));
const daysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return noon(d); };

const NAMES = ['Marina Albuquerque', 'Rodrigo Mendonça', 'Camila Teixeira', 'Bruno Carvalho', 'Letícia Nunes', 'Thiago Barros', 'Juliana Prado', 'Diego Ramos', 'Fernanda Castro', 'Marcos Vinícius Lima', 'Patrícia Duarte', 'Eduardo Pires', 'Aline Moreira', 'Gustavo Siqueira', 'Renata Faria', 'Felipe Andrade', 'Larissa Moura', 'Rafael Oliveira', 'Vanessa Cardoso', 'André Luiz Ribeiro', 'Tatiane Lopes', 'Wellington Barros', 'Wesley Barros', 'Cláudio Menezes', 'Bianca Ferraz', 'Sérgio Nogueira', 'Priscila Tavares', 'Leandro Fonseca', 'Mariana Gouveia', 'Ricardo Almeida', 'Carolina Esteves', 'Henrique Batista', 'Natália Rezende', 'Otávio Campos', 'Simone Vasconcelos', 'Vítor Hugo Lacerda', 'Débora Matos', 'Igor Azevedo'];
const PLACES = [['São Paulo', 'SP', '01310100', 'Bela Vista'], ['São Paulo', 'SP', '04538132', 'Itaim Bibi'], ['Campinas', 'SP', '13015904', 'Centro'], ['Rio de Janeiro', 'RJ', '22041001', 'Copacabana'], ['Niterói', 'RJ', '24220000', 'Icaraí'], ['Belo Horizonte', 'MG', '30130010', 'Savassi'], ['Curitiba', 'PR', '80250104', 'Batel'], ['Porto Alegre', 'RS', '90010150', 'Centro Histórico'], ['Salvador', 'BA', '40015000', 'Comércio'], ['Recife', 'PE', '50030230', 'Boa Vista'], ['Fortaleza', 'CE', '60160230', 'Aldeota'], ['Goiânia', 'GO', '74000010', 'Setor Central']];
const STREETS = ['Rua das Acácias', 'Av. Brasil', 'Rua Quinze de Novembro', 'Rua dos Ipês', 'Av. Paulista', 'Rua Augusta', 'Av. Atlântica', 'Rua Sete de Setembro'];
const JOBS = ['Analista administrativo', 'Motorista de aplicativo', 'Professora', 'Comerciante', 'Técnico de enfermagem', 'Autônomo', 'Vendedora', 'Designer', 'Eletricista', 'Contadora', 'Cozinheiro', 'Representante comercial'];
const PURPOSES = ['Capital de giro', 'Reforma da casa', 'Quitar dívidas', 'Compra de equipamento', 'Despesas médicas', 'Estoque da loja', 'Educação', 'Viagem'];

async function mkUser(role, name, email, phone, extra = {}) {
  return one(`INSERT INTO users (role, name, email, phone, phone_verified_at, password_hash, totp_secret, totp_enabled) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [role, name, email, phone, extra.unverified ? null : new Date(), hashPassword(DEMO.password), extra.totp ? encrypt(extra.totp) : null, !!extra.totp]);
}

export async function seed() {
  if (await one(`SELECT 1 FROM users LIMIT 1`)) return false;
  // produtos
  await q(`INSERT INTO loan_products (name, min_amount, max_amount, min_term, max_term, monthly_rate, periodicities) VALUES
    ('Crédito Pessoal', 500, 30000, 3, 36, 3.49, '{mensal}'), ('Crédito Semanal', 300, 8000, 2, 12, 4.20, '{semanal,mensal}'), ('Capital de Giro Diário', 300, 5000, 1, 6, 4.90, '{diaria,semanal,mensal}'), ('Crédito Premium', 15000, 100000, 6, 60, 2.29, '{mensal}')`);
  // equipe
  const admin = await mkUser('admin', 'Camila Ribeiro', DEMO.adminEmail, '11988410001', { totp: DEMO.adminTotpSecret });
  const staff = await mkUser('staff', 'Rafael Teixeira', DEMO.staffEmail, '11988410002');
  const staff2 = await mkUser('staff', 'Juliana Prado', 'juliana.prado@lastro.dev', '11988410003');
  // clientes
  const cust = [];
  for (let i = 0; i < NAMES.length; i++) {
    const name = NAMES[i], isMarina = i === 0, place = i === 0 ? PLACES[1] : pick(PLACES), first = name.split(' ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), last = name.split(' ').slice(-1)[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    let phone = `119${String(88000000 + i * 1733 + between(100, 999)).slice(0, 8)}`; if (name === 'Wesley Barros') phone = cust.find((c) => c.name === 'Wellington Barros').phone;       // telefone compartilhado (antifraude)
    const email = isMarina ? DEMO.clientEmail : `${first}.${last}${i}@exemplo.com.br`, cpf = genCpf(i + 11);
    const u = await mkUser('client', name, email, phone, { unverified: name === 'Cláudio Menezes' });
    const state = name === 'Bianca Ferraz' ? 'RJ' : place[1], zip = place[2];                                    // Bianca: CEP de SP com UF RJ
    const income = isMarina ? 7800 : between(18, 120) * 100, birth = `${between(1968, 2001)}-${String(between(1, 12)).padStart(2, '0')}-${String(between(1, 28)).padStart(2, '0')}`;
    const kyc = ['Cláudio Menezes'].includes(name) ? 'em_analise' : name === 'Tatiane Lopes' ? 'em_analise' : i % 11 === 10 ? 'em_analise' : 'aprovado';
    const c = await one(`INSERT INTO customers (user_id, full_name, cpf_enc, cpf_idx, cpf_last3, birth_date, mother_name, monthly_income, occupation, zip, street, number, district, city, state, kyc_status, kyc_reviewed_by, kyc_reviewed_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`, [u.id, name, encrypt(cpf), blindIndex(cpf), cpf.slice(-3), birth, `${pick(['Maria', 'Ana', 'Lúcia', 'Helena', 'Rosa'])} ${name.split(' ').slice(-1)[0]}`, income, isMarina ? 'Analista de marketing' : pick(JOBS), zip, pick(STREETS), String(between(10, 2400)), place[3], place[0], state, kyc, kyc === 'aprovado' ? admin.id : null, kyc === 'aprovado' ? daysAgo(between(30, 240)) : null, daysAgo(between(40, 260))]);
    for (const [kind, st] of [['rg_frente', 'aprovado'], ['selfie', 'aprovado'], ['comprovante_residencia', 'aprovado']]) await q(`INSERT INTO documents (customer_id, kind, file_name, mime, size_bytes, sha256, status) VALUES ($1,$2,$3,'image/jpeg',$4,$5,$6)`, [c.id, kind, `${kind}.jpg`, between(180000, 900000), crypto.createHash('sha256').update(`${i}-${kind}`).digest('hex'), kyc === 'aprovado' ? st : 'pendente']);
    for (const [p, g] of [['termos_privacidade', true], ['analise_credito', true], ['comunicacao_sms_whatsapp', name !== 'Rodrigo Mendonça' && i % 7 !== 3]]) await q(`INSERT INTO consents (customer_id, purpose, granted, version, ip) VALUES ($1,$2,$3,'2026-01','187.12.34.5')`, [c.id, p, g]);
    cust.push({ id: c.id, userId: u.id, name, phone, income, kyc });
  }
  const byName = (n) => cust.find((c) => c.name === n);
  // documentos com problemas (antifraude)
  await q(`UPDATE documents SET review_note='Leitura automática (sandbox): nome no documento divergente do cadastro.', status='pendente' WHERE customer_id=$1 AND kind='rg_frente'`, [byName('Tatiane Lopes').id]);
  await q(`UPDATE documents SET status='suspeito', review_note='Possível adulteração detectada (sandbox).' WHERE customer_id=$1 AND kind='comprovante_residencia'`, [byName('Vítor Hugo Lacerda').id]);
  await q(`UPDATE documents SET sha256=(SELECT sha256 FROM documents WHERE customer_id=$1 AND kind='selfie') WHERE customer_id=$2 AND kind='selfie'`, [byName('Igor Azevedo').id, byName('Débora Matos').id]);

  // empréstimos
  const prods = await all(`SELECT * FROM loan_products ORDER BY id`);
  const mk = async ({ c, principal, term, per, product, ageDays, status = 'ativo', lateness = 0, purpose }) => {
    const p = prods[product], start = daysAgo(ageDays), sim = simulate({ principal, term, periodicity: per, monthlyRate: Number(p.monthly_rate), start });
    const loan = await one(`INSERT INTO loans (customer_id, product_id, principal, term, periodicity, monthly_rate, period_rate, iof, installment_value, total_amount, cet_monthly, purpose, status, analyst_id, decision_note, decided_at, first_due, disbursed_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'Aprovado conforme política de crédito',$15,$16,$15,$15) RETURNING *`, [c.id, p.id, principal, term, per, p.monthly_rate, sim.periodRate, sim.iof, sim.installment, sim.total, sim.cet, purpose || pick(PURPOSES), status, pick([staff.id, admin.id, staff2.id]), start, sim.firstDue]);
    await q(`INSERT INTO contracts (loan_id, code, doc_sha256, generated_at, signed_at, signer_ip, sign_ref, signature_hash) VALUES ($1,$2,$3,$4,$4,'187.12.34.5',$5,$6)`, [loan.id, `LST-${start.getUTCFullYear()}-${String(loan.id).padStart(6, '0')}`, crypto.createHash('sha256').update('doc' + loan.id).digest('hex'), start, 'sbx-sign-' + loan.id, crypto.createHash('sha256').update('sig' + loan.id).digest('hex')]);
    const today = noon(new Date()); let skipped = 0;
    for (const r of sim.rows) {
      const due = parseDate(r.due_date), isPast = due < today, mustBeLate = lateness > 0 && isPast && (today - due) / 86400000 <= lateness + 2 && skipped++ < 1 + Math.floor(lateness / 25);
      const paid = status === 'quitado' ? true : isPast && !mustBeLate;
      const row = await one(`INSERT INTO installments (loan_id, n, due_date, principal, interest, amount, balance_after, paid_amount, paid_at, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [loan.id, r.n, r.due_date, r.principal, r.interest, r.amount, r.balance_after, paid ? r.amount : 0, paid ? new Date(due.getTime() - between(0, 2) * 86400000 + between(8, 17) * 3600000) : null, paid ? 'paga' : isPast ? 'atrasada' : 'aberta']);
      if (paid) await q(`INSERT INTO payments (loan_id, installment_id, customer_id, kind, amount, receipt_code, sandbox, paid_at) VALUES ($1,$2,$3,'parcela',$4,$5,TRUE,$6)`, [loan.id, row.id, c.id, r.amount, 'RCB-' + crypto.randomBytes(5).toString('hex').toUpperCase(), new Date(due.getTime() - between(0, 2) * 86400000 + between(8, 17) * 3600000)]);
    }
    if (status === 'quitado') await q(`UPDATE loans SET closed_at=$2 WHERE id=$1`, [loan.id, daysAgo(between(5, 40))]);
    return loan;
  };
  const marina = byName('Marina Albuquerque');
  await mk({ c: marina, principal: 3000, term: 6, per: 'mensal', product: 0, ageDays: 260, status: 'quitado', purpose: 'Reforma da casa' });
  await mk({ c: marina, principal: 8000, term: 12, per: 'mensal', product: 0, ageDays: 86, purpose: 'Capital de giro' });
  const plan = [['Rodrigo Mendonça', 12000, 24, 'mensal', 0, 140, 0], ['Camila Teixeira', 2500, 8, 'semanal', 1, 49, 0], ['Bruno Carvalho', 1800, 4, 'semanal', 1, 21, 0], ['Letícia Nunes', 5000, 18, 'mensal', 0, 120, 0], ['Thiago Barros', 900, 3, 'diaria', 2, 5, 0], ['Juliana Prado', 20000, 30, 'mensal', 3, 190, 0], ['Diego Ramos', 3500, 10, 'mensal', 0, 188, 38], ['Fernanda Castro', 7500, 12, 'mensal', 0, 100, 0], ['Marcos Vinícius Lima', 1500, 6, 'semanal', 1, 56, 24], ['Patrícia Duarte', 4200, 6, 'mensal', 0, 160, 0], ['Eduardo Pires', 2800, 4, 'diaria', 2, 4, 0], ['Aline Moreira', 6200, 12, 'mensal', 0, 110, 0], ['Gustavo Siqueira', 15000, 24, 'mensal', 3, 150, 0], ['Renata Faria', 3300, 5, 'semanal', 1, 28, 0], ['Felipe Andrade', 9800, 15, 'mensal', 0, 123, 63], ['Larissa Moura', 2200, 6, 'mensal', 0, 95, 0], ['Rafael Oliveira', 5400, 9, 'mensal', 0, 220, 0], ['Vanessa Cardoso', 1200, 4, 'semanal', 1, 20, 0], ['André Luiz Ribeiro', 11000, 20, 'mensal', 0, 104, 14], ['Sérgio Nogueira', 4600, 8, 'mensal', 0, 75, 0], ['Priscila Tavares', 2900, 6, 'semanal', 1, 40, 0], ['Leandro Fonseca', 7200, 12, 'mensal', 0, 165, 45], ['Mariana Gouveia', 18000, 36, 'mensal', 3, 170, 0], ['Ricardo Almeida', 3100, 3, 'diaria', 2, 3, 0], ['Carolina Esteves', 5800, 10, 'mensal', 0, 90, 0]];
  for (const [n, principal, term, per, product, age, late] of plan) await mk({ c: byName(n), principal, term, per, product, ageDays: age, lateness: late });
  for (const [n, principal, term, age] of [['Henrique Batista', 2000, 5, 300], ['Natália Rezende', 4500, 9, 280], ['Otávio Campos', 1000, 4, 190], ['Simone Vasconcelos', 6000, 10, 340]]) await mk({ c: byName(n), principal, term, per: 'mensal', product: 0, ageDays: age, status: 'quitado' });

  // solicitações em fila (para o painel de aprovações)
  const pend = async (n, principal, term, per, product, status, hoursAgo) => { const c = byName(n), p = prods[product], s = simulate({ principal, term, periodicity: per, monthlyRate: Number(p.monthly_rate) }); return one(`INSERT INTO loans (customer_id, product_id, principal, term, periodicity, monthly_rate, period_rate, iof, installment_value, total_amount, cet_monthly, purpose, status, first_due, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now() - ($15 || ' hours')::interval) RETURNING *`, [c.id, p.id, principal, term, per, p.monthly_rate, s.periodRate, s.iof, s.installment, s.total, s.cet, pick(PURPOSES), status, s.firstDue, hoursAgo]); };
  await pend('Cláudio Menezes', 22000, 24, 'mensal', 0, 'pendente', 3);          // renda incompatível + telefone não verificado
  await pend('Tatiane Lopes', 6500, 10, 'mensal', 0, 'pendente', 5);             // documento divergente
  await pend('Wesley Barros', 4000, 6, 'mensal', 0, 'em_analise', 20);           // telefone compartilhado
  await pend('Bianca Ferraz', 9000, 12, 'mensal', 0, 'pendente', 28);            // CEP x UF
  await pend('Débora Matos', 2500, 5, 'semanal', 1, 'pendente', 30);             // documento reutilizado
  await pend('Igor Azevedo', 3200, 8, 'mensal', 0, 'em_analise', 44);
  await pend('Vítor Hugo Lacerda', 5200, 9, 'mensal', 0, 'pendente', 50);        // documento suspeito
  const aproved = await pend('Natália Rezende', 3800, 8, 'mensal', 0, 'assinatura', 70); await generateContract(aproved.id);
  await q(`INSERT INTO fraud_alerts (customer_id, rule, severity, detail, evidence) VALUES ($1,'CPF_DUPLICATE_ATTEMPT','alta','Nova tentativa de cadastro com um CPF já existente.', $2)`, [byName('Rodrigo Mendonça').id, JSON.stringify({ email: 'rodrigo.m@outro-email.com', phone: '11977770000', ip: '177.54.12.9' })]);

  // jobs, alertas e score
  await runDailyJobs();
  for (const c of cust) await evaluateCustomer(c.id);
  for (const l of await all(`SELECT id FROM loans WHERE status IN ('pendente','em_analise')`)) await evaluateLoan(l.id);
  for (const c of cust) await q(`UPDATE customers SET risk_score=$2 WHERE id=$1`, [c.id, await scoreCustomer(c.id)]);
  // alguns alertas já revisados (histórico)
  await q(`UPDATE fraud_alerts SET status='descartado', reviewer_id=$1, reviewer_note='Confirmado por contato telefônico: cliente reside no endereço informado.', reviewed_at=now() - interval '2 days' WHERE rule='DELINQUENCY' AND id IN (SELECT id FROM fraud_alerts WHERE rule='DELINQUENCY' ORDER BY id LIMIT 1)`, [staff.id]);
  // cobranças: contatos registrados e uma proposta de acordo
  const cases = await all(`SELECT cc.*, u.phone FROM collection_cases cc JOIN customers c ON c.id=cc.customer_id LEFT JOIN users u ON u.id=c.user_id WHERE cc.closed_at IS NULL ORDER BY days_overdue DESC`);
  for (const [k, cc] of cases.entries()) {
    const n = Math.min(3, 1 + (k % 3));
    for (let j = 0; j < n; j++) await q(`INSERT INTO contact_logs (case_id, customer_id, channel, outcome, message, consent_checked, by_user, created_at) VALUES ($1,$2,$3,$4,$5,TRUE,$6, now() - ($7 || ' days')::interval)`, [cc.id, cc.customer_id, ['sms', 'whatsapp', 'ligacao'][j % 3], ['enviado', 'sem resposta', 'promessa de pagamento'][j % 3], ['Olá! Identificamos uma parcela em aberto. Pague pelo Pix no app.', 'Prometeu pagar até sexta-feira.', 'Cliente solicitou condições para acordo.'][j % 3], pick([staff.id, staff2.id]), (n - j) * 3]);
  }
  const bigLate = cases[0]; if (bigLate) { const r = await createRenegotiation({ loanId: bigLate.loan_id, discountPct: 15, downPayment: 500, terms: 6, userId: staff.id }); await q(`UPDATE collection_cases SET stage='negociacao' WHERE id=$1`, [bigLate.id]); }
  await q(`INSERT INTO support_tickets (customer_id, subject, message) VALUES ($1,'Dúvida sobre antecipação de parcelas','Gostaria de saber como antecipar as últimas parcelas do meu contrato com desconto de juros.'), ($2,'Atualização de endereço','Mudei de apartamento e preciso atualizar meu comprovante de residência.')`, [marina.id, byName('Letícia Nunes').id]);
  await q(`INSERT INTO notifications (user_id, kind, title, body, created_at) VALUES ($1,'payment','Pagamento confirmado','Recebemos R$ 805,67 da parcela 2. Seu comprovante já está disponível.', now() - interval '28 days'), ($1,'due','Parcela vence em 3 dias','A parcela 3 vence em breve. Pague via Pix no app.', now() - interval '2 days'), ($1,'kyc','Identidade verificada','Sua identidade foi aprovada. Você já pode solicitar um empréstimo.', now() - interval '80 days')`, [marina.userId]);
  await q(`INSERT INTO notifications (user_id, kind, title, body) VALUES ($1,'loan','Nova solicitação de empréstimo','Cláudio Menezes solicitou R$ 22.000,00 em 24x (3 alerta(s) antifraude).'), ($1,'kyc','Nova análise documental','Tatiane Lopes enviou documentos para verificação.')`, [admin.id]);
  return true;
}
