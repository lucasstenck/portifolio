// Autenticação: cadastro, confirmação de telefone (OTP), login com 2FA (TOTP), sessões revogáveis, recuperação de senha.
import { route, fail, need, clean, digits, audit, created } from '../http.js';
import { one, all, q, tx } from '../db.js';
import { hashPassword, verifyPassword, signJwt, verifyJwt, randomToken, randomDigits, sha256, encrypt, decrypt, newTotpSecret, verifyTotp, totpUri, isValidCpf, blindIndex } from '../lib/crypto.js';
import { qrSvg } from '../lib/pix.js';
import { notify, sendSms, sendEmail } from '../notify.js';

const ACCESS_TTL = 15 * 60, REFRESH_DAYS = 30;
const validPassword = (p) => typeof p === 'string' && p.length >= 10 && /[a-zA-Z]/.test(p) && /\d/.test(p);

export async function openSession(user, ctx) {
  const sid = randomToken(12), refresh = randomToken(32);
  await q(`INSERT INTO sessions (id, user_id, device, ip, refresh_hash, expires_at) VALUES ($1,$2,$3,$4,$5, now() + ($6 || ' days')::interval)`, [sid, user.id, ctx.device, ctx.ip, sha256(refresh), REFRESH_DAYS]);
  return { access_token: signJwt({ uid: user.id, sid, role: user.role, typ: 'access' }, ACCESS_TTL), refresh_token: `${sid}.${refresh}`, expires_in: ACCESS_TTL, user: publicUser(user) };
}
export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, phone_verified: !!u.phone_verified_at, totp_enabled: u.totp_enabled });

async function issueOtp(userId, purpose, channel, destination) {
  const code = process.env.FIXED_OTP || randomDigits(6);
  await q(`UPDATE otp_codes SET used_at=now() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL`, [userId, purpose]);
  await q(`INSERT INTO otp_codes (user_id, purpose, channel, destination, code_hash, expires_at) VALUES ($1,$2,$3,$4,$5, now() + interval '10 minutes')`, [userId, purpose, channel, destination, sha256(code + ':' + userId)]);
  const body = purpose === 'phone' ? `Lastro: seu código de confirmação é ${code}. Não compartilhe.` : `Lastro: seu código para redefinir a senha é ${code}. Válido por 10 minutos.`;
  channel === 'sms' ? await sendSms(destination, body, purpose) : await sendEmail(destination, 'Lastro — código de segurança', body, purpose);
}
async function checkOtp(userId, purpose, code) {
  const o = await one(`SELECT * FROM otp_codes WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL AND expires_at > now() ORDER BY id DESC LIMIT 1`, [userId, purpose]);
  if (!o) throw fail(400, 'Código expirado. Solicite um novo.');
  if (o.attempts >= 5) throw fail(429, 'Muitas tentativas incorretas. Solicite um novo código.');
  if (o.code_hash !== sha256(String(code).trim() + ':' + userId)) { await q(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id=$1`, [o.id]); throw fail(400, 'Código incorreto.'); }
  await q(`UPDATE otp_codes SET used_at=now() WHERE id=$1`, [o.id]);
}

route('POST', '/api/auth/register', { auth: 'public', limit: [10, 600000] }, async (ctx) => {
  const b = ctx.body, cpf = digits(b.cpf), email = clean(b.email, 120).toLowerCase(), phone = digits(b.phone), err = {};
  if (clean(b.name, 120).split(/\s+/).filter(Boolean).length < 2) err.name = 'Informe nome e sobrenome.';
  if (!isValidCpf(cpf)) err.cpf = 'CPF inválido.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) err.email = 'E-mail inválido.';
  if (phone.length < 10 || phone.length > 11) err.phone = 'Informe o celular com DDD.';
  if (!validPassword(b.password)) err.password = 'Use ao menos 10 caracteres, com letras e números.';
  if (!b.consent_terms) err.consent_terms = 'É necessário aceitar os Termos e a Política de Privacidade.';
  const dupCpf = !err.cpf && await one(`SELECT id FROM customers WHERE cpf_idx=$1`, [blindIndex(cpf)]);
  if (dupCpf) { const { evaluateCustomer } = await import('../lib/antifraud.js'); await q(`INSERT INTO fraud_alerts (customer_id, rule, severity, detail, evidence) VALUES ($1,'CPF_DUPLICATE_ATTEMPT','alta','Nova tentativa de cadastro com um CPF já existente.', $2)`, [dupCpf.id, JSON.stringify({ email, phone, ip: ctx.ip })]); err.cpf = 'Este CPF já possui cadastro. Use "Entrar" ou recupere sua senha.'; }
  if (!err.email && await one(`SELECT id FROM users WHERE email=$1`, [email])) err.email = 'Este e-mail já está cadastrado.';
  need(!Object.keys(err).length, 'Verifique os campos informados.', err);
  const user = await tx(async (t) => {
    const u = await t.one(`INSERT INTO users (role, name, email, phone, password_hash) VALUES ('client',$1,$2,$3,$4) RETURNING *`, [clean(b.name, 120), email, phone, hashPassword(b.password)]);
    const c = await t.one(`INSERT INTO customers (user_id, full_name, cpf_enc, cpf_idx, cpf_last3) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [u.id, clean(b.name, 120), encrypt(cpf), blindIndex(cpf), cpf.slice(-3)]);
    for (const [purpose, granted] of [['termos_privacidade', true], ['analise_credito', true], ['comunicacao_sms_whatsapp', !!b.consent_marketing]]) await t.q(`INSERT INTO consents (customer_id, purpose, granted, version, ip) VALUES ($1,$2,$3,'2026-01',$4)`, [c.id, purpose, granted, ctx.ip]);
    return u;
  });
  await issueOtp(user.id, 'phone', 'sms', phone);
  await audit({ ...ctx, user }, 'auth.register', 'user', user.id);
  return created(await openSession(user, ctx));
});

