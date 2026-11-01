// Primitivas de segurança: AES-256-GCM (dados em repouso), HMAC (índice cego), scrypt (senhas), JWT HS256 e TOTP (RFC 6238).
import crypto from 'node:crypto';

const key = (name, fallback) => crypto.createHash('sha256').update(process.env[name] || fallback).digest();
// Em produção as chaves vêm de um KMS/cofre (variáveis de ambiente). Os padrões abaixo são só do ambiente de demonstração.
const DATA_KEY = () => key('DATA_ENCRYPTION_KEY', 'lastro-demo-data-key');
const INDEX_KEY = () => key('INDEX_HMAC_KEY', 'lastro-demo-index-key');
const JWT_KEY = () => key('JWT_SECRET', 'lastro-demo-jwt-secret');

export function encrypt(plain) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', DATA_KEY(), iv);
  const enc = Buffer.concat([c.update(Buffer.isBuffer(plain) ? plain : Buffer.from(String(plain), 'utf8')), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
export function decrypt(b64, asBuffer = false) {
  const raw = Buffer.from(b64, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', DATA_KEY(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  const out = Buffer.concat([d.update(raw.subarray(28)), d.final()]);
  return asBuffer ? out : out.toString('utf8');
}
export const blindIndex = (v) => crypto.createHmac('sha256', INDEX_KEY()).update(String(v)).digest('hex');
export const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
export const randomToken = (n = 32) => crypto.randomBytes(n).toString('base64url');
export const randomDigits = (n = 6) => String(crypto.randomInt(0, 10 ** n)).padStart(n, '0');

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')}`;
}
export function verifyPassword(pw, stored) {
  const [, salt, hash] = stored.split('$');
  const test = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

const b64u = (b) => Buffer.from(b).toString('base64url');
export function signJwt(payload, ttlSec) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSec }));
  return `${head}.${body}.${crypto.createHmac('sha256', JWT_KEY()).update(`${head}.${body}`).digest('base64url')}`;
}
export function verifyJwt(tok) {
  try {
    const [h, b, s] = String(tok).split('.'), exp = crypto.createHmac('sha256', JWT_KEY()).update(`${h}.${b}`).digest('base64url');
    if (!s || s.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(exp))) return null;
    const p = JSON.parse(Buffer.from(b, 'base64url').toString());
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const newTotpSecret = () => { let s = ''; for (const b of crypto.randomBytes(20)) s += B32[b % 32]; return s; };
const b32dec = (s) => { let bits = ''; const out = []; for (const c of s.replace(/=+$/, '').toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, '0'); for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
export function totp(secret, at = Date.now()) {
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = crypto.createHmac('sha1', b32dec(secret)).update(ctr).digest(), o = h[19] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
export const verifyTotp = (secret, code) => [-1, 0, 1].some((w) => totp(secret, Date.now() + w * 30000) === String(code).trim());
export const totpUri = (secret, account) => `otpauth://totp/Lastro:${encodeURIComponent(account)}?secret=${secret}&issuer=Lastro&digits=6&period=30`;

export function isValidCpf(c) {
  c = String(c || '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const n of [9, 10]) { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); if (((s * 10) % 11) % 10 !== +c[n]) return false; }
  return true;
}
/** CPF sintético válido (só para dados de demonstração). */
export function genCpf(seed) {
  const h = crypto.createHash('sha256').update('cpf-demo-' + seed).digest();
  const d = Array.from({ length: 9 }, (_, i) => h[i] % 10);
  for (const n of [9, 10]) { let s = 0; for (let i = 0; i < n; i++) s += d[i] * (n + 1 - i); d.push(((s * 10) % 11) % 10); }
  return d.join('');
}
