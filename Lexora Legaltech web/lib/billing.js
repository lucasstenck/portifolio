// Cobrança recorrente por adaptador. Este adaptador é um provedor de TESTE (sem cobrança real):
// troque `charge()` pela chamada ao provedor escolhido (Asaas, Stripe, Mercado Pago, Pagar.me…).
// O número completo do cartão NUNCA é armazenado: só bandeira, últimos 4 dígitos e validade (tokenização no provedor).
const luhn = (n) => { let s = 0, d = false; for (let i = n.length - 1; i >= 0; i--) { let x = +n[i]; if (d) { x *= 2; if (x > 9) x -= 9; } s += x; d = !d; } return s % 10 === 0; };
const brand = (n) => (/^4/.test(n) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(n) ? 'Mastercard' : /^3[47]/.test(n) ? 'Amex' : /^(606282|3841)/.test(n) ? 'Hipercard' : /^(636368|438935|504175|451416|636297|5067|4576|4011|506699)/.test(n) ? 'Elo' : 'Cartão');
export class Billing {
  constructor(ctx) { Object.assign(this, ctx); this.name = 'Provedor de teste (adaptador)'; this.fees = { pix: 'Referência de mercado: ~R$ 0,99 a R$ 1,99 por cobrança', cartao: 'Referência de mercado: ~2,99% + R$ 0,49 por cobrança aprovada', obs: 'Valores de referência; confirmar com o provedor contratado.' }; }
  setCard(office, b, ip) {
    const num = String(b.numero || '').replace(/\D/g, ''), [mm, yy] = String(b.validade || '').split('/').map((x) => parseInt(x, 10)), cvv = String(b.cvv || '');
    const err = {}; if (num.length < 13 || num.length > 19 || !luhn(num)) err.numero = 'Número de cartão inválido.';
    const year = yy < 100 ? 2000 + yy : yy; if (!(mm >= 1 && mm <= 12) || !(year >= new Date().getFullYear()) || (year === new Date().getFullYear() && mm < new Date().getMonth() + 1)) err.validade = 'Validade inválida.';
    if (!/^\d{3,4}$/.test(cvv)) err.cvv = 'CVV inválido.'; if (String(b.nome || '').trim().length < 3) err.nome = 'Informe o nome impresso no cartão.'; if (!b.autoriza) err.autoriza = 'É necessário autorizar a cobrança recorrente.';
    if (Object.keys(err).length) throw Object.assign(new Error('Verifique os dados do cartão.'), { http: 422, errors: err });
    office.card = { brand: brand(num), last4: num.slice(-4), exp: `${String(mm).padStart(2, '0')}/${String(year).slice(-2)}`, nome: String(b.nome).trim().slice(0, 40), authorizedAt: Date.now(), authorizedIp: ip };
    office.retries = 0; let charged = null; if (office.plan === 'cancelado') office.plan = 'trial';
    if (Date.now() >= office.trialEndsAt || office.plan === 'ativo' && office.pastDue) charged = this.charge(office, 'ativação');
    return { cobrancaImediata: !!charged, resultado: charged ? charged.status : 'agendada para o fim do teste' };
  }
  charge(office, motivo) {
    const ok = office.card && office.card.last4 !== '0002'; const inv = { id: this.nid('inv'), at: Date.now(), valor: this.PRICE, motivo, metodo: office.card ? `${office.card.brand} •••• ${office.card.last4}` : '—', status: ok ? 'paga' : 'recusada' };
    (office.invoices ||= []).push(inv);
    if (ok) { office.plan = 'ativo'; office.pastDue = false; office.retries = 0; office.nextCharge = Date.now() + 30 * this.DAY; }
    else { office.pastDue = true; office.retries = (office.retries || 0) + 1; office.nextRetry = Date.now() + this.DAY; if (office.retries >= 3) { office.plan = 'cancelado'; office.pastDue = false; } }
    this.save(); return inv;
  }
  run() {
    const now = Date.now();
    for (const o of this.db.offices) {
      if (!o.card) continue;
      if (o.plan === 'trial' && o.trialEndsAt <= now) this.charge(o, 'primeira mensalidade (fim do teste)');
      else if (o.plan === 'ativo' && !o.pastDue && o.nextCharge && o.nextCharge <= now) this.charge(o, 'mensalidade');
      else if (o.plan === 'ativo' && o.pastDue && o.nextRetry <= now) this.charge(o, 'nova tentativa');
    }
  }
}
