// Aleatoriedade verificável (provably fair): resultado = HMAC-SHA256(serverSeed, "clientSeed:nonce:i").
// O servidor publica sha256(serverSeed) ANTES das jogadas e revela a seed ao girar; o jogador confere sozinho.
import crypto from 'node:crypto';

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const newSeed = () => crypto.randomBytes(24).toString('hex');
/** Número uniforme em [0,1) com 48 bits de precisão. */
export function rnd(serverSeed, clientSeed, nonce, i = 0) {
  const h = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${i}`).digest();
  return h.readUIntBE(0, 6) / 2 ** 48;
}
export const newFair = () => { const s = newSeed(); return { serverSeed: s, hash: sha256(s), clientSeed: newSeed().slice(0, 16), nonce: 0, previous: [] }; };
