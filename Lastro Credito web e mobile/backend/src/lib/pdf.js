// Contrato de mútuo e recibos em PDF (PDFKit). A integridade é garantida pelo hash SHA-256 do documento.
import PDFDocument from 'pdfkit';
import { sha256 } from './crypto.js';

const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dt = (s) => new Date(String(s).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const render = (draw) => new Promise((res) => { const d = new PDFDocument({ size: 'A4', margin: 56, info: { Title: 'Documento Lastro', Producer: 'Lastro' } }), bufs = []; d.on('data', (b) => bufs.push(b)); d.on('end', () => res(Buffer.concat(bufs))); draw(d); d.end(); });
const head = (d, title, code) => {
  d.rect(0, 0, d.page.width, 78).fill('#0f2f2b'); d.fillColor('#7ee0b5').fontSize(20).font('Helvetica-Bold').text('lastro', 56, 28); d.fillColor('#cfe6df').fontSize(9).font('Helvetica').text('GESTÃO DE CRÉDITO', 56, 52);
  d.fillColor('#ffffff').fontSize(10).text(code, 0, 34, { align: 'right', width: d.page.width - 56 });
  d.fillColor('#0e1514').fontSize(17).font('Helvetica-Bold').text(title, 56, 104); d.moveDown(0.6);
};
const kv = (d, k, v) => { d.font('Helvetica').fontSize(9.5).fillColor('#6b7a77').text(k.toUpperCase(), { continued: false }); d.font('Helvetica-Bold').fontSize(11).fillColor('#0e1514').text(v); d.moveDown(0.35); };

export async function contractPdf({ code, loan, customer, rows, cet, cetYear, signature }) {
  const buf = await render((d) => {
    head(d, 'Contrato de Mútuo e Confissão de Condições', code);
    d.font('Helvetica').fontSize(10).fillColor('#3a4543').text('Pelo presente instrumento particular, as partes abaixo qualificadas ajustam o mútuo financeiro descrito neste documento, regido pelas condições a seguir e pela legislação aplicável, em especial o Código de Defesa do Consumidor (Lei 8.078/1990) e a Lei Geral de Proteção de Dados (Lei 13.709/2018).', { align: 'justify' }); d.moveDown(0.8);
    d.font('Helvetica-Bold').fontSize(11).fillColor('#0f2f2b').text('1. PARTES'); d.moveDown(0.3);
    kv(d, 'Credora', 'Lastro Crédito Ltda. (ambiente de demonstração, sem CNPJ real)'); kv(d, 'Devedor(a)', `${customer.full_name} — CPF ${customer.cpf_masked}`); kv(d, 'Endereço', `${customer.street}, ${customer.number} — ${customer.district}, ${customer.city}/${customer.state}`);
    d.font('Helvetica-Bold').fontSize(11).fillColor('#0f2f2b').text('2. CONDIÇÕES FINANCEIRAS'); d.moveDown(0.3);
    const periodo = { diaria: 'diárias', semanal: 'semanais', mensal: 'mensais' }[loan.periodicity];
    kv(d, 'Valor liberado', brl(loan.principal)); kv(d, 'IOF financiado', brl(loan.iof)); kv(d, 'Prazo e parcelas', `${loan.term} parcelas ${periodo} de ${brl(loan.installment_value)}`); kv(d, 'Taxa de juros', `${Number(loan.monthly_rate).toFixed(2).replace('.', ',')}% ao mês`); kv(d, 'Custo Efetivo Total (CET)', `${String(cet).replace('.', ',')}% ao mês • ${String(cetYear).replace('.', ',')}% ao ano`); kv(d, 'Valor total a pagar', brl(loan.total_amount)); kv(d, '1º vencimento', dt(loan.first_due));
    d.addPage(); head(d, 'Cronograma de pagamento', code);
    const x = [56, 96, 196, 286, 376, 466]; d.font('Helvetica-Bold').fontSize(8.5).fillColor('#6b7a77'); ['Nº', 'VENCIMENTO', 'AMORTIZAÇÃO', 'JUROS', 'PARCELA', 'SALDO'].forEach((h, i) => d.text(h, x[i], d.y + (i ? -d.currentLineHeight() : 0), { width: 90, lineBreak: false })); d.moveDown(1.1);
    rows.forEach((r) => { if (d.y > 760) { d.addPage(); d.y = 70; } const y = d.y; d.font('Helvetica').fontSize(9).fillColor('#0e1514'); [String(r.n), dt(r.due_date), brl(r.principal), brl(r.interest), brl(r.amount), brl(r.balance_after)].forEach((v, i) => d.text(v, x[i], y, { width: 90, lineBreak: false })); d.moveDown(0.95); d.moveTo(56, d.y - 2).lineTo(540, d.y - 2).strokeColor('#e2e0d8').lineWidth(0.5).stroke(); });
    d.addPage(); head(d, 'Cláusulas gerais', code);
    const cl = [['3. ENCARGOS POR ATRASO', 'Em caso de atraso incidirão multa moratória de 2% (dois por cento) sobre a parcela e juros de mora de 1% (um por cento) ao mês, calculados pro rata die, conforme art. 52, §1º do CDC.'], ['4. LIQUIDAÇÃO ANTECIPADA', 'É assegurado ao devedor liquidar antecipadamente, total ou parcialmente, o débito, com redução proporcional dos juros e demais acréscimos, nos termos do art. 52, §2º do CDC.'], ['5. PAGAMENTO', 'Os pagamentos serão feitos via Pix, com baixa e emissão de recibo automáticos após a confirmação do prestador de serviços de pagamento.'], ['6. PROTEÇÃO DE DADOS', 'Os dados pessoais são tratados para análise de crédito, prevenção a fraudes, cobrança e cumprimento de obrigações legais, com base na LGPD. O titular pode exercer seus direitos pelo canal de atendimento.'], ['7. COBRANÇA', 'Contatos de cobrança respeitarão horários razoáveis e os canais autorizados pelo devedor, sem exposição a constrangimento (art. 42 do CDC).'], ['8. ASSINATURA ELETRÔNICA', 'As partes reconhecem a validade da assinatura eletrônica nos termos da MP 2.200-2/2001 e da Lei 14.063/2020.'], ['9. FORO', 'Fica eleito o foro do domicílio do devedor.']];
    cl.forEach(([t, b]) => { d.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f2f2b').text(t); d.font('Helvetica').fontSize(10).fillColor('#3a4543').text(b, { align: 'justify' }); d.moveDown(0.7); });
    d.moveDown(1); d.font('Helvetica-Bold').fontSize(11).fillColor('#0f2f2b').text('ASSINATURA ELETRÔNICA'); d.moveDown(0.3);
    if (signature) { d.font('Helvetica').fontSize(9.5).fillColor('#0e1514').text(`Assinado eletronicamente por ${customer.full_name} em ${new Date(signature.at).toLocaleString('pt-BR')}\nIP ${signature.ip} • Provedor ${signature.provider} (sandbox) • Protocolo ${signature.ref}\nHash da assinatura: ${signature.hash}`); }
    else d.font('Helvetica').fontSize(9.5).fillColor('#a8741a').text('Aguardando assinatura do devedor.');
    d.moveDown(1.5); d.font('Helvetica-Oblique').fontSize(8.5).fillColor('#8a9794').text('Documento gerado em ambiente de demonstração. Não constitui oferta nem contrato real de crédito.', { align: 'center' });
  });
  return { buffer: buf, sha256: sha256(buf) };
}

export async function receiptPdf({ code, payment, customer, loan, installment }) {
  const buf = await render((d) => {
    head(d, 'Comprovante de pagamento', code);
    d.rect(56, 140, 483, 62).fill('#e9f6f0'); d.fillColor('#0f2f2b').font('Helvetica-Bold').fontSize(24).text(brl(Number(payment.amount) + Number(payment.fine) + Number(payment.interest_late)), 72, 152); d.font('Helvetica').fontSize(9.5).fillColor('#3a6a5c').text('PAGAMENTO CONFIRMADO VIA PIX', 72, 184);
    d.y = 230; kv(d, 'Pagador', `${customer.full_name} — CPF ${customer.cpf_masked}`); kv(d, 'Referente a', `Empréstimo #${loan.id}${installment ? ` • parcela ${installment.n}/${loan.term}` : ''}`); kv(d, 'Valor da parcela', brl(payment.amount)); if (Number(payment.fine)) kv(d, 'Multa por atraso (2%)', brl(payment.fine)); if (Number(payment.interest_late)) kv(d, 'Juros de mora', brl(payment.interest_late)); kv(d, 'Data e hora', new Date(payment.paid_at).toLocaleString('pt-BR')); kv(d, 'Código do recibo', payment.receipt_code);
    d.moveDown(1); d.rect(56, d.y, 483, 52).strokeColor('#e0b44c').lineWidth(1).stroke(); d.font('Helvetica-Bold').fontSize(9.5).fillColor('#a8741a').text('AMBIENTE DE DEMONSTRAÇÃO', 70, d.y + 10); d.font('Helvetica').fontSize(9).fillColor('#6b5a2a').text('Pagamento simulado em sandbox. Não houve movimentação financeira real e este comprovante não tem valor fiscal.', 70, d.y + 24, { width: 455 });
  });
  return buf;
}
