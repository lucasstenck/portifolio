// Notificações. SMS/WhatsApp/e-mail usam um provedor SANDBOX que grava em `outbox` (nada é enviado de verdade).
// Em produção: trocar `deliver()` por um provedor homologado (ex.: Zenvia, Twilio, WhatsApp Business API com templates aprovados).
import { q } from './db.js';

async function deliver(channel, destination, body, purpose) {
  await q(`INSERT INTO outbox (channel, destination, body, purpose) VALUES ($1,$2,$3,$4)`, [channel, destination, body, purpose || null]);
}
export const sendSms = (to, body, purpose) => deliver('sms', to, body, purpose);
export const sendWhatsapp = (to, body, purpose) => deliver('whatsapp', to, body, purpose);
export const sendEmail = (to, subject, body, purpose) => deliver('email', to, `${subject}\n\n${body}`, purpose);
export async function notify(userId, kind, title, body) {
  if (!userId) return;
  await q(`INSERT INTO notifications (user_id, kind, title, body) VALUES ($1,$2,$3,$4)`, [userId, kind, title, body]);
}
export async function notifyStaff(kind, title, body) {
  const staff = (await q(`SELECT id FROM users WHERE role IN ('admin','staff') AND NOT disabled`)).rows;
  for (const s of staff) await notify(s.id, kind, title, body);
}
