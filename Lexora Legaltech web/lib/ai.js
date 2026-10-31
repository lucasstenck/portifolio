// IA jurídica da Lexora. Dois modos: (1) motor local, offline, determinístico (resumo extrativo, extração por padrões,
// minutas a partir de modelos); (2) provedor LLM (Anthropic) quando ANTHROPIC_API_KEY está definida.
// Toda saída é rascunho: a revisão pelo advogado é obrigatória.
const STOP = new Set('a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sob sobre entre e ou mas que se como ao aos à às pelo pela pelos pelas este esta estes estas esse essa esses essas isso isto aquele aquela já não sim também só até quando onde qual quais cujo cuja foi são ser está estão há ter tem têm seu sua seus suas lhe lhes mais muito muita menos então assim porém contudo todavia pois nem mesmo mesma outro outra outros outras'.split(' '));
const LEGAL = ['condenar', 'condeno', 'julgo', 'procedente', 'improcedente', 'sentença', 'decisão', 'acórdão', 'pedido', 'pedidos', 'valor', 'prazo', 'audiência', 'indenização', 'multa', 'honorários', 'recurso', 'apelação', 'liminar', 'tutela', 'rescisão', 'horas', 'extras', 'fgts', 'danos', 'dano', 'contrato', 'cláusula', 'obrigação', 'dever', 'requer', 'requeiro', 'determino', 'intime-se', 'cite-se', 'transitado'];
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const sentences = (t) => t.replace(/\s+/g, ' ').replace(/\b(art|arts|nº|n|dr|dra|sr|sra|inc|fls|p|pp)\./gi, '$1§').split(/(?<=[.!?;])\s+(?=[A-ZÀ-Ú0-9"“(])/).map((s) => s.replace(/§/g, '.').trim()).filter((s) => s.length > 25);
const words = (s) => norm(s).match(/[a-z0-9]{3,}/g) || [];

async function llm(system, user) {
  const key = process.env.ANTHROPIC_API_KEY; if (!key) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 3000, system, messages: [{ role: 'user', content: user }] }), signal: AbortSignal.timeout(60000) });
    if (!r.ok) return null; const j = await r.json(); return j.content?.map((c) => c.text).join('') || null;
  } catch (e) { return null; }
}
const SYS = 'Você é um assistente jurídico para advogados brasileiros. Responda em português do Brasil, com linguagem técnica e objetiva. Não invente fatos, números de processo, artigos ou jurisprudência; quando faltar informação, use [PREENCHER]. Todo conteúdo é rascunho sujeito à revisão do advogado.';