route('POST', '/api/auth/phone/send', { limit: [5, 600000] }, async (ctx) => { need(ctx.user.phone, 'Cadastre um telefone primeiro.'); await issueOtp(ctx.user.id, 'phone', 'sms', ctx.user.phone); return { ok: true }; });
route('POST', '/api/auth/phone/verify', { limit: [10, 600000] }, async (ctx) => { await checkOtp(ctx.user.id, 'phone', ctx.body.code); await q(`UPDATE users SET phone_verified_at=now() WHERE id=$1`, [ctx.user.id]); await audit(ctx, 'auth.phone_verified', 'user', ctx.user.id); return { ok: true }; });

route('POST', '/api/auth/login', { auth: 'public', limit: [12, 600000] }, async (ctx) => {
  const email = clean(ctx.body.email, 120).toLowerCase(), u = await one(`SELECT * FROM users WHERE email=$1`, [email]);
  const generic = fail(401, 'E-mail ou senha incorretos.');
  if (!u) { hashPassword('x'.repeat(10)); throw generic; }
  if (u.disabled) throw fail(403, 'Conta desativada. Fale com o suporte.');
  if (u.locked_until && new Date(u.locked_until) > new Date()) throw fail(429, 'Conta temporariamente bloqueada por tentativas incorretas. Tente em alguns minutos.');
  if (!verifyPassword(String(ctx.body.password || ''), u.password_hash)) { const f = u.failed_logins + 1; await q(`UPDATE users SET failed_logins=$2, locked_until=CASE WHEN $3 THEN now() + interval '15 minutes' ELSE NULL END WHERE id=$1`, [u.id, f >= 5 ? 0 : f, f >= 5]); await audit({ ...ctx, user: u }, 'auth.login_failed', 'user', u.id); throw generic; }
  await q(`UPDATE users SET failed_logins=0, locked_until=NULL WHERE id=$1`, [u.id]);
  if (u.totp_enabled) return { mfa_required: true, mfa_token: signJwt({ uid: u.id, typ: 'mfa' }, 300) };
  await audit({ ...ctx, user: u }, 'auth.login', 'user', u.id);
  return openSession(u, ctx);
});
route('POST', '/api/auth/mfa', { auth: 'public', limit: [15, 600000] }, async (ctx) => {
  const p = verifyJwt(ctx.body.mfa_token); if (!p || p.typ !== 'mfa') throw fail(401, 'Verificação expirada. Entre novamente.');
  const u = await one(`SELECT * FROM users WHERE id=$1`, [p.uid]);
  if (!verifyTotp(decrypt(u.totp_secret), ctx.body.code)) { await audit({ ...ctx, user: u }, 'auth.mfa_failed', 'user', u.id); throw fail(401, 'Código de verificação incorreto.'); }
  await audit({ ...ctx, user: u }, 'auth.login_mfa', 'user', u.id); return openSession(u, ctx);
});
route('POST', '/api/auth/refresh', { auth: 'public', limit: [60, 600000] }, async (ctx) => {
  const [sid, tok] = String(ctx.body.refresh_token || '').split('.'); const s = sid && await one(`SELECT * FROM sessions WHERE id=$1`, [sid]);
  if (!s || s.revoked_at || new Date(s.expires_at) < new Date() || s.refresh_hash !== sha256(tok || '')) throw fail(401, 'Sessão inválida. Faça login novamente.', { code: 'AUTH' });
  const u = await one(`SELECT * FROM users WHERE id=$1 AND NOT disabled`, [s.user_id]); if (!u) throw fail(401, 'Sessão inválida.', { code: 'AUTH' });
  const refresh = randomToken(32); await q(`UPDATE sessions SET refresh_hash=$2, last_seen_at=now() WHERE id=$1`, [sid, sha256(refresh)]);   // rotação do refresh token
  return { access_token: signJwt({ uid: u.id, sid, role: u.role, typ: 'access' }, ACCESS_TTL), refresh_token: `${sid}.${refresh}`, expires_in: ACCESS_TTL };
});
route('POST', '/api/auth/logout', async (ctx) => { await q(`UPDATE sessions SET revoked_at=now() WHERE id=$1`, [ctx.sid]); await audit(ctx, 'auth.logout', 'session', ctx.sid); return { ok: true }; });
route('GET', '/api/auth/sessions', async (ctx) => ({ sessions: (await all(`SELECT id, device, ip, created_at, last_seen_at FROM sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now() ORDER BY last_seen_at DESC`, [ctx.user.id])).map((s) => ({ ...s, current: s.id === ctx.sid })) }));
route('DELETE', '/api/auth/sessions/:id', async (ctx) => { await q(`UPDATE sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2`, [ctx.params.id, ctx.user.id]); await audit(ctx, 'auth.session_revoked', 'session', ctx.params.id); return { ok: true }; });

