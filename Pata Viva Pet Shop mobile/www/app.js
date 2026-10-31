/* PataViva — app de serviços e loja para pet shop. 100% offline, dados no aparelho. */
(function () {
'use strict';
const CFG = { shop: 'Pata Viva Pet Shop', phone: '5511987654321', phoneFmt: '(11) 98765-4321', addr: 'Rua das Acácias, 482 — Jardim Primavera, São Paulo/SP', hours: 'Seg–Sex 8h às 18h • Sáb 8h às 14h' };
const $app = document.getElementById('app');
const R = (n) => 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const pd = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const tmin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const mt = (m) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], WDL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MON = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dlong = (k) => { const d = pd(k); return `${WDL[d.getDay()]}, ${d.getDate()} de ${MON[d.getMonth()]}`; };
const dshort = (k) => { const d = pd(k); return `${WD[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
const SIZES = ['Mini', 'Pequeno', 'Médio', 'Grande', 'Gigante'];
const sizeOf = (kg) => (kg < 5 ? 0 : kg < 10 ? 1 : kg < 25 ? 2 : kg < 40 ? 3 : 4);

/* ---------- catálogo ---------- */
const PROS = [
  { id: 'cam', name: 'Camila Duarte', role: 'Banho e tosa', kind: 'groom', cap: 1, color: '#ff6b3d' },
  { id: 'raf', name: 'Rafael Moura', role: 'Banho e tosa', kind: 'groom', cap: 1, color: '#12b5a2' },
  { id: 'jul', name: 'Juliana Prado', role: 'Tosa artística', kind: 'groom', cap: 1, color: '#8b5cf6' },
  { id: 'bia', name: 'Dra. Beatriz Menezes', role: 'Médica-veterinária', kind: 'vet', cap: 1, color: '#2f80ed' },
  { id: 'cre', name: 'Equipe Creche', role: 'Creche e hospedagem', kind: 'care', cap: 8, color: '#e0a100' },
];
const proById = Object.fromEntries(PROS.map((p) => [p.id, p]));
const SVC = [
  { id: 'banho', n: 'Banho', e: '🛁', kind: 'groom', pr: [40, 50, 65, 85, 110], dur: 60, d: 'Shampoo adequado à pelagem, secagem, limpeza de ouvidos e perfume.' },
  { id: 'tosahig', n: 'Tosa higiênica', e: '✂️', kind: 'groom', pr: [30, 35, 45, 55, 70], dur: 30, d: 'Pelos das patas, barriga e região íntima aparados com carinho.' },
  { id: 'bt', n: 'Banho e tosa', e: '🐩', kind: 'groom', pr: [75, 90, 115, 150, 190], dur: 120, d: 'Banho completo + tosa na máquina ou tesoura, no estilo que você escolher.' },
  { id: 'consulta', n: 'Consulta veterinária', e: '🩺', kind: 'vet', pr: [150, 150, 150, 150, 150], dur: 40, d: 'Avaliação clínica completa com a veterinária e orientações de tratamento.' },
  { id: 'v10', n: 'Vacina V10 / V8', e: '💉', kind: 'vet', pr: [95, 95, 95, 95, 95], dur: 20, d: 'Protege contra cinomose, parvovirose, hepatite, leptospirose e outras.' },
  { id: 'raiva', n: 'Antirrábica', e: '💉', kind: 'vet', pr: [70, 70, 70, 70, 70], dur: 20, d: 'Dose anual obrigatória contra a raiva, com certificado.' },
  { id: 'checkup', n: 'Check-up completo', e: '🔬', kind: 'vet', pr: [240, 240, 240, 240, 240], dur: 60, d: 'Consulta + exame físico detalhado + orientação de rotina preventiva.' },
  { id: 'creche', n: 'Creche (dia todo)', e: '🏡', kind: 'care', pr: [60, 70, 80, 95, 110], dur: 540, d: 'Recreação supervisionada, alimentação e descanso das 8h às 17h30.' },
];
const ADD = [
  { id: 'hidra', n: 'Hidratação', e: '💧', pr: [25, 30, 40, 50, 65], dur: 20, kinds: ['groom'] },
  { id: 'dentes', n: 'Escovação de dentes', e: '🪥', pr: [20, 20, 20, 20, 20], dur: 10, kinds: ['groom'] },
  { id: 'unhas', n: 'Corte de unhas', e: '🐾', pr: [15, 15, 15, 15, 15], dur: 10, kinds: ['groom', 'vet'] },
  { id: 'taxi', n: 'Táxi Dog (ida e volta)', e: '🚐', pr: [25, 25, 30, 35, 45], dur: 0, kinds: ['groom', 'vet', 'care'] },
];
const svcById = Object.fromEntries(SVC.map((s) => [s.id, s]));
const addById = Object.fromEntries(ADD.map((s) => [s.id, s]));
const PLANS = [
  { id: 'bronze', n: 'Pet Básico', price: 119, off: 10, items: ['2 banhos por mês', '10% de desconto em serviços', 'Pontos em dobro nas compras'] },
  { id: 'prata', n: 'Pet Plus', price: 219, off: 15, hot: true, items: ['4 banhos por mês', '1 hidratação grátis', '15% de desconto em serviços', 'Táxi Dog com 50% off'] },
  { id: 'ouro', n: 'Pet Premium', price: 329, off: 20, items: ['4 banhos + 2 tosas por mês', 'Táxi Dog grátis', '20% de desconto em serviços e loja', 'Prioridade na agenda'] },
];
const PROD = [
  ['Ração Premium Cães Adultos 10,1 kg', 189.9, '🦴', 'Rações', '#ffe3d8'], ['Ração Premium Filhotes 10,1 kg', 209.9, '🐶', 'Rações', '#fff3cf'], ['Ração Gatos Castrados 3 kg', 98.9, '🐱', 'Rações', '#d6f5f0'], ['Ração Gatos Filhotes 1,5 kg', 54.9, '😺', 'Rações', '#e9e3ff'],
  ['Petisco Bifinho de Frango 500 g', 24.9, '🍗', 'Petiscos', '#ffe3d8'], ['Osso Natural Nó Grande', 16.9, '🍖', 'Petiscos', '#fff3cf'], ['Sachê Gatos Sabor Salmão', 3.9, '🐟', 'Petiscos', '#d6f5f0'],
  ['Bolinha de Borracha Maciça', 19.9, '🎾', 'Brinquedos', '#d9f5e5'], ['Mordedor Corda Trançada', 22.9, '🪢', 'Brinquedos', '#ffe3d8'], ['Arranhador para Gatos', 79.9, '🐈', 'Brinquedos', '#e9e3ff'], ['Varinha com Penas', 14.9, '🪶', 'Brinquedos', '#d6f5f0'],
  ['Shampoo Neutro 500 ml', 34.9, '🧴', 'Higiene', '#d6f5f0'], ['Condicionador Pelos Longos 500 ml', 39.9, '🧴', 'Higiene', '#fff3cf'], ['Tapete Higiênico 30 un.', 59.9, '🧻', 'Higiene', '#ffe3d8'], ['Areia Sanitária 4 kg', 24.9, '🪣', 'Higiene', '#e9e3ff'],
  ['Antipulgas e Carrapatos (até 10 kg)', 89.9, '🛡️', 'Saúde', '#d9f5e5'], ['Vermífugo Comprimido', 39.9, '💊', 'Saúde', '#fde3e4'],
  ['Cama Pet Confort M', 129.9, '🛏️', 'Acessórios', '#fff3cf'], ['Coleira Ajustável com Guia', 49.9, '🦮', 'Acessórios', '#ffe3d8'], ['Comedouro Inox Antiderrapante', 37.9, '🥣', 'Acessórios', '#d6f5f0'], ['Caixa de Transporte M', 159.9, '🧳', 'Acessórios', '#e9e3ff'],
].map(([n, p, e, c, bg], i) => ({ id: i + 1, n, p, e, c, bg }));
const PCATS = ['Todos', ...new Set(PROD.map((x) => x.c))];
const COATS = ['#d9a066', '#f2e2c4', '#3b3b3b', '#8b5a2b', '#c9c9c9', '#f08a24', '#fff'];

/* ---------- estado ---------- */
let S;
try { S = JSON.parse(localStorage.getItem('pataviva.v1')); } catch (e) { S = null; }
if (!S) S = { setup: false, tutor: { name: '', phone: '', addr: '' }, pets: [], bookings: [], vaccines: [], orders: [], cart: [], points: 0, plan: null, shop: null, nid: 100 };
const save = () => { try { localStorage.setItem('pataviva.v1', JSON.stringify(S)); } catch (e) {} };
const nid = () => ++S.nid;
const petById = (id) => S.pets.find((p) => p.id === id);
const toast = (t) => { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 1900); };
const all = () => [...(S.shop || []), ...S.bookings].filter((b) => b.status !== 'cancelado');
const planOff = () => (S.plan ? PLANS.find((p) => p.id === S.plan).off : 0);

/* ---------- regras ---------- */
function quote(petId, svcId, addons) {
  const pet = petById(petId), sz = sizeOf(pet.weight), s = svcById[svcId];
  const lines = [{ n: s.n, v: s.pr[sz] }];
  let dur = s.dur;
  addons.forEach((a) => { const ad = addById[a]; let v = ad.pr[sz]; if (a === 'taxi' && S.plan === 'ouro') v = 0; else if (a === 'taxi' && S.plan === 'prata') v = v / 2; if (a === 'hidra' && S.plan === 'prata') v = 0; lines.push({ n: ad.n, v }); dur += ad.dur; });
  const sub = lines.reduce((a, l) => a + l.v, 0);
  const off = Math.round(sub * planOff()) / 100;
  return { lines, sub, off, total: sub - off, dur: Math.ceil(dur / 30) * 30, sz };
}
function openHours(k) { const d = pd(k).getDay(); return d === 0 ? null : d === 6 ? [480, 840] : [480, 1080]; }
function slotsFor(proId, date, dur) {
  const hrs = openHours(date), pro = proById[proId]; if (!hrs) return [];
  const now = new Date(), isToday = dkey(now) === date, nowMin = now.getHours() * 60 + now.getMinutes() + 30;
  const busy = all().filter((b) => b.date === date && b.proId === proId && b.id !== (B && B.editing));
  const out = [];
  for (let t = hrs[0]; t + Math.min(dur, 60) <= hrs[1]; t += 30) {
    let ok = t + dur <= hrs[1] || pro.kind === 'care';
    if (pro.kind === 'care' && t > 540) ok = false;
    if (pro.kind === 'vet' && t < 780 && t + dur > 720) ok = false;
    if (isToday && t < nowMin) ok = false;
    if (ok) { const n = busy.filter((b) => tmin(b.time) < t + dur && tmin(b.time) + b.dur > t).length; if (n >= pro.cap) ok = false; }
    out.push({ t: mt(t), ok });
  }
  return out;
}
function stage(b) {
  if (b.status === 'cancelado') return -1;
  if (b.status === 'entregue') return 4;
  if (b.manual != null) return b.manual;
  const now = new Date(), k = dkey(now);
  if (b.date > k) return 0;
  const st = tmin(b.time), cur = now.getHours() * 60 + now.getMinutes();
  if (b.date < k) return 4;
  if (cur < st) return 0;
  const f = (cur - st) / Math.max(30, b.dur);
  return f < 0.12 ? 1 : f < 0.6 ? 2 : f < 1 ? 3 : 4;
}
const STAGES = { groom: ['Agendado', 'Pet recebido', 'No banho / tosa', 'Secagem e acabamento', 'Pronto para retirada'], vet: ['Agendado', 'Check-in feito', 'Em atendimento', 'Finalizando', 'Atendimento concluído'], care: ['Agendado', 'Pet recebido', 'Recreação', 'Descanso e lanche', 'Pronto para retirada'] };
const stageLabel = (b) => STAGES[proById[b.proId].kind][stage(b)];

/* ---------- ícones / ilustrações ---------- */
const IC = { home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>', bag: '<path d="M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0"/>', paw: '<circle cx="7" cy="10" r="2"/><circle cx="12" cy="7" r="2"/><circle cx="17" cy="10" r="2"/><path d="M12 12c-3 0-5 3-5 5 0 2 2 2 5 2s5 0 5-2c0-2-2-5-5-5z"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', back: '<path d="M15 5l-7 7 7 7"/>', cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l3 12h11l2-8H6"/>', bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>' };
const icon = (n) => `<svg viewBox="0 0 24 24" width="22" height="22" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">${IC[n]}</svg>`;
function avatar(p, s = 64) {
  const c = p.coat || '#d9a066', dark = '#2a2118';
  const cat = p.species === 'Gato';
  const ears = cat ? `<path d="M14 28L18 8l14 12zM66 28L62 8 48 20z" fill="${c}" stroke="${dark}" stroke-width="2.5" stroke-linejoin="round"/><path d="M19 22l1-8 6 6zM61 22l-1-8-6 6z" fill="#f6b6b6"/>` : `<ellipse cx="17" cy="34" rx="10" ry="19" fill="${c}" stroke="${dark}" stroke-width="2.5" transform="rotate(14 17 34)" style="filter:brightness(.82)"/><ellipse cx="63" cy="34" rx="10" ry="19" fill="${c}" stroke="${dark}" stroke-width="2.5" transform="rotate(-14 63 34)" style="filter:brightness(.82)"/>`;
  const muzzle = cat ? '' : `<ellipse cx="40" cy="52" rx="14" ry="11" fill="#fff" opacity=".85"/>`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 80 80">${ears}<circle cx="40" cy="42" r="26" fill="${c}" stroke="${dark}" stroke-width="2.5"/>${muzzle}<circle cx="30" cy="38" r="3.4" fill="${dark}"/><circle cx="50" cy="38" r="3.4" fill="${dark}"/><circle cx="31" cy="37" r="1.1" fill="#fff"/><circle cx="51" cy="37" r="1.1" fill="#fff"/><path d="M36 48h8l-4 5z" fill="${dark}"/><path d="M40 53v3m-5 0c2 3 8 3 10 0" stroke="${dark}" stroke-width="2" fill="none" stroke-linecap="round"/>${cat ? '<path d="M18 48h-8M18 52l-7 3M62 48h8M62 52l7 3" stroke="#2a2118" stroke-width="1.5" stroke-linecap="round"/>' : ''}</svg>`;
}
const bannerArt = `<svg class="art" width="150" height="150" viewBox="0 0 150 150"><circle cx="85" cy="82" r="60" fill="#fff" opacity=".18"/><g transform="translate(18 20) scale(1.45)"><ellipse cx="17" cy="34" rx="10" ry="19" fill="#f2e2c4" stroke="#2a2118" stroke-width="2.5" transform="rotate(14 17 34)"/><ellipse cx="63" cy="34" rx="10" ry="19" fill="#f2e2c4" stroke="#2a2118" stroke-width="2.5" transform="rotate(-14 63 34)"/><circle cx="40" cy="42" r="26" fill="#fff3d9" stroke="#2a2118" stroke-width="2.5"/><circle cx="30" cy="38" r="3.4" fill="#2a2118"/><circle cx="50" cy="38" r="3.4" fill="#2a2118"/><path d="M36 48h8l-4 5z" fill="#2a2118"/><path d="M40 53v3m-5 0c2 3 8 3 10 0" stroke="#2a2118" stroke-width="2" fill="none" stroke-linecap="round"/></g></svg>`;
const tabs = (cur) => `<nav class="tabs">${[['inicio', 'Início', 'home'], ['agenda', 'Agenda', 'cal'], ['loja', 'Loja', 'bag'], ['pets', 'Meus pets', 'paw'], ['perfil', 'Perfil', 'user']].map(([r, l, i]) => `<a href="#/${r}" class="${cur === r ? 'on' : ''}">${icon(i)}${l}</a>`).join('')}</nav>`;
const bk = (t) => `<a class="back" data-act="bback" href="javascript:void(0)">${icon('back')} ${t}</a>`;
const back = (t = 'Voltar') => `<a class="back" href="javascript:history.back()">${icon('back')} ${t}</a>`;
const bookingCard = (b, opt = {}) => { const pet = b.petId ? petById(b.petId) : null, s = svcById[b.svc], st = stage(b); return `<div class="card agenda-item" style="padding:12px" data-go="#/ag/${b.id}"><div class="tm">${b.time}<small>${mt(tmin(b.time) + b.dur)}</small></div><div class="grow"><div class="row sp"><h3>${s.e} ${s.n}</h3><span class="pill ${st >= 4 ? 'ok' : st > 0 ? 'pri' : 'teal'}">${['Agendado', 'Recebido', 'Em atendimento', 'Finalizando', 'Pronto'][st]}</span></div><p class="mut sm" style="margin-top:4px">${pet ? pet.name : b.pet} • ${proById[b.proId].name.replace('Dra. ', '')}${opt.date ? ' • ' + dshort(b.date) : ''}</p></div></div>`; };

/* ---------- telas ---------- */
const V = {};
const FORMPET = { name: '', species: 'Cachorro', breed: '', weight: '', age: '', coat: COATS[0], notes: '' };
V.setup = () => `<div class="screen" style="padding-bottom:30px"><div style="text-align:center;margin:26px 0 22px"><div style="display:inline-block">${bannerArt.replace('class="art"', '')}</div><h1 style="margin-top:6px">Pata Viva</h1><p class="mut">Banho, tosa, veterinária e loja para o seu pet.</p></div>
  <label class="field"><span>Seu nome</span><input id="s-name" placeholder="Como devemos te chamar?" value="${S.tutor.name}"></label>
  <label class="field"><span>Celular (WhatsApp)</span><input id="s-phone" inputmode="tel" placeholder="(11) 90000-0000" value="${S.tutor.phone}"></label>
  <label class="field"><span>Endereço (para Táxi Dog e entregas)</span><input id="s-addr" placeholder="Rua, número e bairro" value="${S.tutor.addr}"></label>
  <h2 style="margin-top:6px">Seu primeiro pet</h2>${petForm()}
  <button class="btn" data-act="finishsetup" style="margin-top:6px">Começar</button></div>`;
function petForm() {
  const f = V._pf || (V._pf = { ...FORMPET });
  return `<div class="grid2"><label class="field"><span>Nome</span><input id="pf-name" value="${f.name}" placeholder="Ex.: Thor"></label><label class="field"><span>Espécie</span><select id="pf-sp"><option ${f.species === 'Cachorro' ? 'selected' : ''}>Cachorro</option><option ${f.species === 'Gato' ? 'selected' : ''}>Gato</option></select></label>
  <label class="field"><span>Raça</span><input id="pf-breed" value="${f.breed}" placeholder="Ex.: Golden Retriever"></label><label class="field"><span>Peso (kg)</span><input id="pf-w" type="number" step="0.1" value="${f.weight}" placeholder="0,0"></label>
  <label class="field"><span>Idade (anos)</span><input id="pf-age" type="number" step="0.5" value="${f.age}"></label><div class="field"><span>Cor do pelo</span><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:4px">${COATS.map((c) => `<button data-act="coat" data-v="${c}" style="width:28px;height:28px;border-radius:50%;background:${c};box-shadow:inset 0 0 0 ${f.coat === c ? '3px var(--pri)' : '1.5px #d9d1c4'}"></button>`).join('')}</div></div></div>`;
}
function readPet() {
  const g = (id) => document.getElementById(id).value;
  return { name: g('pf-name').trim(), species: g('pf-sp'), breed: g('pf-breed').trim() || 'Sem raça definida (SRD)', weight: parseFloat(g('pf-w')) || 0, age: parseFloat(g('pf-age')) || 0, coat: V._pf.coat };
}

V.inicio = () => {
  const t = S.tutor, next = all().filter((b) => S.bookings.includes(b) && stage(b) < 4 && `${b.date} ${b.time}` >= dkey(new Date()) + ' 00:00').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const due = dueVaccines();
  const h = new Date().getHours();
  return `<div class="screen"><div class="hdr"><div><small>${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'},</small><h1>${t.name.split(' ')[0] || 'Tutor'} 👋</h1></div><div class="row"><a class="ic" href="#/loja/carrinho">${icon('cart')}${S.cart.length ? `<i>${S.cart.reduce((a, c) => a + c.q, 0)}</i>` : ''}</a></div></div>
  <div class="banner"><h3>${S.plan ? 'Seu Clube Pata Viva está ativo' : 'Banho e tosa com hora marcada'}</h3><p>${S.plan ? `${planOff()}% de desconto em todos os serviços.` : 'Escolha o serviço, o profissional e o melhor horário em poucos toques.'}</p><button class="btn" data-go="#/agendar">Agendar agora</button>${bannerArt}</div>
  <h2>Atalhos</h2><div class="qa">${[['🛁', 'Banho', 'banho'], ['🩺', 'Consulta', 'consulta'], ['💉', 'Vacinas', 'v10'], ['🏡', 'Creche', 'creche']].map(([e, l, id]) => `<button data-act="quick" data-v="${id}"><span>${e}</span>${l}</button>`).join('')}</div>
  ${next ? `<h2>Próximo agendamento <a href="#/agenda">Ver agenda</a></h2>${bookingCard(next, { date: true })}` : ''}
  ${due.length ? `<h2>Lembretes de saúde</h2>${due.slice(0, 2).map((d) => `<div class="card row" style="margin-bottom:10px;background:var(--yel2);box-shadow:none"><div style="font-size:26px">💉</div><div class="grow"><h3 style="font-size:15px">${d.v.name} — ${petById(d.v.petId).name}</h3><p class="sm" style="color:#8a6100">${d.days < 0 ? 'Atrasada há ' + -d.days + ' dias' : d.days === 0 ? 'Vence hoje' : 'Vence em ' + d.days + ' dias'}</p></div><button class="btn sm dark" data-act="quick" data-v="${d.v.name.includes('Antirr') ? 'raiva' : 'v10'}" data-pet="${d.v.petId}">Agendar</button></div>`).join('')}` : ''}
  <h2>Meus pets <a href="#/pets">Ver todos</a></h2><div class="hs">${S.pets.map((p) => `<div class="card petcard" data-go="#/pet/${p.id}">${avatar(p, 70)}<h3>${p.name}</h3><p class="mut sm">${p.breed.split(' ').slice(0, 2).join(' ')}</p></div>`).join('')}<div class="card petcard" data-go="#/pets/novo" style="display:grid;place-items:center;color:var(--pri);font-weight:800"><div style="font-size:34px">＋</div>Adicionar</div></div>
  <h2>Serviços populares <a href="#/agendar">Todos</a></h2>${SVC.slice(0, 3).map((s) => `<div class="card svc" data-act="quick" data-v="${s.id}"><div class="e">${s.e}</div><div class="grow"><h3>${s.n}</h3><p class="mut sm">${s.d.slice(0, 58)}…</p></div><b style="color:var(--pri)">${R(s.pr[1]).replace(',00', '')}</b></div>`).join('')}
  ${S.plan ? '' : `<div class="card row" style="background:var(--ink);color:#fff;margin-top:6px" data-go="#/clube"><div style="font-size:34px">👑</div><div class="grow"><h3>Clube Pata Viva</h3><p class="sm" style="opacity:.75">Banhos mensais a partir de R$ 119</p></div><span class="pill yel">Conhecer</span></div>`}
  </div>${tabs('inicio')}`;
};
function dueVaccines() {
  const today = dkey(new Date());
  return S.vaccines.filter((v) => v.next && petById(v.petId)).map((v) => ({ v, days: Math.round((pd(v.next) - pd(today)) / 864e5) })).filter((x) => x.days <= 30).sort((a, b) => a.days - b.days);
}

/* ----- agendamento ----- */
let B = null;
V.agendar = () => {
  if (!B) B = { step: 1, petId: S.pets[0] && S.pets[0].id, svc: null, addons: [], proId: null, date: null, time: null, pay: 'Pix', notes: '', usePts: false };
  const steps = `<div class="steps">${[1, 2, 3, 4].map((i) => `<i class="${i <= B.step ? 'on' : ''}"></i>`).join('')}</div>`;
  const head = `${bk('Etapa anterior')}<h1>${['', 'Quem vai e o quê?', 'Extras e profissional', 'Data e horário', 'Confirmar agendamento'][B.step]}</h1><p class="mut" style="margin-top:2px">Etapa ${B.step} de 4</p>`;
  if (B.step === 1) {
    const pet = petById(B.petId);
    return `<div class="screen">${bk('Cancelar')}<h1>Quem vai e o quê?</h1><p class="mut" style="margin:2px 0 6px">Etapa 1 de 4</p>${steps}
    <h2 style="margin-top:6px">Seu pet</h2><div class="hs">${S.pets.map((p) => `<button class="card petcard" data-act="bpet" data-v="${p.id}" style="${p.id === B.petId ? 'box-shadow:inset 0 0 0 3px var(--pri)' : ''}">${avatar(p, 64)}<h3>${p.name}</h3><span class="pill ${p.id === B.petId ? 'pri' : ''}">${SIZES[sizeOf(p.weight)]}</span></button>`).join('')}</div>
    <h2>Serviço</h2>${SVC.map((s) => `<button class="opt ${B.svc === s.id ? 'on' : ''}" data-act="bsvc" data-v="${s.id}"><div style="font-size:28px">${s.e}</div><div class="grow"><h3>${s.n}</h3><p class="mut sm">${s.dur >= 540 ? 'Dia todo' : s.dur + ' min'} • ${s.d.slice(0, 44)}…</p></div><b style="color:var(--pri)">${R(s.pr[sizeOf(pet.weight)]).replace(',00', '')}</b></button>`).join('')}
    <div class="foot"><button class="btn" data-act="bnext" ${B.svc ? '' : 'disabled'}>Continuar</button></div></div>`;
  }
  if (B.step === 2) {
    const s = svcById[B.svc], pet = petById(B.petId), pros = PROS.filter((p) => p.kind === s.kind), ads = ADD.filter((a) => a.kinds.includes(s.kind));
    return `<div class="screen">${head}${steps}${ads.length ? `<h2 style="margin-top:6px">Adicionais</h2>${ads.map((a) => `<button class="opt ${B.addons.includes(a.id) ? 'on' : ''}" data-act="badd" data-v="${a.id}"><div class="chk">${B.addons.includes(a.id) ? '✓' : ''}</div><div style="font-size:24px">${a.e}</div><div class="grow"><h3 style="font-size:15px">${a.n}</h3></div><b>+ ${R(a.pr[sizeOf(pet.weight)]).replace(',00', '')}</b></button>`).join('')}` : ''}
    <h2>Profissional</h2>${pros.map((p) => `<button class="opt ${B.proId === p.id ? 'on' : ''}" data-act="bpro" data-v="${p.id}"><div style="width:44px;height:44px;border-radius:50%;background:${p.color};color:#fff;display:grid;place-items:center;font-weight:800;font-size:18px">${p.name.replace('Dra. ', '')[0]}</div><div class="grow"><h3 style="font-size:15px">${p.name}</h3><p class="mut sm">${p.role}</p></div><div class="chk">${B.proId === p.id ? '✓' : ''}</div></button>`).join('')}
    <div class="foot"><button class="btn" data-act="bnext" ${B.proId ? '' : 'disabled'}>Escolher data e horário</button></div></div>`;
  }
  if (B.step === 3) {
    const q = quote(B.petId, B.svc, B.addons);
    const days = []; const base = new Date(); for (let i = 0; i < 21; i++) { const d = new Date(base); d.setDate(base.getDate() + i); days.push(dkey(d)); }
    if (!B.date) B.date = days.find((k) => slotsFor(B.proId, k, q.dur).some((s) => s.ok));
    const slots = slotsFor(B.proId, B.date, q.dur);
    return `<div class="screen">${head}${steps}<div class="chips" style="margin-top:4px">${days.map((k) => { const d = pd(k), has = slotsFor(B.proId, k, q.dur).some((s) => s.ok); return `<button class="chip ${B.date === k ? 'on' : ''}" data-act="bdate" data-v="${k}" style="${has ? '' : 'opacity:.4'};text-align:center;line-height:1.25"><small style="display:block;font-weight:600">${WD[d.getDay()]}</small><b style="font-size:17px">${pad(d.getDate())}</b></button>`; }).join('')}</div>
    <h2>${dlong(B.date)}</h2>${slots.length ? `<div class="slots">${slots.map((s) => `<button class="slot ${B.time === s.t ? 'on' : ''}" data-act="btime" data-v="${s.t}" ${s.ok ? '' : 'disabled'}>${s.t}</button>`).join('')}</div>` : '<div class="card empty">Fechado aos domingos. Escolha outro dia.</div>'}
    <p class="mut sm" style="margin-top:14px">Duração estimada: ${q.dur >= 540 ? 'dia todo' : q.dur + ' min'} • com ${proById[B.proId].name}</p>
    <div class="foot"><button class="btn" data-act="bnext" ${B.time ? '' : 'disabled'}>Revisar agendamento</button></div></div>`;
  }
  const q = quote(B.petId, B.svc, B.addons), pet = petById(B.petId), s = svcById[B.svc];
  const pts = Math.min(S.points, Math.floor(q.total / 5 * 100) ), disc = B.usePts ? Math.min(Math.floor(S.points / 100) * 5, q.total) : 0;
  return `<div class="screen">${head}${steps}<div class="card row" style="margin-bottom:12px">${avatar(pet, 56)}<div class="grow"><h3>${s.e} ${s.n}</h3><p class="mut sm">${pet.name} • ${proById[B.proId].name}</p><p class="b" style="margin-top:3px">${dlong(B.date)} às ${B.time}</p></div></div>
  <div class="card sum">${q.lines.map((l) => `<div class="l"><span>${l.n}</span><b>${l.v ? R(l.v) : 'Grátis'}</b></div>`).join('')}${q.off ? `<div class="l" style="color:var(--teal)"><span>Desconto do Clube (${planOff()}%)</span><b>− ${R(q.off)}</b></div>` : ''}${disc ? `<div class="l" style="color:var(--teal)"><span>Pontos resgatados</span><b>− ${R(disc)}</b></div>` : ''}<div class="l"><span class="b">Total</span><span class="t">${R(q.total - disc)}</span></div></div>
  ${S.points >= 100 ? `<button class="opt ${B.usePts ? 'on' : ''}" style="margin-top:12px" data-act="bpts"><div class="chk">${B.usePts ? '✓' : ''}</div><div class="grow"><h3 style="font-size:15px">Usar meus pontos</h3><p class="mut sm">${S.points} pontos = ${R(Math.floor(S.points / 100) * 5)} de desconto</p></div></button>` : ''}
  <h2>Pagamento no atendimento</h2><div class="chips">${['Pix', 'Cartão', 'Dinheiro'].map((m) => `<button class="chip ${B.pay === m ? 'on' : ''}" data-act="bpay" data-v="${m}">${m}</button>`).join('')}</div>
  <label class="field" style="margin-top:14px"><span>Observações para a equipe (opcional)</span><textarea id="b-notes" placeholder="Alergias, comportamento, estilo de tosa…">${B.notes}</textarea></label>
  <div class="foot"><button class="btn" data-act="bconfirm">Confirmar agendamento • ${R(q.total - disc)}</button></div></div>`;
};
function confirmBooking() {
  const q = quote(B.petId, B.svc, B.addons), notes = (document.getElementById('b-notes') || {}).value || '';
  const disc = B.usePts ? Math.min(Math.floor(S.points / 100) * 5, q.total) : 0;
  const clash = slotsFor(B.proId, B.date, q.dur).find((s) => s.t === B.time);
  if (!clash || !clash.ok) { toast('Esse horário acabou de ser ocupado'); B.time = null; B.step = 3; render(); return; }
  const total = q.total - disc;
  const b = { id: B.editing || nid(), petId: B.petId, svc: B.svc, addons: B.addons, proId: B.proId, date: B.date, time: B.time, dur: q.dur, total, pay: B.pay, notes, status: 'agendado', created: Date.now() };
  if (B.editing) { const i = S.bookings.findIndex((x) => x.id === B.editing); b.status = 'agendado'; S.bookings[i] = b; } else { S.bookings.push(b); }
  if (disc) S.points -= Math.floor(disc / 5) * 100;
  save(); const id = b.id; B = null; location.replace('#/ok/' + id);
}
V.ok = (id) => { const b = S.bookings.find((x) => x.id === +id); if (!b) return V.inicio(); const pet = petById(b.petId), s = svcById[b.svc];
  return `<div class="screen" style="text-align:center;padding-top:50px"><div style="width:96px;height:96px;border-radius:50%;background:var(--teal2);display:grid;place-items:center;margin:0 auto 18px;font-size:48px">✅</div><h1>Agendado!</h1><p class="mut" style="margin:6px 0 22px">Enviamos a confirmação para o seu celular.</p>
  <div class="card" style="text-align:left"><div class="row">${avatar(pet, 56)}<div><h3>${s.e} ${s.n}</h3><p class="mut sm">${pet.name} • ${proById[b.proId].name}</p></div></div><div class="row sp" style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--line)"><div><p class="mut sm">Data</p><b>${dshort(b.date)}</b></div><div><p class="mut sm">Horário</p><b>${b.time}</b></div><div><p class="mut sm">Total</p><b style="color:var(--pri)">${R(b.total)}</b></div></div></div>
  <p class="mut sm" style="margin:16px 0">📍 ${CFG.addr}<br>Você pode reagendar ou cancelar até 2 horas antes.</p><button class="btn" data-go="#/ag/${b.id}">Ver agendamento</button><button class="btn ghost" style="margin-top:10px" data-go="#/inicio">Voltar ao início</button></div>`; };

/* ----- agenda ----- */
V.agenda = () => {
  const cur = V._cal || (V._cal = new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const sel = V._sel || dkey(new Date()), first = cur.getDay(), dim = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
  const mine = S.bookings.filter((b) => b.status !== 'cancelado');
  const cells = []; for (let i = 0; i < first; i++) cells.push('<span></span>');
  for (let d = 1; d <= dim; d++) { const k = dkey(new Date(cur.getFullYear(), cur.getMonth(), d)); cells.push(`<button class="${k === sel ? 'sel' : ''} ${k === dkey(new Date()) ? 'today' : ''} ${mine.some((b) => b.date === k) ? 'dot' : ''}" data-act="calsel" data-v="${k}">${d}</button>`); }
  const day = mine.filter((b) => b.date === sel).sort((a, b) => a.time.localeCompare(b.time));
  const up = mine.filter((b) => b.date > dkey(new Date())).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return `<div class="screen"><div class="row sp"><h1>Agenda</h1><button class="btn sm" data-go="#/agendar">+ Agendar</button></div>
  <div class="card" style="margin-top:16px"><div class="row sp" style="margin-bottom:10px"><button data-act="calprev" class="ic" style="width:36px;height:36px">${icon('back')}</button><h3 style="text-transform:capitalize">${MON[cur.getMonth()]} ${cur.getFullYear()}</h3><button data-act="calnext" class="ic" style="width:36px;height:36px;transform:scaleX(-1)">${icon('back')}</button></div><div class="cal">${WD.map((w) => `<div class="h">${w.toUpperCase()}</div>`).join('')}${cells.join('')}</div></div>
  <h2>${dlong(sel)}</h2>${day.map((b) => bookingCard(b)).join('') || '<div class="card empty">Nenhum agendamento neste dia.<br><button class="btn sm" style="margin:12px auto 0" data-go="#/agendar">Agendar</button></div>'}
  ${up.length ? `<h2>Próximos</h2>${up.slice(0, 4).map((b) => bookingCard(b, { date: true })).join('')}` : ''}</div>${tabs('agenda')}`;
};
V.ag = (id) => {
  const b = S.bookings.find((x) => x.id === +id); if (!b) return V.agenda();
  const pet = petById(b.petId), s = svcById[b.svc], pro = proById[b.proId], st = stage(b), lab = STAGES[pro.kind];
  const canEdit = st === 0 && b.status !== 'cancelado';
  return `<div class="screen">${back('Agenda')}<div class="card row">${avatar(pet, 64)}<div class="grow"><h1 style="font-size:21px">${s.e} ${s.n}</h1><p class="mut">${pet.name} • ${pet.breed}</p></div></div>
  <div class="grid2" style="margin-top:12px"><div class="card stat"><div class="l">Data</div><div class="v" style="font-size:18px">${dshort(b.date)}</div></div><div class="card stat"><div class="l">Horário</div><div class="v" style="font-size:18px">${b.time} – ${mt(tmin(b.time) + b.dur)}</div></div></div>
  <h2>Acompanhe o atendimento</h2><div class="card"><div class="tl">${lab.map((t, i) => `<div class="${i < st ? 'd' : i === st ? 'c' : ''}"><i>${i < st ? '✓' : ''}</i><b>${t}</b>${i === st && st > 0 && st < 4 ? '<p class="mut sm">Agora • atualizado automaticamente</p>' : ''}</div>`).join('')}</div></div>
  <h2>Detalhes</h2><div class="card sum"><div class="l"><span>Profissional</span><b>${pro.name}</b></div>${b.addons.map((a) => `<div class="l"><span>+ ${addById[a].n}</span><b></b></div>`).join('')}<div class="l"><span>Pagamento</span><b>${b.pay} (no atendimento)</b></div>${b.notes ? `<div class="l"><span>Observações</span><b style="max-width:60%;text-align:right">${b.notes}</b></div>` : ''}<div class="l"><span class="b">Total</span><span class="t">${R(b.total)}</span></div></div>
  <div class="row" style="margin-top:16px"><a class="btn ghost" style="text-decoration:none;flex:1" href="https://wa.me/${CFG.phone}?text=${encodeURIComponent('Olá! Sobre o agendamento #' + b.id + ' do ' + pet.name)}">💬 Falar com a loja</a></div>
  ${canEdit ? `<div class="row" style="margin-top:10px"><button class="btn ghost" data-act="resched" data-v="${b.id}">Reagendar</button><button class="btn bad" data-act="cancelb" data-v="${b.id}">Cancelar</button></div>` : ''}</div>${tabs('agenda')}`;
};

/* ----- pets ----- */
V.pets = () => `<div class="screen"><div class="row sp"><h1>Meus pets</h1><button class="btn sm" data-go="#/pets/novo">+ Novo pet</button></div><div style="margin-top:16px">${S.pets.map((p) => { const sz = SIZES[sizeOf(p.weight)]; return `<div class="card row" style="margin-bottom:12px" data-go="#/pet/${p.id}">${avatar(p, 72)}<div class="grow"><h3 style="font-size:18px">${p.name}</h3><p class="mut sm">${p.breed}</p><div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><span class="pill teal">${p.weight.toString().replace('.', ',')} kg</span><span class="pill">${p.age ? p.age + ' ' + (p.age === 1 ? 'ano' : 'anos') : 'Filhote'}</span><span class="pill pri">${sz}</span></div></div></div>`; }).join('')}</div></div>${tabs('pets')}`;
V.novopet = () => { V._pf = V._pf && !V._pf.name ? V._pf : { ...FORMPET }; return `<div class="screen">${back('Meus pets')}<h1>Novo pet</h1><div style="margin:12px 0 10px;text-align:center">${avatar({ species: V._pf.species, coat: V._pf.coat }, 90)}</div>${petForm()}<button class="btn" data-act="savepet">Salvar pet</button></div>`; };
V.pet = (id) => {
  const p = petById(+id); if (!p) return V.pets();
  const vs = S.vaccines.filter((v) => v.petId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const hist = S.bookings.filter((b) => b.petId === p.id && stage(b) >= 4).sort((a, b) => b.date.localeCompare(a.date));
  const today = dkey(new Date());
  return `<div class="screen">${back('Meus pets')}<div class="card" style="text-align:center"><div style="margin:-6px 0 6px">${avatar(p, 96)}</div><h1>${p.name}</h1><p class="mut">${p.breed} • ${p.species}</p>
  <div class="grid2" style="grid-template-columns:repeat(3,1fr);margin-top:14px"><div><b style="font-size:20px">${p.weight.toString().replace('.', ',')}</b><p class="mut sm">kg</p></div><div><b style="font-size:20px">${p.age || '<1'}</b><p class="mut sm">anos</p></div><div><b style="font-size:20px">${SIZES[sizeOf(p.weight)]}</b><p class="mut sm">porte</p></div></div></div>
  <h2>Carteira de vacinação <button class="btn sm dark" style="height:34px" data-act="addvac" data-v="${p.id}">+ Registrar</button></h2>${vs.map((v) => { const days = v.next ? Math.round((pd(v.next) - pd(today)) / 864e5) : null; return `<div class="card row" style="margin-bottom:10px"><div style="font-size:26px">💉</div><div class="grow"><h3 style="font-size:15px">${v.name}</h3><p class="mut sm">Aplicada em ${dshort(v.date)}/${pd(v.date).getFullYear()}</p></div>${v.next ? `<span class="pill ${days < 0 ? 'bad' : days <= 30 ? 'yel' : 'ok'}">${days < 0 ? 'Atrasada' : days <= 30 ? 'Vence em ' + days + 'd' : 'Em dia'}</span>` : ''}</div>`; }).join('') || '<div class="card empty">Nenhuma vacina registrada.</div>'}
  <h2>Histórico de serviços</h2>${hist.slice(0, 5).map((b) => `<div class="card row" style="margin-bottom:10px"><div style="font-size:24px">${svcById[b.svc].e}</div><div class="grow"><h3 style="font-size:15px">${svcById[b.svc].n}</h3><p class="mut sm">${dshort(b.date)} • ${proById[b.proId].name}</p></div><b>${R(b.total)}</b></div>`).join('') || '<div class="card empty">Ainda sem atendimentos concluídos.</div>'}
  <button class="btn" style="margin-top:14px" data-act="quick" data-v="banho" data-pet="${p.id}">Agendar para ${p.name}</button></div>${tabs('pets')}`;
};
function vaccineSheet(petId) {
  const el = document.createElement('div'); el.className = 'modal';
  const T = ['V10 / V8', 'Antirrábica', 'Gripe canina (tosse dos canis)', 'Giárdia', 'Leishmaniose', 'Tríplice felina', 'Vermífugo'];
  el.innerHTML = `<div class="sheet"><h3 style="font-size:19px;margin-bottom:14px">Registrar vacina</h3><label class="field"><span>Vacina</span><select id="vv-n">${T.map((t) => `<option>${t}</option>`).join('')}</select></label><label class="field"><span>Data da aplicação</span><input id="vv-d" type="date" value="${dkey(new Date())}"></label><label class="field"><span>Próxima dose (opcional)</span><input id="vv-x" type="date"></label><button class="btn" data-ok>Salvar</button><button class="btn ghost" style="margin-top:10px" data-no>Cancelar</button></div>`;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-no]')) return el.remove(); if (e.target.closest('[data-ok]')) { const g = (i) => el.querySelector(i).value; S.vaccines.push({ petId, name: g('#vv-n'), date: g('#vv-d'), next: g('#vv-x') || null }); save(); el.remove(); toast('Vacina registrada'); render(); } });
}

/* ----- loja ----- */
V.loja = () => {
  const c = V._pc || 'Todos', list = PROD.filter((p) => c === 'Todos' || p.c === c), n = S.cart.reduce((a, x) => a + x.q, 0);
  return `<div class="screen"><div class="row sp"><h1>Loja</h1><a class="ic" href="#/loja/carrinho">${icon('cart')}${n ? `<i>${n}</i>` : ''}</a></div><p class="mut" style="margin:2px 0 14px">Retire na loja ou receba em casa.</p>
  <div class="chips">${PCATS.map((x) => `<button class="chip ${c === x ? 'on' : ''}" data-act="pcat" data-v="${x}">${x}</button>`).join('')}</div>
  <div class="grid2" style="margin-top:16px">${list.map((p) => `<div class="prod"><div class="im" style="background:${p.bg}">${p.e}</div><h3 style="font-size:14px;min-height:38px">${p.n}</h3><div class="row sp" style="margin-top:8px"><b style="font-size:16px">${R(p.p)}</b><button class="add" data-act="addcart" data-v="${p.id}">+</button></div></div>`).join('')}</div></div>${tabs('loja')}`;
};
V.carrinho = () => {
  const items = S.cart.map((c) => ({ ...c, p: PROD.find((x) => x.id === c.pid) })), sub = items.reduce((a, i) => a + i.p.p * i.q, 0), off = S.plan === 'ouro' ? sub * 0.2 : 0, ship = V._ship === 'entrega' ? (sub > 150 ? 0 : 12) : 0;
  return `<div class="screen">${back('Loja')}<h1>Carrinho</h1>${items.length ? `<div style="margin-top:14px">${items.map((i) => `<div class="card row" style="margin-bottom:10px;padding:12px"><div style="width:62px;height:62px;border-radius:16px;background:${i.p.bg};display:grid;place-items:center;font-size:32px">${i.p.e}</div><div class="grow"><h3 style="font-size:14px">${i.p.n}</h3><b style="color:var(--pri)">${R(i.p.p * i.q)}</b></div><div class="row" style="gap:8px"><button class="ic" style="width:32px;height:32px" data-act="qty" data-v="${i.pid}" data-d="-1">−</button><b>${i.q}</b><button class="ic" style="width:32px;height:32px" data-act="qty" data-v="${i.pid}" data-d="1">+</button></div></div>`).join('')}</div>
  <h2>Entrega</h2><div class="chips" style="margin-bottom:12px"><button class="chip ${V._ship !== 'entrega' ? 'on' : ''}" data-act="ship" data-v="retirada">Retirar na loja • grátis</button><button class="chip ${V._ship === 'entrega' ? 'on' : ''}" data-act="ship" data-v="entrega">Receber em casa</button></div>
  <div class="card sum"><div class="l"><span>Subtotal</span><b>${R(sub)}</b></div>${off ? `<div class="l" style="color:var(--teal)"><span>Desconto Pet Premium (20%)</span><b>− ${R(off)}</b></div>` : ''}<div class="l"><span>Entrega</span><b>${ship ? R(ship) : 'Grátis'}</b></div><div class="l"><span class="b">Total</span><span class="t">${R(sub - off + ship)}</span></div></div>
  <div class="foot"><button class="btn" data-act="checkout">Finalizar pedido • ${R(sub - off + ship)}</button></div>` : '<div class="card empty" style="margin-top:16px">Seu carrinho está vazio.<br><button class="btn sm" style="margin:14px auto 0" data-go="#/loja">Ver produtos</button></div>'}</div>`;
};

/* ----- perfil, clube, pedidos ----- */
V.perfil = () => `<div class="screen"><div class="row" style="margin-bottom:18px"><div class="ic" style="width:64px;height:64px;border-radius:50%;background:var(--pri);color:#fff;font-size:26px;font-weight:800">${(S.tutor.name || 'T')[0]}</div><div><h1>${S.tutor.name}</h1><p class="mut">${S.tutor.phone}</p></div></div>
  <div class="grid2"><div class="card stat"><div class="l">⭐ Pontos</div><div class="v">${S.points}</div><p class="mut sm">100 pts = R$ 5 off</p></div><div class="card stat" data-go="#/clube"><div class="l">👑 Clube</div><div class="v" style="font-size:19px">${S.plan ? PLANS.find((p) => p.id === S.plan).n : 'Sem plano'}</div><p class="mut sm">${S.plan ? planOff() + '% de desconto' : 'Conheça os planos'}</p></div></div>
  <h2>Minha conta</h2>${[['📦', 'Meus pedidos', '#/pedidos'], ['👑', 'Clube Pata Viva', '#/clube'], ['🏪', 'Painel da loja (equipe)', '#/gestao'], ['📍', 'Como chegar', '#/loja-info']].map(([e, t, h]) => `<div class="card row" style="margin-bottom:10px;padding:14px" data-go="${h}"><div style="font-size:24px">${e}</div><h3 class="grow" style="font-size:15px">${t}</h3><span class="mut">›</span></div>`).join('')}
  <label class="field" style="margin-top:14px"><span>Endereço para Táxi Dog e entregas</span><input id="pr-addr" value="${S.tutor.addr}"></label><button class="btn ghost" data-act="saveaddr">Salvar endereço</button>
  <button class="btn bad" style="margin-top:22px" data-act="reset">Apagar meus dados</button><p class="mut sm" style="text-align:center;margin-top:14px">PataViva 1.0 • Dados salvos apenas neste aparelho</p></div>${tabs('perfil')}`;
V.lojainfo = () => `<div class="screen">${back('Perfil')}<h1>${CFG.shop}</h1><div class="card sum" style="margin-top:14px"><div class="l"><span>📍 Endereço</span><b style="text-align:right;max-width:62%">${CFG.addr}</b></div><div class="l"><span>🕘 Horário</span><b style="text-align:right;max-width:62%">${CFG.hours}</b></div><div class="l"><span>📞 Telefone</span><b>${CFG.phoneFmt}</b></div></div><a class="btn teal" style="margin-top:14px;text-decoration:none" href="https://wa.me/${CFG.phone}">💬 Chamar no WhatsApp</a><a class="btn ghost" style="margin-top:10px;text-decoration:none" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CFG.addr)}">🗺️ Abrir no mapa</a></div>`;
V.clube = () => `<div class="screen">${back('Voltar')}<h1>Clube Pata Viva 👑</h1><p class="mut" style="margin:4px 0 16px">Assine e economize em todos os banhos e tosas do mês.</p>${PLANS.map((p) => `<div class="plan ${p.hot ? 'hot' : ''}">${p.hot ? '<span class="pill pri" style="position:absolute;right:14px;top:14px">Mais escolhido</span>' : ''}<h3>${p.n}</h3><div class="pr">${R(p.price).replace(',00', '')}<small class="mut" style="font-size:14px;font-weight:600">/mês</small></div><ul>${p.items.map((i) => `<li>${i}</li>`).join('')}</ul>${S.plan === p.id ? '<button class="btn ghost" disabled>Plano atual</button>' : `<button class="btn ${p.hot ? '' : 'dark'}" data-act="plan" data-v="${p.id}">Assinar ${p.n}</button>`}</div>`).join('')}${S.plan ? '<button class="btn bad" data-act="plan" data-v="">Cancelar assinatura</button>' : ''}</div>`;
V.pedidos = () => `<div class="screen">${back('Perfil')}<h1>Meus pedidos</h1><div style="margin-top:14px">${S.orders.slice().reverse().map((o) => `<div class="card" style="margin-bottom:12px"><div class="row sp"><h3>Pedido #${o.id}</h3><span class="pill ${o.status === 'Entregue' ? 'ok' : 'pri'}">${o.status}</span></div><p class="mut sm" style="margin:4px 0 8px">${dshort(o.date)} • ${o.mode === 'entrega' ? 'Entrega' : 'Retirada na loja'}</p>${o.items.map((i) => `<p class="sm">${i.q}× ${i.n}</p>`).join('')}<div class="row sp" style="margin-top:10px;border-top:1px dashed var(--line);padding-top:10px"><span class="mut">Total</span><b style="color:var(--pri)">${R(o.total)}</b></div></div>`).join('') || '<div class="card empty">Você ainda não fez pedidos.</div>'}</div></div>`;

/* ----- painel da loja (equipe) ----- */
V.gestao = (tab) => {
  const d = V._gd || dkey(new Date()), t = tab || 'agenda';
  const list = all().filter((b) => b.date === d).sort((a, b) => a.time.localeCompare(b.time));
  const rev = (b) => b.total;
  const days = []; for (let i = 6; i >= 0; i--) { const x = new Date(); x.setDate(x.getDate() - i); days.push(dkey(x)); }
  const byDay = days.map((k) => ({ k, v: all().filter((b) => b.date === k && stage(b) >= 3 || (b.date === k && b.date >= dkey(new Date()))).reduce((a, b) => a + rev(b), 0) }));
  const mx = Math.max(1, ...byDay.map((x) => x.v));
  const cnt = {}; all().forEach((b) => (cnt[b.svc] = (cnt[b.svc] || 0) + 1));
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5), tmax = top[0] ? top[0][1] : 1;
  const hoje = list.reduce((a, b) => a + rev(b), 0), occ = Math.round(list.reduce((a, b) => a + Math.min(b.dur, 120), 0) / (PROS.filter((p) => p.cap === 1).length * 600) * 100);
  const orders = S.orders.reduce((a, o) => a + o.total, 0);
  return `<div class="screen">${back('Perfil')}<div class="row sp"><div><h1>Painel da loja</h1><p class="mut">${CFG.shop}</p></div><span class="pill dark">Equipe</span></div>
  <div class="chips" style="margin-top:14px"><button class="chip ${t === 'agenda' ? 'on' : ''}" data-go="#/gestao/agenda">Agenda do dia</button><button class="chip ${t === 'fin' ? 'on' : ''}" data-go="#/gestao/fin">Financeiro</button><button class="chip ${t === 'equipe' ? 'on' : ''}" data-go="#/gestao/equipe">Equipe</button></div>
  ${t === 'agenda' ? `<div class="row sp" style="margin:16px 0 4px"><button class="ic" style="width:38px;height:38px" data-act="gday" data-v="-1">${icon('back')}</button><h3>${dlong(d)}</h3><button class="ic" style="width:38px;height:38px;transform:scaleX(-1)" data-act="gday" data-v="1">${icon('back')}</button></div>
  <div class="grid2" style="grid-template-columns:repeat(3,1fr);margin:12px 0"><div class="card stat" style="padding:12px"><div class="v">${list.length}</div><div class="l">atendimentos</div></div><div class="card stat" style="padding:12px"><div class="v" style="font-size:19px">${R(hoje).replace(',00', '')}</div><div class="l">previsto</div></div><div class="card stat" style="padding:12px"><div class="v">${Math.min(100, occ)}%</div><div class="l">ocupação</div></div></div>
  ${list.map((b) => { const pet = b.petId ? petById(b.petId) : null, s = svcById[b.svc], pro = proById[b.proId], st = stage(b); return `<div class="card" style="margin-bottom:10px;padding:14px;border-left:5px solid ${pro.color}"><div class="row sp"><b>${b.time} – ${mt(tmin(b.time) + b.dur)}</b><span class="pill ${st >= 4 ? 'ok' : st > 0 ? 'pri' : ''}">${stageLabel(b)}</span></div><h3 style="margin:6px 0 2px">${s.e} ${s.n} • ${pet ? pet.name : b.pet}</h3><p class="mut sm">${pet ? S.tutor.name : b.tutor} • ${pro.name}</p>${st < 4 ? `<button class="btn sm dark" style="margin-top:10px" data-act="adv" data-v="${b.id}">${['Marcar pet recebido', 'Iniciar atendimento', 'Finalizar etapa', 'Marcar como pronto', ''][st]}</button>` : `<button class="btn sm teal" style="margin-top:10px" data-act="deliver" data-v="${b.id}">${b.status === 'entregue' ? '✓ Entregue ao tutor' : 'Registrar entrega'}</button>`}</div>`; }).join('') || '<div class="card empty">Sem atendimentos neste dia.</div>'}` : ''}
  ${t === 'fin' ? `<div class="grid2" style="margin-top:16px"><div class="card stat"><div class="l">Serviços (7 dias)</div><div class="v">${R(byDay.reduce((a, x) => a + x.v, 0)).replace(',00', '')}</div></div><div class="card stat"><div class="l">Loja (pedidos)</div><div class="v">${R(orders).replace(',00', '')}</div></div></div>
  <h2>Faturamento por dia</h2><div class="card"><div class="bars">${byDay.map((x) => `<div><i style="height:${Math.max(4, x.v / mx * 90)}px"></i><span class="mut sm">${WD[pd(x.k).getDay()]}</span></div>`).join('')}</div></div>
  <h2>Serviços mais vendidos</h2><div class="card">${top.map(([id, n]) => `<div style="margin-bottom:12px"><div class="row sp sm"><b>${svcById[id].e} ${svcById[id].n}</b><span class="mut">${n}</span></div><div style="height:8px;border-radius:8px;background:#f1ece4;margin-top:5px"><div style="height:100%;width:${n / tmax * 100}%;background:var(--teal);border-radius:8px"></div></div></div>`).join('')}</div>` : ''}
  ${t === 'equipe' ? PROS.map((p) => { const n = all().filter((b) => b.date === d && b.proId === p.id).length; return `<div class="card row" style="margin:12px 0 0"><div style="width:48px;height:48px;border-radius:50%;background:${p.color};color:#fff;display:grid;place-items:center;font-weight:800;font-size:20px">${p.name.replace('Dra. ', '')[0]}</div><div class="grow"><h3>${p.name}</h3><p class="mut sm">${p.role}</p></div><span class="pill ${n ? 'pri' : 'ok'}">${n} hoje</span></div>`; }).join('') : ''}</div>`;
};

/* ---------- exemplo para capturas ---------- */
function seed() {
  const D = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return dkey(x); };
  S = { setup: true, tutor: { name: 'Mariana Souza', phone: '(11) 98412-7730', addr: 'Rua dos Ipês, 215 — Vila Nova, São Paulo/SP' }, pets: [], bookings: [], vaccines: [], orders: [], cart: [], points: 240, plan: 'prata', shop: [], nid: 200 };
  S.pets.push({ id: 1, name: 'Thor', species: 'Cachorro', breed: 'Golden Retriever', weight: 31.5, age: 4, coat: '#d9a066' }, { id: 2, name: 'Mel', species: 'Cachorro', breed: 'Shih Tzu', weight: 6.8, age: 2, coat: '#f2e2c4' }, { id: 3, name: 'Luna', species: 'Gato', breed: 'Siamês', weight: 4.1, age: 3, coat: '#c9c9c9' });
  S.vaccines.push({ petId: 1, name: 'V10 / V8', date: D(-340), next: D(25) }, { petId: 1, name: 'Antirrábica', date: D(-200), next: D(165) }, { petId: 2, name: 'V10 / V8', date: D(-380), next: D(-12) }, { petId: 3, name: 'Tríplice felina', date: D(-90), next: D(275) }, { petId: 1, name: 'Gripe canina (tosse dos canis)', date: D(-150), next: null });
  const now = new Date(), r30 = Math.floor((now.getHours() * 60 + now.getMinutes() - 40) / 30) * 30;
  const startToday = Math.max(480, Math.min(r30, 960));
  const mk = (id, petId, svc, proId, date, time, status, addons = []) => { const q = quote(petId, svc, addons); S.bookings.push({ id, petId, svc, addons, proId, date, time, dur: q.dur, total: q.total, pay: 'Pix', notes: '', status, created: Date.now() }); };
  mk(11, 1, 'bt', 'cam', D(0), mt(startToday), 'agendado', ['hidra']);
  mk(12, 2, 'banho', 'raf', D(2), '10:00', 'agendado', ['unhas']); mk(13, 3, 'consulta', 'bia', D(5), '15:00', 'agendado'); mk(14, 1, 'v10', 'bia', D(8), '09:30', 'agendado'); mk(15, 2, 'bt', 'jul', D(12), '14:00', 'agendado', ['taxi']);
  mk(16, 1, 'banho', 'cam', D(-14), '09:00', 'entregue'); mk(17, 2, 'bt', 'raf', D(-21), '11:00', 'entregue'); mk(18, 3, 'checkup', 'bia', D(-30), '10:30', 'entregue');
  const names = [['Bob', 'Rodrigo Lima'], ['Nina', 'Paula Teixeira'], ['Rex', 'Carlos Andrade'], ['Pipoca', 'Fernanda Rocha'], ['Max', 'Luiz Gomes'], ['Belinha', 'Aline Costa'], ['Duque', 'Marcos Pires'], ['Fiona', 'Tatiana Alves'], ['Simba', 'Eduardo Nunes'], ['Lola', 'Renata Dias'], ['Zeca', 'Bruno Faria'], ['Amora', 'Camila Reis']];
  let seedn = 5; const rnd = () => (seedn = (seedn * 16807) % 2147483647) / 2147483647;
  let n = 0; const plan = [['bt', 'cam', 120], ['banho', 'raf', 60], ['tosahig', 'jul', 30], ['consulta', 'bia', 40], ['v10', 'bia', 20], ['bt', 'jul', 120], ['banho', 'cam', 60], ['creche', 'cre', 540]];
  for (const off of [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7]) { const day = D(off); const hrs = openHours(day); if (!hrs) continue; const used = {};
    for (let i = 0; i < 6; i++) { const [svc, pro, dur] = plan[Math.floor(rnd() * plan.length)]; let t = hrs[0] + 30 * Math.floor(rnd() * 14); if (pro !== 'cre' && t + dur > hrs[1]) continue; if (pro === 'cre') t = 480; if (pro === 'bia' && t + dur > 720 && t < 780) continue; const u = used[pro] || (used[pro] = []); if (pro !== 'cre' && u.some((x) => x[0] < t + dur && x[1] > t)) continue; if (S.bookings.some((b) => b.date === day && b.proId === pro && pro !== 'cre' && tmin(b.time) < t + dur && tmin(b.time) + b.dur > t)) continue; u.push([t, t + dur]); const [pet, tutor] = names[n++ % names.length]; S.shop.push({ id: 900 + n, pet, tutor, svc, addons: [], proId: pro, date: day, time: mt(t), dur: svc === 'creche' ? 540 : dur, total: svcById[svc].pr[2 + Math.floor(rnd() * 2)], status: 'agendado', pay: 'Pix' }); } }
  S.orders.push({ id: 3021, date: D(-9), mode: 'retirada', status: 'Entregue', items: [{ n: 'Ração Premium Cães Adultos 10,1 kg', q: 1 }, { n: 'Petisco Bifinho de Frango 500 g', q: 2 }], total: 239.7 }, { id: 3044, date: D(-2), mode: 'entrega', status: 'Em separação', items: [{ n: 'Shampoo Neutro 500 ml', q: 1 }, { n: 'Mordedor Corda Trançada', q: 1 }], total: 57.8 });
  save();
}

/* ---------- roteador ---------- */
let route = '';
function render() {
  const h = (location.hash || '#/').replace(/^#\/?/, ''), [r, a, c] = h.split('/');
  if (r === 'exemplo') { seed(); B = null; location.replace('#/' + (a || 'inicio')); return; }
  if (!S.setup && r !== 'setup') { location.replace('#/setup'); return; }
  let html;
  switch (r) {
    case 'setup': html = V.setup(); break;
    case 'agendar': html = V.agendar(); break;
    case 'ok': html = V.ok(a); break;
    case 'agenda': html = V.agenda(); break;
    case 'ag': html = V.ag(a); break;
    case 'pets': html = a === 'novo' ? V.novopet() : V.pets(); break;
    case 'pet': html = V.pet(a); break;
    case 'loja': html = a === 'carrinho' ? V.carrinho() : V.loja(); break;
    case 'perfil': html = V.perfil(); break;
    case 'loja-info': html = V.lojainfo(); break;
    case 'clube': html = V.clube(); break;
    case 'pedidos': html = V.pedidos(); break;
    case 'gestao': html = V.gestao(a); break;
    default: html = V.inicio();
  }
  const keep = route === h ? ($app.querySelector('.screen') || {}).scrollTop : 0;
  $app.innerHTML = html; route = h;
  const sc = $app.querySelector('.screen'); if (sc && keep) sc.scrollTop = keep;
}
window.addEventListener('hashchange', render);
setInterval(() => { if (/^(ag\/|gestao|inicio)/.test(route) && !document.querySelector('.modal')) render(); }, 30000);

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-act]');
  if (!t) { const go = ev.target.closest('[data-go]'); if (go) location.hash = go.dataset.go; return; }
  const a = t.dataset.act, v = t.dataset.v;
  switch (a) {
    case 'coat': { V._pf = { ...readPet(), coat: v }; render(); break; }
    case 'finishsetup': { const g = (i) => document.getElementById(i).value.trim(); const pet = readPet(); if (!g('s-name') || !pet.name || !pet.weight) return toast('Preencha seu nome e os dados do pet'); S.tutor = { name: g('s-name'), phone: g('s-phone'), addr: g('s-addr') }; S.pets.push({ id: nid(), ...pet }); S.setup = true; V._pf = null; save(); location.replace('#/inicio'); break; }
    case 'savepet': { const pet = readPet(); if (!pet.name || !pet.weight) return toast('Informe o nome e o peso'); S.pets.push({ id: nid(), ...pet }); V._pf = null; save(); toast(pet.name + ' foi adicionado!'); location.replace('#/pets'); break; }
    case 'quick': { B = null; B = { step: 1, petId: +t.dataset.pet || (S.pets[0] || {}).id, svc: v, addons: [], proId: null, date: null, time: null, pay: 'Pix', notes: '', usePts: false }; const s = svcById[v]; const pros = PROS.filter((p) => p.kind === s.kind); B.proId = pros[0].id; B.step = 2; location.hash = '#/agendar'; break; }
    case 'bback': if (B.step > 1 && !(B.editing && B.step === 3)) { B.step--; route = ''; render(); } else { B = null; history.back(); } break;
    case 'bpet': B.petId = +v; render(); break;
    case 'bsvc': { B.svc = v; B.addons = []; B.proId = null; B.date = null; B.time = null; render(); break; }
    case 'badd': { const i = B.addons.indexOf(v); i >= 0 ? B.addons.splice(i, 1) : B.addons.push(v); render(); break; }
    case 'bpro': B.proId = v; B.date = null; B.time = null; render(); break;
    case 'bdate': B.date = v; B.time = null; render(); break;
    case 'btime': B.time = v; render(); break;
    case 'bpay': { B.notes = (document.getElementById('b-notes') || {}).value || B.notes; B.pay = v; render(); break; }
    case 'bpts': { B.notes = (document.getElementById('b-notes') || {}).value || B.notes; B.usePts = !B.usePts; render(); break; }
    case 'bnext': B.step++; route = ''; render(); break;
    case 'bconfirm': confirmBooking(); break;
    case 'resched': { const b = S.bookings.find((x) => x.id === +v); B = { step: 3, editing: b.id, petId: b.petId, svc: b.svc, addons: b.addons.slice(), proId: b.proId, date: null, time: null, pay: b.pay, notes: b.notes, usePts: false }; location.hash = '#/agendar'; break; }
    case 'cancelb': if (confirm('Cancelar este agendamento?')) { const b = S.bookings.find((x) => x.id === +v); b.status = 'cancelado'; save(); toast('Agendamento cancelado'); location.replace('#/agenda'); } break;
    case 'calprev': V._cal = new Date(V._cal.getFullYear(), V._cal.getMonth() - 1, 1); render(); break;
    case 'calnext': V._cal = new Date(V._cal.getFullYear(), V._cal.getMonth() + 1, 1); render(); break;
    case 'calsel': V._sel = v; render(); break;
    case 'addvac': vaccineSheet(+v); break;
    case 'pcat': V._pc = v; render(); break;
    case 'addcart': { const c = S.cart.find((x) => x.pid === +v); c ? c.q++ : S.cart.push({ pid: +v, q: 1 }); save(); toast('Adicionado ao carrinho'); render(); break; }
    case 'qty': { const c = S.cart.find((x) => x.pid === +v); c.q += +t.dataset.d; if (c.q <= 0) S.cart.splice(S.cart.indexOf(c), 1); save(); render(); break; }
    case 'ship': V._ship = v; render(); break;
    case 'checkout': { const items = S.cart.map((c) => ({ n: PROD.find((p) => p.id === c.pid).n, q: c.q, p: PROD.find((p) => p.id === c.pid).p })); const sub = items.reduce((x, i) => x + i.p * i.q, 0), off = S.plan === 'ouro' ? sub * 0.2 : 0, ship = V._ship === 'entrega' ? (sub > 150 ? 0 : 12) : 0; const total = sub - off + ship; S.orders.push({ id: nid() + 3000, date: dkey(new Date()), mode: V._ship || 'retirada', status: 'Recebido', items: items.map(({ n, q }) => ({ n, q })), total }); S.points += Math.round(total) * (S.plan ? 2 : 1); S.cart = []; save(); toast('Pedido realizado!'); location.replace('#/pedidos'); break; }
    case 'plan': { S.plan = v || null; save(); toast(v ? 'Bem-vindo ao Clube! 👑' : 'Assinatura cancelada'); render(); break; }
    case 'saveaddr': S.tutor.addr = document.getElementById('pr-addr').value; save(); toast('Endereço salvo'); break;
    case 'reset': if (confirm('Apagar todos os dados do aplicativo?')) { localStorage.removeItem('pataviva.v1'); location.hash = ''; location.reload(); } break;
    case 'gday': { const d = pd(V._gd || dkey(new Date())); d.setDate(d.getDate() + +v); V._gd = dkey(d); render(); break; }
    case 'adv': { const b = all().find((x) => x.id === +v); b.manual = Math.min(4, stage(b) + 1); save(); render(); break; }
    case 'deliver': { const b = all().find((x) => x.id === +v); b.status = 'entregue'; b.manual = 4; if (S.bookings.includes(b)) S.points += Math.round(b.total); save(); toast('Entrega registrada'); render(); break; }
  }
});
window.appBack = function () { const h = location.hash; if (/^#\/(inicio|agenda|loja|pets|perfil|setup)?$/.test(h) || h === '') return false; history.back(); return true; };
if (!location.hash) location.hash = '#/inicio';
render();
})();