export async function aiSummarize(text, k = 5) {
  const viaLlm = await llm(SYS, `Resuma o documento abaixo em até ${k} tópicos curtos e liste ao final os pontos de atenção (prazos, valores, pedidos).\n\n${text.slice(0, 60000)}`);
  const S = sentences(text); const all = words(text), freq = {}; for (const w of all) if (!STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  const mx = Math.max(1, ...Object.values(freq));
  const scored = S.map((s, i) => { const ws = words(s).filter((w) => !STOP.has(w)); let sc = ws.reduce((a, w) => a + (freq[w] || 0) / mx, 0) / Math.sqrt(ws.length || 1); sc += LEGAL.filter((l) => norm(s).includes(norm(l))).length * 0.35; if (/R\$\s?\d/.test(s)) sc += 0.4; if (/\d{1,3}\s*\(?[a-zç]*\)?\s*dias/i.test(s)) sc += 0.4; if (i < 2) sc += 0.3; return { s, i, sc }; });
  const top = scored.sort((a, b) => b.sc - a.sc).slice(0, Math.min(k, S.length)).sort((a, b) => a.i - b.i).map((x) => x.s);
  const kw = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
  const wc = all.length;
  return { engine: viaLlm ? 'llm' : 'local', resumo: viaLlm || top.map((s) => '• ' + s).join('\n'), palavrasChave: kw, palavras: wc, reducao: Math.max(0, Math.round((1 - top.join(' ').split(/\s+/).length / Math.max(1, wc)) * 100)), pontosDeAtencao: extractAttention(text) };
}
function extractAttention(t) {
  const out = []; for (const s of sentences(t)) { if (/\b(prazo|dias úteis|dias corridos|audiência|intime|vencimento|multa)\b/i.test(s) && out.length < 4) out.push(s.slice(0, 220)); } return out;
}
const MESES = 'janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro'.split(' ');
export function aiExtract(text) {
  const uniq = (a) => [...new Set(a.map((x) => x.trim()))]; const m = (re) => uniq([...text.matchAll(re)].map((x) => x[0]));
  const grp = (re, i = 1) => uniq([...text.matchAll(re)].map((x) => x[i].replace(/\s+/g, ' ')));
  const campos = [
    ['Números de processo (CNJ)', m(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g)],
    ['CPF', m(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g)], ['CNPJ', m(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g)],
    ['Valores', m(/R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g)],
    ['Datas', uniq([...m(/\b\d{2}\/\d{2}\/\d{4}\b/g), ...[...text.matchAll(new RegExp(`\\b\\d{1,2}\\s+de\\s+(${MESES.join('|')})\\s+de\\s+\\d{4}\\b`, 'gi'))].map((x) => x[0])])],
    ['Autor / Requerente / Reclamante', grp(/\b(?:autor(?:a)?|requerente|reclamante|exequente|impetrante)\s*[:\-–]\s*([A-ZÀ-Ú][A-Za-zÀ-ú' ]{4,60}?)(?=[,.;\n]|$| inscrit| portad| CPF)/gi)],
    ['Réu / Requerido / Reclamado', grp(/\b(?:r[ée]u|ré|requerid[oa]|reclamad[oa]|executad[oa]|impetrad[oa])\s*[:\-–]\s*([A-ZÀ-Ú][A-Za-zÀ-ú0-9'&. ]{3,70}?)(?=[,;\n]|$| inscrit| CNPJ| CPF)/gi)],
    ['Juízo / Vara', grp(/\b(\d{1,3}ª?\s*Vara[^,.;\n]{0,70})/gi)],
    ['Prazos', uniq([...text.matchAll(/\b(?:prazo\s+de\s+)?(\d{1,3})\s*(?:\([a-zçé\- ]+\)\s*)?dias(?:\s+(?:úteis|corridos))?/gi)].map((x) => x[0]))],
    ['Dispositivos legais', m(/\b(?:art(?:s)?\.?\s*\d+[ºo°]?(?:[-–]\w)?(?:,?\s*(?:§\s*\d+[ºo°]?|inciso\s+[IVXLC]+|caput))?[^,.;\n]{0,40}?(?:CLT|CPC|CC|CF\/?88|CDC|CP|CPP|Lei\s+[\d.]+\/\d+))/gi)],
    ['E-mails', m(/[\w.+-]+@[\w-]+\.[\w.-]+/g)], ['Telefones', m(/\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g)],
  ].filter(([, v]) => v.length).map(([tipo, valores]) => ({ tipo, valores: valores.slice(0, 10) }));
  return { engine: 'local', campos, total: campos.reduce((a, c) => a + c.valores.length, 0) };
}

const fmt = (v) => (v ? String(v) : '[PREENCHER]');
const brl = (v) => (v ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '[PREENCHER]');
const hoje = () => { const d = new Date(); return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`; };
export const TEMPLATES = [
  { id: 'peticao-trabalhista', nome: 'Petição inicial — Reclamação Trabalhista', f: (x) => `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DO TRABALHO DA ${fmt(x.vara)} ${fmt(x.tribunal)}\n\n${fmt(x.cliente).toUpperCase()}, ${fmt(x.clienteDoc ? 'inscrito(a) sob o documento nº ' + x.clienteDoc : '')}, residente em ${fmt(x.clienteCidade)}, por seu advogado ao final assinado (procuração anexa), vem, respeitosamente, propor\n\nRECLAMAÇÃO TRABALHISTA\n\nem face de ${fmt(x.contraria).toUpperCase()}, pelos fatos e fundamentos a seguir expostos.\n\nI — DOS FATOS\n${fmt(x.fatos)}\n\nII — DO DIREITO\n[PREENCHER: fundamentação com os dispositivos da CLT e da Constituição aplicáveis ao caso, e jurisprudência pertinente a ser conferida pelo advogado.]\n\nIII — DOS PEDIDOS\nAnte o exposto, requer:\na) o recebimento e processamento da presente reclamação;\nb) a citação da reclamada para, querendo, apresentar defesa, sob pena de revelia;\nc) a procedência dos pedidos para condenar a reclamada ao pagamento de [PREENCHER: verbas pleiteadas], acrescidas de juros e correção monetária;\nd) a condenação em honorários de sucumbência (art. 791-A da CLT);\ne) a concessão dos benefícios da justiça gratuita, nos termos do art. 790, §3º, da CLT.\n\nDá-se à causa o valor de ${brl(x.valor)}.\n\nTermos em que, pede deferimento.\n\n${fmt(x.cidade)}, ${hoje()}.\n\n${fmt(x.adv)}\nOAB ${fmt(x.oab)}` },
  { id: 'notificacao', nome: 'Notificação extrajudicial', f: (x) => `NOTIFICAÇÃO EXTRAJUDICIAL\n\nNotificante: ${fmt(x.cliente)} ${x.clienteDoc ? '— documento nº ' + x.clienteDoc : ''}\nNotificado(a): ${fmt(x.contraria)}\n\nPrezado(a) Senhor(a),\n\nPor meio da presente, e na qualidade de advogado(a) constituído(a) do notificante, vimos NOTIFICAR Vossa Senhoria para que, no prazo improrrogável de [PREENCHER] dias, contados do recebimento desta, ${fmt(x.pedido)}.\n\nRESUMO DOS FATOS:\n${fmt(x.fatos)}\n\nO descumprimento no prazo ensejará a adoção das medidas judiciais cabíveis, com a cobrança de perdas e danos, custas e honorários advocatícios, o que se pretende evitar.\n\n${fmt(x.cidade)}, ${hoje()}.\n\n${fmt(x.adv)}\nOAB ${fmt(x.oab)}` },
  { id: 'honorarios', nome: 'Contrato de honorários advocatícios', f: (x) => `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS E HONORÁRIOS\n\nCONTRATANTE: ${fmt(x.cliente)}, ${x.clienteDoc ? 'documento nº ' + x.clienteDoc + ',' : ''} residente em ${fmt(x.clienteCidade)}.\nCONTRATADO: ${fmt(x.escritorio)}, representado por ${fmt(x.adv)}, OAB ${fmt(x.oab)}.\n\nCLÁUSULA 1ª — DO OBJETO. Patrocínio dos interesses do CONTRATANTE em ${fmt(x.titulo)}${x.numero ? ' (processo nº ' + x.numero + ')' : ''}.\n\nCLÁUSULA 2ª — DOS HONORÁRIOS. Pelos serviços, o CONTRATANTE pagará: [PREENCHER: valor fixo e/ou percentual de êxito e forma de pagamento].\n\nCLÁUSULA 3ª — DAS DESPESAS. Custas, emolumentos e despesas processuais correm por conta do CONTRATANTE, mediante prestação de contas.\n\nCLÁUSULA 4ª — DA OBRIGAÇÃO DE MEIO. O CONTRATADO obriga-se a empregar toda a técnica e diligência, sem garantia de resultado.\n\nCLÁUSULA 5ª — DA PROTEÇÃO DE DADOS. Os dados pessoais serão tratados exclusivamente para a execução deste contrato, nos termos da Lei 13.709/2018 (LGPD).\n\nCLÁUSULA 6ª — DO FORO. Fica eleito o foro da comarca de ${fmt(x.cidade)}.\n\n${fmt(x.cidade)}, ${hoje()}.\n\n______________________  ______________________\nCONTRATANTE            CONTRATADO` },
  { id: 'procuracao', nome: 'Procuração ad judicia', f: (x) => `PROCURAÇÃO AD JUDICIA ET EXTRA\n\nOUTORGANTE: ${fmt(x.cliente)}, ${x.clienteDoc ? 'documento nº ' + x.clienteDoc + ',' : ''} residente em ${fmt(x.clienteCidade)}.\n\nOUTORGADO: ${fmt(x.adv)}, advogado(a), OAB ${fmt(x.oab)}, com escritório profissional ${x.escritorio ? 'na sede de ' + x.escritorio : '[PREENCHER]'}.\n\nPODERES: pelo presente instrumento, o OUTORGANTE confere ao OUTORGADO os poderes da cláusula ad judicia et extra, para o foro em geral, em qualquer juízo, instância ou tribunal, podendo propor ações, contestar, recorrer, transigir, desistir, receber e dar quitação, e substabelecer com ou sem reservas, a fim de defender seus direitos em ${fmt(x.titulo)}.\n\n${fmt(x.cidade)}, ${hoje()}.\n\n______________________\n${fmt(x.cliente)}` },
  { id: 'contestacao', nome: 'Contestação (modelo-base)', f: (x) => `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ${fmt(x.vara)} ${fmt(x.tribunal)}\n\nProcesso nº ${fmt(x.numero)}\n\n${fmt(x.cliente).toUpperCase()}, já qualificado(a) nos autos da ação movida por ${fmt(x.contraria).toUpperCase()}, por seu advogado, vem apresentar\n\nCONTESTAÇÃO\n\npelos motivos de fato e de direito a seguir.\n\nI — SÍNTESE DA INICIAL\n[PREENCHER: resumo das alegações do autor.]\n\nII — PRELIMINARES\n[PREENCHER: se houver (art. 337 do CPC).]\n\nIII — MÉRITO\n${fmt(x.fatos)}\n\nIV — PEDIDOS\nRequer a total improcedência dos pedidos, a condenação do autor em custas e honorários, e a produção de todas as provas em direito admitidas.\n\nTermos em que, pede deferimento.\n\n${fmt(x.cidade)}, ${hoje()}.\n\n${fmt(x.adv)}\nOAB ${fmt(x.oab)}` },
];
export async function aiDraft({ template, caso, cliente, advogado, escritorio, instrucoes }) {
  const t = TEMPLATES.find((x) => x.id === template); if (!t) throw Object.assign(new Error('Modelo inválido.'), { http: 422 });
  const x = { cliente: cliente?.nome, clienteDoc: cliente?.doc, clienteCidade: cliente?.cidade, contraria: caso?.parteContraria, titulo: caso?.titulo, numero: caso?.numero, vara: caso?.vara, tribunal: caso?.tribunal, valor: caso?.valorCausa, fatos: instrucoes || caso?.obs, adv: advogado?.name, oab: advogado?.oab, escritorio: escritorio?.name, cidade: cliente?.cidade, pedido: instrucoes ? '' : '' };
  let texto = t.f(x); let engine = 'local';
  const refined = await llm(SYS, `Revise e complemente esta minuta mantendo a estrutura. Preencha somente o que puder ser deduzido das informações fornecidas; mantenha [PREENCHER] nos demais pontos.\n\nInstruções do advogado: ${instrucoes || '(nenhuma)'}\n\nMINUTA:\n${texto}`);
  if (refined) { texto = refined; engine = 'llm'; }
  const faltam = (texto.match(/\[PREENCHER[^\]]*\]/g) || []).length;
  return { engine, modelo: t.nome, texto, lacunas: faltam };
}
