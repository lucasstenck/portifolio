// Consulta de movimentações na API pública do DataJud (CNJ). Requer a chave pública do CNJ em DATAJUD_API_KEY
// (publicada na documentação oficial do DataJud). Sem a chave, o sistema funciona em modo manual.
const TJ = ['ac', 'al', 'ap', 'am', 'ba', 'ce', 'dft', 'es', 'go', 'ma', 'mt', 'ms', 'mg', 'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'se', 'sp', 'to'];
export function aliasFromCnj(num) {
  const d = String(num || '').replace(/\D/g, ''); if (d.length !== 20) return null;
  const j = d[13], tr = parseInt(d.slice(14, 16), 10);
  if (j === '8' && tr >= 1 && tr <= 27) return 'tj' + TJ[tr - 1];
  if (j === '5') return tr === 0 ? 'tst' : tr <= 24 ? 'trt' + tr : null;
  if (j === '4' && tr >= 1 && tr <= 6) return 'trf' + tr;
  if (j === '3') return 'stj';
  return null;
}
export async function datajudLookup(numero) {
  const key = process.env.DATAJUD_API_KEY; if (!key) return { configured: false, msg: 'Integração com o DataJud não configurada. Defina DATAJUD_API_KEY ou registre movimentações manualmente.' };
  const alias = aliasFromCnj(numero); if (!alias) return { configured: true, error: 'Número CNJ inválido ou tribunal não suportado pela API pública.' };
  try {
    const r = await fetch(`https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`, { method: 'POST', headers: { Authorization: `APIKey ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: { match: { numeroProcesso: String(numero).replace(/\D/g, '') } } }), signal: AbortSignal.timeout(15000) });
    if (!r.ok) return { configured: true, error: `DataJud respondeu ${r.status}.` };
    const j = await r.json(), src = j.hits?.hits?.[0]?._source; if (!src) return { configured: true, error: 'Processo não encontrado no DataJud (pode estar sob sigilo ou ainda não indexado).' };
    return { configured: true, classe: src.classe?.nome, orgao: src.orgaoJulgador?.nome, movimentos: (src.movimentos || []).map((m) => ({ data: String(m.dataHora || '').slice(0, 10), nome: m.nome + (m.complementosTabelados?.length ? ' — ' + m.complementosTabelados.map((x) => x.nome).join(', ') : '') })) };
  } catch (e) { return { configured: true, error: 'Falha ao consultar o DataJud: ' + e.message }; }
}
