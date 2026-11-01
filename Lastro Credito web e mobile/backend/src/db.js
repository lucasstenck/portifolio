// Conexão PostgreSQL. Sem DATABASE_URL, sobe um PostgreSQL real embarcado (binário oficial) em ./data/pg — útil para demonstração.
// Em produção, aponte DATABASE_URL para um PostgreSQL gerenciado.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
pg.types.setTypeParser(1082, (v) => v);   // DATE como string 'YYYY-MM-DD' (sem fuso)
let pool = null, embedded = null;

export async function startDb({ dataDir = process.env.PG_DATA_DIR || path.join(here, '..', 'data', 'pg'), port = +process.env.PGPORT || 54329, dbName = 'lastro', reset = false } = {}) {
  let url = process.env.DATABASE_URL;
  if (!url) {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    if (reset) fs.rmSync(dataDir, { recursive: true, force: true });
    const fresh = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));
    embedded = new EmbeddedPostgres({ databaseDir: dataDir, user: 'lastro', password: 'lastro-demo', port, persistent: true, onLog: () => {}, onError: () => {} });
    if (fresh) await embedded.initialise();
    await embedded.start();
    if (fresh) await embedded.createDatabase(dbName);
    url = `postgres://lastro:lastro-demo@localhost:${port}/${dbName}`;
  }
  pool = new pg.Pool({ connectionString: url, max: 10 });
  await pool.query(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
  return pool;
}
export async function stopDb() { if (pool) await pool.end(); pool = null; if (embedded) { await embedded.stop(); embedded = null; } }
export const q = (text, params) => pool.query(text, params);
export const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;
export const all = async (text, params) => (await pool.query(text, params)).rows;
export async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn({ q: (t, p) => c.query(t, p), one: async (t, p) => (await c.query(t, p)).rows[0] || null, all: async (t, p) => (await c.query(t, p)).rows }); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