route('POST', '/api/auth/forgot', { auth: 'public', limit: [6, 600000] }, async (ctx) => {
  const u = await one(`SELECT * FROM users WHERE email=$1 AND NOT disabled`, [clean(ctx.body.email, 120).toLowerCase()]);
  if (u) await issueOtp(u.id, 'reset', 'email', u.email);
  return { ok: true, message: 'Se o e-mail estiver cadastrado, enviamos um código de 6 dígitos.' };      // resposta idêntica: não revela se a conta existe
});
route('POST', '/api/auth/reset', { auth: 'public', limit: [10, 600000] }, async (ctx) => {
  const u = await one(`SELECT * FROM users WHERE email=$1`, [clean(ctx.body.email, 120).toLowerCase()]); if (!u) throw fail(400, 'Código expirado. Solicite um novo.');
  need(validPassword(ctx.body.password), 'Use ao menos 10 caracteres, com letras e números.', { password: 'Use ao menos 10 caracteres, com letras e números.' });
  await checkOtp(u.id, 'reset', ctx.body.code);
  await q(`UPDATE users SET password_hash=$2, failed_logins=0, locked_until=NULL WHERE id=$1`, [u.id, hashPassword(ctx.body.password)]);
  await q(`UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [u.id]);        // encerra todas as sessões
  await audit({ ...ctx, user: u }, 'auth.password_reset', 'user', u.id); return { ok: true };
});

route('POST', '/api/auth/2fa/setup', async (ctx) => {
  const secret = newTotpSecret(); await q(`UPDATE users SET totp_secret=$2, totp_enabled=FALSE WHERE id=$1`, [ctx.user.id, encrypt(secret)]);
  const uri = totpUri(secret, ctx.user.email); return { secret, uri, qr_svg: await qrSvg(uri) };
});
route('POST', '/api/auth/2fa/enable', { limit: [10, 600000] }, async (ctx) => {
  const u = await one(`SELECT totp_secret FROM users WHERE id=$1`, [ctx.user.id]); need(u.totp_secret, 'Inicie a configuração primeiro.');
  if (!verifyTotp(decrypt(u.totp_secret), ctx.body.code)) throw fail(400, 'Código incorreto. Confira o aplicativo autenticador.');
  await q(`UPDATE users SET totp_enabled=TRUE WHERE id=$1`, [ctx.user.id]); await audit(ctx, 'auth.2fa_enabled', 'user', ctx.user.id); return { ok: true };
});
route('POST', '/api/auth/2fa/disable', async (ctx) => {
  const u = await one(`SELECT password_hash FROM users WHERE id=$1`, [ctx.user.id]); if (!verifyPassword(String(ctx.body.password || ''), u.password_hash)) throw fail(401, 'Senha incorreta.');
  await q(`UPDATE users SET totp_enabled=FALSE, totp_secret=NULL WHERE id=$1`, [ctx.user.id]); await audit(ctx, 'auth.2fa_disabled', 'user', ctx.user.id); return { ok: true };
});
