// Persistência em JSON (gravação atômica com debounce) + carteira com livro-razão (ledger).
import fs from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.d = { users: [], tx: [], bets: [], rounds: [], withdrawals: [], sessions: {}, matches: [], seq: { user: 0, tx: 0, bet: 0, wd: 0, round: 0 } };
    if (fs.existsSync(file)) { try { Object.assign(this.d, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (e) { console.error('Falha ao ler base, iniciando vazia:', e.message); } }
    this.timer = null;
  }
  save() {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 400);
  }
  flush() {
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.d));
    fs.renameSync(this.file + '.tmp', this.file);
  }
  id(kind) { return ++this.d.seq[kind]; }
  user(id) { return this.d.users.find((u) => u.id === id); }

  /** Movimenta o saldo (centavos, inteiro). amount>0 crédito, <0 débito. Lança erro se faltar saldo. */
  move(user, amount, type, ref = '', meta = {}) {
    amount = Math.round(amount);
    if (!Number.isInteger(amount)) throw new Error('Valor inválido');
    if (user.balance + amount < 0) { const e = new Error('Saldo insuficiente'); e.code = 'FUNDS'; throw e; }
    user.balance += amount;
    const t = { id: this.id('tx'), userId: user.id, type, amount, balance: user.balance, ref, at: Date.now(), ...meta };
    this.d.tx.push(t);
    this.save();
    return t;
  }
  txOf(userId, limit = 100) { return this.d.tx.filter((t) => t.userId === userId).slice(-limit).reverse(); }
  /** Auditoria: o saldo de cada usuário deve ser igual à soma do seu ledger. */
  audit() {
    const sums = {};
    for (const t of this.d.tx) sums[t.userId] = (sums[t.userId] || 0) + t.amount;
    return this.d.users.map((u) => ({ id: u.id, balance: u.balance, ledger: sums[u.id] || 0, ok: u.balance === (sums[u.id] || 0) }));
  }
}
export const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
