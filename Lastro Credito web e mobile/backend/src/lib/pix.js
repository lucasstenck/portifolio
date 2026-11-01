// Pix: gera BR Code (EMV® QRCPS-MPM, "Pix Copia e Cola") com CRC16 e um provedor SANDBOX com webhook assinado.
// Em produção, a cobrança é criada num PSP autorizado pelo Banco Central (API Pix cob/cobv) e a baixa vem por webhook.
import crypto from 'node:crypto';
import QRCode from 'qrcode';

const tlv = (id, value) => id + String(value.length).padStart(2, '0') + value;
const strip = (s, max) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, max);
export function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) { crc ^= str.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff; }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
export function brcode({ key, amount, name, city, txid }) {
  const mai = tlv('00', 'br.gov.bcb.pix') + tlv('01', key);
  const payload = tlv('00', '01') + tlv('01', '12') + tlv('26', mai) + tlv('52', '0000') + tlv('53', '986') + tlv('54', amount.toFixed(2)) + tlv('58', 'BR') + tlv('59', strip(name, 25)) + tlv('60', strip(city, 15)) + tlv('62', tlv('05', txid.slice(0, 25))) + '6304';
  return payload + crc16(payload);
}
export const validBrcode = (s) => s.slice(-4) === crc16(s.slice(0, -4));
export const qrSvg = (code) => QRCode.toString(code, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });

const WEBHOOK_SECRET = () => process.env.PIX_WEBHOOK_SECRET || 'lastro-demo-webhook-secret';
export const signWebhook = (body) => crypto.createHmac('sha256', WEBHOOK_SECRET()).update(body).digest('hex');
export const verifyWebhook = (body, sig) => { const e = signWebhook(body); return !!sig && sig.length === e.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(e)); };

/** Provedor SANDBOX: não movimenta dinheiro. Substituir por PSP real (Efí, Asaas, Celcoin, Pagar.me…). */
export const sandboxPsp = {
  name: 'sandbox',
  key: process.env.PIX_SANDBOX_KEY || 'sandbox@lastro.dev',
  createCharge({ amount, txid }) {
    return { brcode: brcode({ key: this.key, amount, name: 'LASTRO CREDITO SANDBOX', city: 'SAO PAULO', txid }), providerRef: 'sbx_' + crypto.randomBytes(6).toString('hex') };
  },
  /** Monta o evento que o PSP enviaria ao webhook quando o pagador conclui o Pix. */
  paidEvent({ txid, amount }) {
    const body = JSON.stringify({ type: 'pix.paid', txid, amount, endToEndId: 'E' + crypto.randomBytes(15).toString('hex').toUpperCase().slice(0, 31), paidAt: new Date().toISOString(), sandbox: true });
    return { body, signature: signWebhook(body) };
  },
};
