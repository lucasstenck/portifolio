/* Vigora — treino e alimentação em casa. App 100% offline (dados no aparelho). */
(function () {
'use strict';
const EX = window.EXERCISES, FOODS = window.FOODS;
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
EX.forEach((e) => (e.n = norm(e.name)));
const byId = Object.fromEntries(EX.map((e) => [e.id, e]));
const find = (q) => { const nq = norm(q); return EX.find((e) => e.n === nq) || EX.find((e) => e.n.includes(nq)); };
const img = (e) => `ex/${e.slug}.webp`;
const $app = document.getElementById('app');
const todayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MEALS = [['cafe', 'Café da manhã', '☕'], ['almoco', 'Almoço', '🍛'], ['lanche', 'Lanche', '🥪'], ['jantar', 'Jantar', '🍲'], ['ceia', 'Ceia', '🍎']];
const FOOD_CATS = [...new Set(FOODS.map((f) => f.c))];

/* ---------- estado ---------- */
let S;
try { S = JSON.parse(localStorage.getItem('vigora.v1')); } catch (e) { S = null; }
if (!S) S = { onboarded: false, profile: { name: '', sex: 'm', age: 28, weight: 75, height: 175, goal: 'emagrecer', level: 'Iniciante', days: 4, equip: 'corpo' }, logs: [], meals: {}, water: {}, weights: [], fav: [] };
const save = () => { try { localStorage.setItem('vigora.v1', JSON.stringify(S)); } catch (e) {} };

function metas() {
  const p = S.profile;
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161);
  const act = [1.2, 1.375, 1.45, 1.55, 1.725, 1.8, 1.9][Math.min(6, Math.max(0, p.days - 1))] || 1.45;
  const tdee = bmr * act;
  const kcal = Math.round((p.goal === 'emagrecer' ? tdee - 450 : p.goal === 'ganhar' ? tdee + 300 : tdee) / 10) * 10;
  return { kcal, water: Math.round(p.weight * 35 / 250) * 250, bmr: Math.round(bmr) };
}

/* ---------- programas ---------- */
const P = (id, name, desc, level, focus, equip, rest, items, cover) => ({ id, name, desc, level, focus, equip, rest, items, cover });
const PROGRAMS = [
  P('corpo-todo', 'Corpo todo • Iniciante', 'Circuito completo para ativar todos os grupos musculares, sem equipamentos.', 'Iniciante', 'Corpo todo', 'Peso do corpo', 40, [['Agachamento Livre', 3, 12], ['Flexão de braço inclinada', 3, 10], ['Afundo Inverso', 3, 10], ['Elevação de quadril', 3, 15], ['Abdominal reto', 3, 15], ['Prancha com Elevação Alternada', 3, '30s'], ['Polichinelo', 2, '40s']], 'Agachamento Livre'),
  P('hiit20', 'HIIT queima total • 20 min', 'Intervalos intensos de 40s para acelerar o metabolismo e queimar gordura.', 'Intermediário', 'Cardio / HIIT', 'Peso do corpo', 20, [['Burpee', 3, '40s'], ['Escalador', 3, '40s'], ['Agachamento com salto', 3, '40s'], ['Joelhos altos pulos', 3, '40s'], ['Polichinelo', 3, '40s'], ['Afundos com salto', 3, '40s']], 'Burpee'),
  P('abdomen', 'Abdômen definido', 'Sequência focada em reto abdominal, oblíquos e estabilidade do core.', 'Intermediário', 'Abdômen', 'Peso do corpo', 30, [['Abdominal reto', 3, 20], ['Abdominais de bicicleta', 3, 20], ['Abdominal Russo', 3, 20], ['Abdominal tesoura', 3, '30s'], ['Escalador cruzado', 3, '40s'], ['Prancha com rotação da coluna', 3, '30s'], ['Abdominal infra solo', 3, 15]], 'Abdominais de bicicleta'),
  P('gluteos', 'Glúteos e pernas', 'Volume de glúteos, quadríceps e posteriores usando só o peso do corpo.', 'Intermediário', 'Pernas e glúteos', 'Peso do corpo', 40, [['Agachamento sumô', 4, 15], ['Afundo Inverso', 3, 12], ['Ponte de Glúteos Unilateral', 3, 12], ['Hidrantes de incêndio', 3, 15], ['Agachamento búlgaro', 3, 10], ['Coices de burro', 3, 15]], 'Ponte de Glúteos Unilateral'),
  P('superior', 'Parte superior com halteres', 'Ombros, costas, peito e braços com um par de halteres.', 'Intermediário', 'Superior', 'Halteres', 50, [['Desenvolvimento em Pé com Halteres', 4, 10], ['Remada com um braço', 3, 12], ['Crucifixo em Pé com Halteres', 3, 12], ['Elevações laterais', 3, 15], ['Rosca martelo com halteres', 3, 12], ['Tríceps Testa com Halteres', 3, 12]], 'Desenvolvimento em Pé com Halteres'),
  P('peito', 'Peito e tríceps em casa', 'Variações de flexão para construir peitoral e tríceps no chão da sala.', 'Intermediário', 'Peito e tríceps', 'Peso do corpo', 45, [['Flexão de braço inclinada', 3, 12], ['Flexão de braço', 4, 10], ['Flexão Diamante', 3, 8], ['Mergulho no peito', 3, 10], ['Tríceps Coice', 3, 12], ['Extensão de tríceps em pé', 3, 15]], 'Flexão de braço'),
  P('forca', 'Força com halteres', 'Padrões básicos de força com carga: agachar, empurrar, puxar e estabilizar.', 'Avançado', 'Corpo todo', 'Halteres', 60, [['Agachamento goblet', 4, 10], ['Agachamento búlgaro com peso', 3, 8], ['Remada alta com halteres', 3, 10], ['Desenvolvimento Arnold', 3, 10], ['Ponte de glúteos com peso', 3, 12], ['Abdominal Russo com Halteres', 3, 16]], 'Agachamento goblet'),
  P('mobilidade', 'Mobilidade e alongamento', 'Relaxamento ativo para dias de descanso e para destravar quadril e ombros.', 'Iniciante', 'Flexibilidade', 'Peso do corpo', 30, [['Alongamento da Borboleta', 1, '40s'], ['Alongamento do Sapo', 1, '40s'], ['Alongamento de Isquiotibiais em Pé', 1, '40s'], ['Alongamento do peito acima da cabeça', 1, '30s'], ['Alongamento Lateral de Tronco', 2, '30s'], ['Abraços de joelho', 1, '40s']], 'Alongamento da Borboleta'),
];
PROGRAMS.forEach((p) => {
  p.list = p.items.map(([q, sets, r]) => { const e = find(q); return e ? { e, sets, reps: typeof r === 'number' ? r : null, secs: typeof r === 'string' ? parseInt(r, 10) : null } : null; }).filter(Boolean);
  p.cover = (find(p.cover) || p.list[0].e);
  p.min = Math.round(p.list.reduce((a, it) => a + it.sets * ((it.secs || 40) + p.rest), 0) / 60);
  p.kcal = Math.round(p.list.reduce((a, it) => a + it.sets * (it.secs || 40) / 60 * it.e.kcalMin, 0) * S.profile.weight / 70);
});
const progById = Object.fromEntries(PROGRAMS.map((p) => [p.id, p]));
function programOfDay() {
  const g = S.profile.goal, d = new Date().getDay();
  const plan = g === 'emagrecer' ? ['mobilidade', 'hiit20', 'gluteos', 'corpo-todo', 'abdomen', 'hiit20', 'mobilidade'] : g === 'ganhar' ? ['mobilidade', 'superior', 'gluteos', 'peito', 'forca', 'abdomen', 'mobilidade'] : ['mobilidade', 'corpo-todo', 'abdomen', 'gluteos', 'superior', 'hiit20', 'mobilidade'];
  return progById[plan[d]];
}

/* ---------- ícones ---------- */
const IC = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  dumb: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
  food: '<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M7 3v6M17 21V3c-2 1-3.5 3.5-3.5 7v3h3.5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
};
const icon = (n, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}">${IC[n]}</svg>`;
const logo = '<div class="brand"><i><svg viewBox="0 0 24 24">' + IC.bolt + '</svg></i>Vigora</div>';

/* ---------- utilidades ---------- */
const mealsOf = (k) => S.meals[k] || (S.meals[k] = { cafe: [], almoco: [], lanche: [], jantar: [], ceia: [] });
const eaten = (k) => Object.values(S.meals[k] || {}).flat().reduce((a, f) => a + Math.round(f.k * f.q), 0);
const burned = (k) => S.logs.filter((l) => l.date === k).reduce((a, l) => a + l.kcal, 0);
const waterOf = (k) => S.water[k] || 0;
const fmtDate = (k) => { const [y, m, d] = k.split('-'); return `${d}/${m}`; };
const weekdayName = (d) => ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d];
const mmss = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
function streak() {
  const days = new Set(S.logs.map((l) => l.date));
  let n = 0; const d = new Date();
  if (!days.has(todayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 1800); }
function ring(pct, color, big, small) {
  const r = 40, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return `<div class="ring"><svg width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="${r}" fill="none" stroke="#262c35" stroke-width="9"/><circle cx="48" cy="48" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c * p} ${c}"/></svg><b>${big}<small class="mut" style="font-size:10px;display:block;margin-top:-2px">${small || ''}</small></b></div>`;
}
const tabsHtml = (cur) => `<nav class="tabs">${[['inicio', 'Início', 'home'], ['treinos', 'Treinos', 'dumb'], ['dieta', 'Dieta', 'food'], ['progresso', 'Progresso', 'chart'], ['perfil', 'Perfil', 'user']].map(([r, l, i]) => `<a href="#/${r}" class="${cur === r ? 'on' : ''}">${icon(i)}${l}</a>`).join('')}</nav>`;

/* ---------- telas ---------- */
const V = {};
V.onboarding = (step = 0) => {
  const p = S.profile;
  const steps = [
    () => `<div class="ob"><div style="margin:30px 0 26px">${logo}</div><h1 style="font-size:34px;line-height:1.1">Treine em casa.<br><span style="color:var(--acc)">Evolua todo dia.</span></h1><p class="mut" style="margin:12px 0 26px">${EX.length} exercícios com demonstração animada, programas prontos e controle de calorias com mais de ${FOODS.length.toLocaleString('pt-BR')} alimentos.</p>
      <label class="field"><span>Como podemos te chamar?</span><input id="f-name" value="${p.name}" placeholder="Seu nome" autocomplete="off"></label>
      <div class="grid2"><label class="field"><span>Idade</span><input id="f-age" type="number" value="${p.age}"></label><label class="field"><span>Sexo</span><select id="f-sex"><option value="m" ${p.sex === 'm' ? 'selected' : ''}>Masculino</option><option value="f" ${p.sex === 'f' ? 'selected' : ''}>Feminino</option></select></label>
      <label class="field"><span>Peso (kg)</span><input id="f-w" type="number" step="0.1" value="${p.weight}"></label><label class="field"><span>Altura (cm)</span><input id="f-h" type="number" value="${p.height}"></label></div>
      <div style="flex:1"></div><button class="btn" data-act="ob" data-v="1">Continuar</button></div>`,
    () => `<div class="ob"><div style="margin:20px 0">${logo}</div><h1>Qual é o seu objetivo?</h1><p class="mut" style="margin-bottom:18px">Usamos isso para calcular sua meta de calorias e sugerir treinos.</p>
      <div class="opts">${[['emagrecer', 'Emagrecer', 'Déficit calórico moderado + HIIT'], ['ganhar', 'Ganhar massa', 'Superávit leve + treinos de força'], ['saude', 'Manter a forma', 'Equilíbrio entre força e cardio']].map(([v, t, s]) => `<button class="opt ${p.goal === v ? 'on' : ''}" data-act="pick" data-k="goal" data-v="${v}">${t}<small>${s}</small></button>`).join('')}</div>
      <h2>Seu nível</h2><div class="opts">${[['Iniciante', 'Estou começando ou voltando agora'], ['Intermediário', 'Treino de forma regular'], ['Avançado', 'Já treino há mais de 1 ano']].map(([v, s]) => `<button class="opt ${p.level === v ? 'on' : ''}" data-act="pick" data-k="level" data-v="${v}">${v}<small>${s}</small></button>`).join('')}</div>
      <div style="flex:1;min-height:20px"></div><div class="row"><button class="btn ghost" style="width:90px" data-act="ob" data-v="0">Voltar</button><button class="btn" data-act="ob" data-v="2">Continuar</button></div></div>`,
    () => { const m = metas(); return `<div class="ob"><div style="margin:20px 0">${logo}</div><h1>Quantos dias por semana?</h1><p class="mut" style="margin-bottom:18px">Seja realista: constância vale mais que intensidade.</p>
      <div class="chips" style="flex-wrap:wrap;margin:0;padding:0">${[2, 3, 4, 5, 6].map((d) => `<button class="chip ${p.days === d ? 'on' : ''}" style="padding:14px 22px;font-size:17px" data-act="pick" data-k="days" data-v="${d}">${d}x</button>`).join('')}</div>
      <div class="card" style="margin-top:26px"><p class="mut sm" style="text-transform:uppercase;letter-spacing:.6px;font-weight:700">Seu plano diário</p>
      <div class="grid2" style="margin-top:12px"><div><div style="font-size:30px;font-weight:800;color:var(--acc)">${m.kcal}</div><span class="mut sm">kcal por dia</span></div><div><div style="font-size:30px;font-weight:800;color:var(--blue)">${(m.water / 1000).toFixed(2).replace('.', ',')} L</div><span class="mut sm">de água por dia</span></div></div></div>
      <div style="flex:1;min-height:20px"></div><div class="row"><button class="btn ghost" style="width:90px" data-act="ob" data-v="1">Voltar</button><button class="btn" data-act="finish">Começar a treinar</button></div></div>`; },
  ];
  return `<div class="screen" style="padding-bottom:30px">${steps[step]()}</div>`;
};

V.inicio = () => {
  const p = S.profile, m = metas(), k = todayKey(), pr = programOfDay();
  const done = S.logs.some((l) => l.date === k);
  const e = eaten(k), b = burned(k), w = waterOf(k);
  const wk = []; const base = new Date(); base.setDate(base.getDate() - base.getDay());
  for (let i = 0; i < 7; i++) { const d = new Date(base); d.setDate(base.getDate() + i); const kk = todayKey(d); wk.push(`<div class="day ${S.logs.some((l) => l.date === kk) ? 'on' : ''} ${kk === k ? 'today' : ''}"><i>${S.logs.some((l) => l.date === kk) ? '✓' : d.getDate()}</i>${DAYS[i]}</div>`); }
  const hr = new Date().getHours();
  return `<div class="screen"><div class="hdr"><div class="hello"><small>${hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite'},</small><h1>${p.name || 'Atleta'} 👋</h1></div><div class="avatar">${(p.name || 'A')[0].toUpperCase()}</div></div>
  <div class="hero"><img src="${img(pr.cover)}" alt=""><span class="tag">${done ? 'Treino de hoje concluído' : 'Treino de hoje'}</span><h3>${pr.name}</h3><div class="meta"><span class="pill acc">⏱ ${pr.min} min</span><span class="pill acc">🔥 ${pr.kcal} kcal</span></div><button class="btn" data-go="#/programa/${pr.id}">${done ? 'Treinar de novo' : 'Começar agora'}</button></div>
  <h2>Sua semana <span class="pill or">🔥 ${streak()} ${streak() === 1 ? 'dia' : 'dias'} seguidos</span></h2><div class="card"><div class="week">${wk.join('')}</div></div>
  <h2>Hoje</h2>
  <div class="card row" data-go="#/dieta">${ring(e / m.kcal, e > m.kcal ? '#ff4d6d' : '#c6ff3d', e, 'kcal')}<div class="grow"><h3>Calorias</h3><p class="mut sm" style="margin:2px 0 10px">Meta ${m.kcal} kcal • restam ${Math.max(0, m.kcal - e + b)}</p><div class="bar"><i style="width:${Math.min(100, e / m.kcal * 100)}%"></i></div><p class="mut sm" style="margin-top:8px">🔥 ${b} kcal queimadas no treino</p></div></div>
  <div class="grid2" style="margin-top:12px"><div class="card stat"><div class="l">💧 Água</div><div class="v">${(w / 1000).toFixed(2).replace('.', ',')} L</div><div class="bar" style="margin:8px 0 12px"><i style="width:${Math.min(100, w / m.water * 100)}%;background:var(--blue)"></i></div><button class="btn ghost sm" style="width:100%" data-act="water">+ 250 ml</button></div>
  <div class="card stat" data-go="#/progresso"><div class="l">⚖️ Peso atual</div><div class="v">${(S.weights.length ? S.weights[S.weights.length - 1].kg : p.weight).toString().replace('.', ',')} kg</div><p class="mut sm" style="margin-top:8px">${S.weights.length > 1 ? (() => { const d = S.weights[S.weights.length - 1].kg - S.weights[0].kg; return (d > 0 ? '+' : '') + d.toFixed(1).replace('.', ',') + ' kg desde o início'; })() : 'Registre seu peso na aba Progresso'}</p></div></div>
  <h2>Programas para você <a href="#/treinos">Ver todos</a></h2>
  <div class="hscroll">${PROGRAMS.filter((x) => x.id !== pr.id).slice(0, 6).map((x) => `<div class="pcard" data-go="#/programa/${x.id}"><img src="${img(x.cover)}" alt=""><div><h3 style="font-size:15px">${x.name}</h3><p class="mut sm" style="margin-top:4px">${x.min} min • ${x.level}</p></div></div>`).join('')}</div></div>${tabsHtml('inicio')}`;
};

V.treinos = () => {
  const q = V._q || '', g = V._g || 'Todos';
  const groups = ['Todos', ...new Set(EX.map((e) => e.group))];
  const list = EX.filter((e) => (g === 'Todos' || e.group === g) && (!q || e.n.includes(norm(q))));
  return `<div class="screen"><h1>Treinos</h1><p class="mut">Programas prontos e biblioteca de exercícios.</p>
  <h2>Programas</h2>${PROGRAMS.map((p) => `<div class="card prog" data-go="#/programa/${p.id}"><img class="th" src="${img(p.cover)}" alt=""><div class="grow"><h3>${p.name}</h3><p class="mut sm" style="margin:3px 0 8px">${p.focus} • ${p.equip}</p><span class="pill">⏱ ${p.min} min</span> <span class="pill ${p.level === 'Avançado' ? 'or' : 'acc'}">${p.level}</span></div></div>`).join('')}
  <h2>Biblioteca <span class="mut sm">${list.length} exercícios</span></h2>
  <div class="search">${icon('search')}<input id="q" placeholder="Buscar exercício" value="${q}"></div>
  <div class="chips">${groups.map((x) => `<button class="chip ${g === x ? 'on' : ''}" data-act="grp" data-v="${x}">${x}</button>`).join('')}</div>
  <div style="margin-top:14px" id="exlist">${list.slice(0, 40).map(exRow).join('')}${list.length > 40 ? `<p class="mut sm" style="text-align:center;padding:10px">Use a busca ou os filtros para ver os outros ${list.length - 40} exercícios.</p>` : ''}</div></div>${tabsHtml('treinos')}`;
};
const exRow = (e) => `<div class="exr" data-go="#/ex/${e.id}"><img class="th" loading="lazy" src="${img(e)}" alt=""><div class="grow"><h3>${e.name}</h3><p class="mut sm" style="margin-top:3px">${e.group} • ${e.equip}</p></div><span class="pill ${e.level === 'Avançado' ? 'or' : ''}">${e.level}</span></div>`;

V.ex = (id) => {
  const e = byId[id]; if (!e) return V.treinos();
  const fav = S.fav.includes(e.id);
  return `<div class="screen"><a class="back" href="javascript:history.back()">${icon('back')} Voltar</a><div class="exhero"><img src="${img(e)}" alt="${e.name}"></div>
  <div class="row sp"><h1 style="font-size:22px">${e.name}</h1><button class="pill ${fav ? 'acc' : ''}" data-act="fav" data-v="${e.id}">${fav ? '★ Salvo' : '☆ Salvar'}</button></div>
  <div class="row" style="margin:12px 0 4px;flex-wrap:wrap"><span class="pill acc">${e.group}</span><span class="pill">${e.equip}</span><span class="pill ${e.level === 'Avançado' ? 'or' : ''}">${e.level}</span><span class="pill">~${e.kcalMin} kcal/min</span></div>
  <h2>Músculos trabalhados</h2><p>${e.muscles}</p>
  <h2>Como executar</h2><ol class="steps">${e.cues.map((c) => `<li>${c}</li>`).join('')}</ol>
  <h2>Mais de ${e.group}</h2>${EX.filter((x) => x.group === e.group && x.id !== e.id).slice(0, 4).map(exRow).join('')}</div>${tabsHtml('treinos')}`;
};

V.programa = (id) => {
  const p = progById[id]; if (!p) return V.treinos();
  return `<div class="screen" style="padding-top:0"><div style="margin:0 -18px 0;position:relative;background:#fff"><img src="${img(p.cover)}" style="width:100%;height:290px;object-fit:contain;display:block" alt=""><a href="javascript:history.back()" style="position:absolute;top:calc(var(--safe-t) + 14px);left:14px;width:40px;height:40px;border-radius:50%;background:rgba(11,13,16,.85);display:grid;place-items:center;color:#fff">${icon('back').replace('<svg', '<svg style="width:22px;height:22px;stroke:#fff;fill:none;stroke-width:2.4"')}</a></div>
  <h1 style="margin-top:18px">${p.name}</h1><p class="mut" style="margin:6px 0 14px">${p.desc}</p>
  <div class="grid2" style="grid-template-columns:repeat(3,1fr)"><div class="card stat"><div class="v">${p.min}</div><div class="l">minutos</div></div><div class="card stat"><div class="v">${p.kcal}</div><div class="l">kcal est.</div></div><div class="card stat"><div class="v">${p.list.length}</div><div class="l">exercícios</div></div></div>
  <h2>Exercícios</h2>${p.list.map((it) => `<div class="exr" data-go="#/ex/${it.e.id}"><img class="th" src="${img(it.e)}" alt=""><div class="grow"><h3>${it.e.name}</h3><p class="mut sm" style="margin-top:3px">${it.sets} séries × ${it.secs ? it.secs + 's' : it.reps + ' repetições'}</p></div></div>`).join('')}
  <div style="position:fixed;left:0;right:0;bottom:0;max-width:520px;margin:auto;padding:14px 18px calc(var(--safe-b) + 14px);background:linear-gradient(transparent,var(--bg) 40%)"><button class="btn" data-act="play" data-v="${p.id}">Iniciar treino</button></div></div>`;
};

/* ----- player ----- */
let PL = null;
function buildSteps(p) {
  const st = [];
  p.list.forEach((it, i) => { for (let s = 1; s <= it.sets; s++) st.push({ it, s, i }); });
  return st;
}
function startPlayer(id) {
  const p = progById[id];
  PL = { p, steps: buildSteps(p), i: 0, phase: 'ready', t0: Date.now(), left: 0, end: 0, timer: null, activeSecs: 0 };
  location.hash = '#/player';
}
V.player = () => {
  if (!PL) return V.treinos();
  const { p, steps, i } = PL, st = steps[i], it = st.it;
  const segs = steps.map((_, k) => `<i class="${k < i ? 'd' : k === i ? 'c' : ''}"></i>`).join('');
  let center;
  if (PL.phase === 'rest') {
    const nx = steps[i + 1] || null;
    center = `<div class="rest"><span class="pill acc">DESCANSO</span><div class="big" id="clock">${mmss(PL.left)}</div>${nx ? `<div class="row" style="background:var(--card);padding:10px 14px;border-radius:18px"><img src="${img(nx.it.e)}" style="width:64px;height:64px;border-radius:12px;background:#fff;object-fit:contain" alt=""><div><p class="mut sm">A seguir</p><h3 style="font-size:15px">${nx.it.e.name}</h3></div></div>` : ''}<div class="row" style="width:100%"><button class="btn ghost" data-act="rest+">+15s</button><button class="btn" data-act="skiprest">Pular</button></div></div>`;
  } else center = '';
  const isTimed = !!it.secs;
  return `<div class="player"><div class="row sp" style="margin-bottom:12px"><button data-act="quit" class="pill">✕ Sair</button><span class="mut sm" style="font-weight:600">${p.name}</span><span class="pill acc">${i + 1}/${steps.length}</span></div><div class="seg">${segs}</div>
  <div class="vis"><div class="box"><img src="${img(it.e)}" alt=""></div></div>
  <div style="padding:16px 0 10px"><h1 style="font-size:23px;text-align:center">${it.e.name}</h1><p class="mut" style="text-align:center;margin-top:4px">Série ${st.s} de ${it.sets} • ${isTimed ? it.secs + ' segundos' : it.reps + ' repetições'}</p>
  ${isTimed ? `<div class="big" id="clock" style="margin-top:6px">${PL.phase === 'run' ? mmss(PL.left) : mmss(it.secs)}</div>` : `<div class="big" style="margin-top:4px;color:var(--acc)">${it.reps}<small style="font-size:20px" class="mut"> reps</small></div>`}</div>
  ${PL.phase === 'ready' && isTimed ? '<button class="btn" data-act="startset">▶ Iniciar série</button>' : isTimed ? '<button class="btn ghost" data-act="finishset">Concluir agora</button>' : '<button class="btn" data-act="finishset">✓ Concluir série</button>'}${center}</div>`;
};
function tick() {
  if (!PL || !PL.end) return;
  const left = Math.max(0, Math.ceil((PL.end - Date.now()) / 1000));
  PL.left = left;
  const c = document.getElementById('clock'); if (c) c.textContent = mmss(left);
  if (left <= 0) { PL.end = 0; PL.phase === 'rest' ? nextStep() : finishSet(); }
}
setInterval(tick, 250);
function startSet() { const it = PL.steps[PL.i].it; PL.phase = 'run'; PL.left = it.secs; PL.end = Date.now() + it.secs * 1000; render(); }
function finishSet() {
  const it = PL.steps[PL.i].it;
  PL.activeSecs += it.secs ? it.secs : Math.max(30, it.reps * 3);
  if (PL.i >= PL.steps.length - 1) return finishWorkout();
  const nextIsNewEx = PL.steps[PL.i + 1].it !== it;
  const r = PL.p.rest + (nextIsNewEx ? 10 : 0);
  PL.phase = 'rest'; PL.left = r; PL.end = Date.now() + r * 1000; render();
}
function nextStep() { PL.i++; PL.phase = 'ready'; PL.end = 0; render(); }
function finishWorkout() {
  const total = Math.round((Date.now() - PL.t0) / 1000);
  const kcal = Math.round(PL.p.list.reduce((a, it) => a + it.sets * (it.secs || Math.max(30, it.reps * 3)) / 60 * it.e.kcalMin, 0) * S.profile.weight / 70);
  const log = { date: todayKey(), progId: PL.p.id, name: PL.p.name, secs: Math.max(total, PL.activeSecs), kcal, sets: PL.steps.length };
  S.logs.push(log); save(); PL.done = log; PL.end = 0; location.replace('#/resumo');
}
V.resumo = () => {
  const l = (PL && PL.done) || S.logs[S.logs.length - 1]; if (!l) return V.inicio();
  return `<div class="screen"><div class="sum"><div class="trophy">🏆</div><h1 style="font-size:30px;margin-top:8px">Treino concluído!</h1><p class="mut" style="margin-top:6px">${l.name}</p>
  <div class="stats"><div><b>${Math.round(l.secs / 60)}</b><span class="mut sm">minutos</span></div><div><b>${l.kcal}</b><span class="mut sm">kcal</span></div><div><b>${l.sets}</b><span class="mut sm">séries</span></div></div>
  <div class="card row sp"><div style="text-align:left"><p class="mut sm">Sequência atual</p><h3 style="font-size:22px">🔥 ${streak()} ${streak() === 1 ? 'dia' : 'dias'}</h3></div><span class="pill acc">Continue assim!</span></div>
  <button class="btn" style="margin-top:22px" data-go="#/inicio">Voltar ao início</button></div></div>`;
};

/* ----- dieta ----- */
V.dieta = () => {
  const k = todayKey(), m = metas(), e = eaten(k), b = burned(k), md = mealsOf(k), w = waterOf(k);
  return `<div class="screen"><h1>Alimentação</h1><p class="mut">Hoje, ${weekdayName(new Date().getDay())} • ${fmtDate(k)}</p>
  <div class="card row" style="margin-top:16px">${ring(e / (m.kcal + b), e > m.kcal + b ? '#ff4d6d' : '#c6ff3d', e, 'consumidas')}<div class="grow"><div class="row sp"><span class="mut sm">Meta</span><b>${m.kcal}</b></div><div class="row sp" style="margin:6px 0"><span class="mut sm">Treino</span><b style="color:var(--acc2)">+${b}</b></div><div class="row sp"><span class="mut sm">Restam</span><b style="color:var(--acc)">${Math.max(0, m.kcal + b - e)}</b></div></div></div>
  <div class="card row sp" style="margin-top:12px"><div><h3>💧 ${(w / 1000).toFixed(2).replace('.', ',')} / ${(m.water / 1000).toFixed(2).replace('.', ',')} L</h3><div class="bar" style="margin-top:8px;width:170px"><i style="width:${Math.min(100, w / m.water * 100)}%;background:var(--blue)"></i></div></div><button class="btn ghost sm" data-act="water">+ 250 ml</button></div>
  <h2>Refeições</h2>${MEALS.map(([key, name, em]) => { const items = md[key], tot = items.reduce((a, f) => a + Math.round(f.k * f.q), 0); return `<div class="card meal"><div class="hd"><div><h3>${em} ${name}</h3><span class="mut sm">${tot} kcal</span></div><button class="add" data-go="#/add/${key}">+</button></div>${items.map((f, idx) => `<div class="food"><div class="grow"><b>${f.n}</b><p class="mut sm">${f.q !== 1 ? f.q + '× ' : ''}${f.p}</p></div><div style="text-align:right"><b>${Math.round(f.k * f.q)}</b><p class="mut sm">kcal</p><button class="mut sm" data-act="rmfood" data-m="${key}" data-i="${idx}">remover</button></div></div>`).join('')}</div>`; }).join('')}</div>${tabsHtml('dieta')}`;
};
V.add = (meal) => {
  const q = V._fq || '', c = V._fc || 'Todos';
  const nq = norm(q);
  const res = FOODS.filter((f) => (c === 'Todos' || f.c === c) && (!nq || norm(f.n + ' ' + f.p).includes(nq)));
  const name = (MEALS.find((x) => x[0] === meal) || [])[1] || 'Refeição';
  return `<div class="screen"><a class="back" href="javascript:history.back()">${icon('back')} ${name}</a><h1>Adicionar alimento</h1>
  <div class="search">${icon('search')}<input id="fq" placeholder="Buscar entre ${FOODS.length.toLocaleString('pt-BR')} alimentos" value="${q}"></div>
  <div class="chips">${['Todos', ...FOOD_CATS].map((x) => `<button class="chip ${c === x ? 'on' : ''}" data-act="fcat" data-v="${x}">${x}</button>`).join('')}</div>
  <p class="mut sm" style="margin:14px 0 4px">${res.length.toLocaleString('pt-BR')} resultados</p>
  <div id="flist">${res.slice(0, 50).map((f) => `<div class="food" data-act="pickfood" data-meal="${meal}" data-idx="${FOODS.indexOf(f)}"><div class="grow"><b>${f.n}</b><p class="mut sm">${f.p} • ${f.c}</p></div><div class="row"><b>${f.k} kcal</b><span class="add" style="width:32px;height:32px;font-size:20px">+</span></div></div>`).join('')}</div></div>`;
};
function foodSheet(meal, idx) {
  const f = FOODS[idx]; let q = 1;
  const el = document.createElement('div'); el.className = 'modal';
  const paint = () => { el.innerHTML = `<div class="sheet"><h3 style="font-size:19px">${f.n}</h3><p class="mut sm">${f.p} • ${f.c}</p><div class="qty"><button data-q="-">−</button><b>${q}×</b><button data-q="+">+</button></div><p style="text-align:center;margin-bottom:16px"><b style="font-size:26px;color:var(--acc)">${Math.round(f.k * q)}</b> <span class="mut">kcal</span></p><button class="btn" data-ok>Adicionar à refeição</button><button class="btn ghost" style="margin-top:10px" data-no>Cancelar</button></div>`; };
  paint(); document.body.appendChild(el);
  el.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-q],[data-ok],[data-no]');
    if (ev.target === el || (t && t.hasAttribute('data-no'))) return el.remove();
    if (!t) return;
    if (t.dataset.q) { q = Math.max(0.5, q + (t.dataset.q === '+' ? 0.5 : -0.5)); paint(); }
    if (t.hasAttribute('data-ok')) { mealsOf(todayKey())[meal].push({ n: f.n, p: f.p, k: f.k, q }); save(); el.remove(); toast('Adicionado: ' + Math.round(f.k * q) + ' kcal'); history.back(); }
  });
}

/* ----- progresso ----- */
function lineChart(pts) {
  if (pts.length < 2) return '<p class="mut sm" style="padding:20px 0;text-align:center">Registre seu peso pelo menos duas vezes para ver o gráfico.</p>';
  const W = 340, H = 140, pad = 14, ys = pts.map((p) => p.kg), mn = Math.min(...ys) - 0.6, mx = Math.max(...ys) + 0.6;
  const X = (i) => pad + i * (W - 2 * pad) / (pts.length - 1), Y = (v) => H - pad - (v - mn) / (mx - mn) * (H - 2 * pad);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.kg).toFixed(1)).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c6ff3d" stop-opacity=".35"/><stop offset="1" stop-color="#c6ff3d" stop-opacity="0"/></linearGradient></defs><path d="${d} L${X(pts.length - 1)} ${H - pad} L${pad} ${H - pad}Z" fill="url(#g)"/><path d="${d}" fill="none" stroke="#c6ff3d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.kg)}" r="${i === pts.length - 1 ? 5 : 3}" fill="#0b0d10" stroke="#c6ff3d" stroke-width="2"/>`).join('')}</svg>`;
}
function badges() {
  const days = new Set(S.logs.map((l) => l.date)).size, tk = S.logs.reduce((a, l) => a + l.kcal, 0), mealDays = Object.keys(S.meals).length;
  const waterDays = Object.values(S.water).filter((v) => v >= metas().water).length;
  return [['🎯', 'Primeiro treino', 'Complete 1 treino', S.logs.length >= 1], ['🔥', 'Sequência de 3 dias', 'Treine 3 dias seguidos', streak() >= 3 || maxStreak() >= 3], ['💪', 'Dez treinos', 'Complete 10 treinos', S.logs.length >= 10], ['⚡', '1.000 kcal queimadas', 'Some 1.000 kcal em treinos', tk >= 1000], ['🥗', 'Diário em dia', 'Registre refeições em 5 dias', mealDays >= 5], ['💧', 'Hidratação', 'Bata a meta de água 3 vezes', waterDays >= 3], ['🏅', 'Mês de foco', 'Treine em 20 dias diferentes', days >= 20]];
}
function maxStreak() { const ds = [...new Set(S.logs.map((l) => l.date))].sort(); let best = 0, cur = 0, prev = null; ds.forEach((d) => { const t = new Date(d + 'T12:00').getTime(); cur = prev && t - prev === 864e5 ? cur + 1 : 1; prev = t; best = Math.max(best, cur); }); return best; }
V.progresso = () => {
  const mins = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = todayKey(d); mins.push({ l: DAYS[d.getDay()], v: Math.round(S.logs.filter((x) => x.date === k).reduce((a, x) => a + x.secs, 0) / 60) }); }
  const mx = Math.max(10, ...mins.map((x) => x.v));
  const totalMin = Math.round(S.logs.reduce((a, l) => a + l.secs, 0) / 60), totalK = S.logs.reduce((a, l) => a + l.kcal, 0);
  const bs = badges();
  return `<div class="screen"><h1>Progresso</h1><p class="mut">Sua evolução em números.</p>
  <div class="grid2" style="margin-top:16px"><div class="card stat"><div class="l">Treinos</div><div class="v">${S.logs.length}</div></div><div class="card stat"><div class="l">Minutos ativos</div><div class="v">${totalMin}</div></div><div class="card stat"><div class="l">Kcal queimadas</div><div class="v">${totalK.toLocaleString('pt-BR')}</div></div><div class="card stat"><div class="l">Melhor sequência</div><div class="v">${maxStreak()} d</div></div></div>
  <h2>Minutos por dia</h2><div class="card"><div style="display:flex;align-items:flex-end;justify-content:space-between;height:130px;gap:8px">${mins.map((x) => `<div style="flex:1;text-align:center"><div style="height:${Math.max(4, x.v / mx * 100)}px;background:${x.v ? 'var(--acc)' : 'var(--card2)'};border-radius:8px;margin-bottom:6px"></div><span class="mut sm">${x.l}</span><div class="sm" style="font-weight:700">${x.v || ''}</div></div>`).join('')}</div></div>
  <h2>Peso <button class="btn sm" style="height:34px" data-act="addweight">+ Registrar</button></h2><div class="card">${lineChart(S.weights.slice(-12))}</div>
  <h2>Conquistas <span class="mut sm">${bs.filter((b) => b[3]).length}/${bs.length}</span></h2>${bs.map(([ic, t, d, ok]) => `<div class="badge ${ok ? '' : 'lock'}"><div class="ic">${ic}</div><div class="grow"><h3 style="font-size:15px">${t}</h3><p class="mut sm">${d}</p></div>${ok ? '<span class="pill acc">✓</span>' : ''}</div>`).join('')}
  <h2>Histórico</h2>${S.logs.slice(-8).reverse().map((l) => `<div class="exr" style="padding:14px"><div class="grow"><h3>${l.name}</h3><p class="mut sm" style="margin-top:3px">${fmtDate(l.date)} • ${Math.round(l.secs / 60)} min • ${l.sets} séries</p></div><span class="pill or">🔥 ${l.kcal}</span></div>`).join('') || '<p class="mut">Nenhum treino registrado ainda.</p>'}</div>${tabsHtml('progresso')}`;
};

V.perfil = () => {
  const p = S.profile, m = metas(), imc = p.weight / Math.pow(p.height / 100, 2);
  return `<div class="screen"><div class="row" style="margin-bottom:20px"><div class="avatar" style="width:64px;height:64px;font-size:26px">${(p.name || 'A')[0].toUpperCase()}</div><div><h1 style="font-size:24px">${p.name || 'Atleta'}</h1><p class="mut">${p.level} • ${p.days}x por semana</p></div></div>
  <div class="grid2"><div class="card stat"><div class="l">IMC</div><div class="v">${imc.toFixed(1).replace('.', ',')}</div></div><div class="card stat"><div class="l">Metabolismo basal</div><div class="v">${m.bmr}<small class="mut sm"> kcal</small></div></div><div class="card stat"><div class="l">Meta diária</div><div class="v">${m.kcal}<small class="mut sm"> kcal</small></div></div><div class="card stat"><div class="l">Meta de água</div><div class="v">${(m.water / 1000).toFixed(2).replace('.', ',')}<small class="mut sm"> L</small></div></div></div>
  <h2>Seus dados</h2>
  <label class="field"><span>Nome</span><input id="p-name" value="${p.name}"></label>
  <div class="grid2"><label class="field"><span>Peso (kg)</span><input id="p-w" type="number" step="0.1" value="${p.weight}"></label><label class="field"><span>Altura (cm)</span><input id="p-h" type="number" value="${p.height}"></label><label class="field"><span>Idade</span><input id="p-age" type="number" value="${p.age}"></label><label class="field"><span>Dias por semana</span><select id="p-days">${[2, 3, 4, 5, 6].map((d) => `<option ${p.days === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label></div>
  <label class="field"><span>Objetivo</span><select id="p-goal"><option value="emagrecer" ${p.goal === 'emagrecer' ? 'selected' : ''}>Emagrecer</option><option value="ganhar" ${p.goal === 'ganhar' ? 'selected' : ''}>Ganhar massa</option><option value="saude" ${p.goal === 'saude' ? 'selected' : ''}>Manter a forma</option></select></label>
  <button class="btn" data-act="saveprofile">Salvar alterações</button>
  <h2>Exercícios salvos</h2>${S.fav.map((id) => byId[id]).filter(Boolean).map(exRow).join('') || '<p class="mut">Toque em “Salvar” em qualquer exercício para encontrá-lo aqui.</p>'}
  <button class="btn danger" style="margin-top:26px" data-act="reset">Apagar todos os meus dados</button>
  <p class="mut sm" style="text-align:center;margin-top:18px">Vigora 1.0 • Seus dados ficam apenas neste aparelho.</p></div>${tabsHtml('perfil')}`;
};

/* ---------- dados de exemplo para capturas (somente por rota #/exemplo) ---------- */
function seedSample() {
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  S = { onboarded: true, profile: { name: 'Lucas', sex: 'm', age: 29, weight: 82.4, height: 178, goal: 'emagrecer', level: 'Intermediário', days: 4, equip: 'corpo' }, logs: [], meals: {}, water: {}, weights: [], fav: [find('Agachamento Livre').id, find('Burpee').id, find('Flexão Diamante').id] };
  const order = ['hiit20', 'gluteos', 'corpo-todo', 'abdomen', 'superior', 'peito', 'hiit20'];
  for (let i = 27, n = 0; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); const k = todayKey(d);
    if (i % 7 === 3 || i % 7 === 6 || (i === 0 && false)) continue;
    const p = progById[order[n++ % order.length]];
    S.logs.push({ date: k, progId: p.id, name: p.name, secs: (p.min + Math.round(rnd() * 4)) * 60, kcal: p.kcal + Math.round(rnd() * 30), sets: p.list.reduce((a, x) => a + x.sets, 0) });
  }
  [86.1, 85.4, 84.6, 84.1, 83.5, 83.0, 82.4].forEach((kg, j) => { const d = new Date(); d.setDate(d.getDate() - (6 - j) * 4); S.weights.push({ date: todayKey(d), kg }); });
  const day = (k, a) => { S.meals[k] = a; };
  const F = (cat, n, q = 1) => { const f = FOODS.find((x) => x.c === cat && x.n.toLowerCase().includes(n.toLowerCase())); return f ? { n: f.n, p: f.p, k: f.k, q } : null; };
  for (let i = 1; i <= 6; i++) { const d = new Date(); d.setDate(d.getDate() - i); S.water[todayKey(d)] = 2000 + Math.round(rnd() * 1000); S.meals[todayKey(d)] = { cafe: [F('Café da manhã', 'Pão Francês (unidade')].filter(Boolean), almoco: [F('Almoço', 'Arroz Branco (cozido')].filter(Boolean), lanche: [], jantar: [], ceia: [] }; }
  S.meals[todayKey()] = { cafe: [F('Café da manhã', 'Pão de Forma Integral', 2), F('Frutas', 'Banana')].filter(Boolean), almoco: [F('Almoço', 'Arroz Integral'), F('Almoço', 'Feijão Carioca'), F('Almoço', 'Frango grelhado') || F('Almoço', 'Filé de Frango')].filter(Boolean), lanche: [F('Frutas', 'Maçã')].filter(Boolean), jantar: [], ceia: [] };
  S.water[todayKey()] = 1250; save();
}

/* ---------- roteador ---------- */
let route = '';
function render() {
  const h = (location.hash || '#/').replace(/^#\/?/, '');
  const [r, a] = h.split('/');
  if (r === 'exemplo') { seedSample(); location.replace('#/' + (a || 'inicio')); return; }
  if (!S.onboarded && r !== 'onboarding') { location.replace('#/onboarding'); return; }
  let html;
  switch (r) {
    case 'onboarding': html = V.onboarding(V._ob || 0); break;
    case 'treinos': html = V.treinos(); break;
    case 'programa': html = V.programa(a); break;
    case 'ex': html = V.ex(+a); break;
    case 'player': html = V.player(); break;
    case 'resumo': html = V.resumo(); break;
    case 'dieta': html = V.dieta(); break;
    case 'add': html = V.add(a); break;
    case 'progresso': html = V.progresso(); break;
    case 'perfil': html = V.perfil(); break;
    default: html = V.inicio();
  }
  const keep = route === h ? ($app.querySelector('.screen') || {}).scrollTop : 0;
  $app.innerHTML = html; route = h;
  const sc = $app.querySelector('.screen'); if (sc && keep) sc.scrollTop = keep;
  const qi = document.getElementById('q'); if (qi) { qi.oninput = () => { V._q = qi.value; const l = document.getElementById('exlist'); const f = EX.filter((e) => (!V._g || V._g === 'Todos' || e.group === V._g) && (!qi.value || e.n.includes(norm(qi.value)))); l.innerHTML = f.slice(0, 40).map(exRow).join(''); }; }
  const fi = document.getElementById('fq'); if (fi) { fi.oninput = () => { V._fq = fi.value; filterFoods(a); }; }
}
function filterFoods(meal) {
  const nq = norm(V._fq || ''), c = V._fc || 'Todos';
  const res = FOODS.filter((f) => (c === 'Todos' || f.c === c) && (!nq || norm(f.n + ' ' + f.p).includes(nq)));
  document.getElementById('flist').innerHTML = res.slice(0, 50).map((f) => `<div class="food" data-act="pickfood" data-meal="${meal}" data-idx="${FOODS.indexOf(f)}"><div class="grow"><b>${f.n}</b><p class="mut sm">${f.p} • ${f.c}</p></div><div class="row"><b>${f.k} kcal</b><span class="add" style="width:32px;height:32px;font-size:20px">+</span></div></div>`).join('');
  document.querySelector('.mut.sm[style*="margin:14px"]').textContent = res.length.toLocaleString('pt-BR') + ' resultados';
}
window.addEventListener('hashchange', render);

document.addEventListener('click', (ev) => {
  const go = ev.target.closest('[data-go]'); if (go && !ev.target.closest('[data-act]')) { location.hash = go.dataset.go; return; }
  const t = ev.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act, v = t.dataset.v, p = S.profile;
  switch (a) {
    case 'ob': { p.name = (document.getElementById('f-name') || {}).value ?? p.name; const rd = (id, f) => { const el = document.getElementById(id); if (el && el.value) p[f] = f === 'sex' ? el.value : parseFloat(el.value); }; rd('f-age', 'age'); rd('f-sex', 'sex'); rd('f-w', 'weight'); rd('f-h', 'height'); V._ob = +v; render(); break; }
    case 'pick': { p[t.dataset.k] = t.dataset.k === 'days' ? +v : v; render(); break; }
    case 'finish': S.onboarded = true; S.weights = [{ date: todayKey(), kg: p.weight }]; save(); location.hash = '#/inicio'; break;
    case 'water': { const k = todayKey(); S.water[k] = waterOf(k) + 250; save(); toast('+250 ml de água 💧'); render(); break; }
    case 'grp': V._g = v; render(); break;
    case 'fcat': V._fc = v; render(); break;
    case 'fav': { const i = S.fav.indexOf(+v); i >= 0 ? S.fav.splice(i, 1) : S.fav.push(+v); save(); render(); break; }
    case 'play': startPlayer(v); break;
    case 'startset': startSet(); break;
    case 'finishset': PL.end = 0; finishSet(); break;
    case 'skiprest': PL.end = 0; nextStep(); break;
    case 'rest+': PL.end += 15000; PL.left += 15; tick(); break;
    case 'quit': if (confirm('Sair do treino? O progresso desta sessão não será salvo.')) { PL = null; history.back(); } break;
    case 'pickfood': foodSheet(t.dataset.meal, +t.dataset.idx); break;
    case 'rmfood': { mealsOf(todayKey())[t.dataset.m].splice(+t.dataset.i, 1); save(); render(); break; }
    case 'addweight': { const x = prompt('Seu peso hoje (kg):', S.weights.length ? S.weights[S.weights.length - 1].kg : p.weight); const kg = parseFloat(String(x).replace(',', '.')); if (kg > 20 && kg < 400) { const k = todayKey(); const ex = S.weights.find((w) => w.date === k); ex ? (ex.kg = kg) : S.weights.push({ date: k, kg }); p.weight = kg; save(); render(); } break; }
    case 'saveprofile': { const g = (id) => document.getElementById(id).value; p.name = g('p-name'); p.weight = parseFloat(g('p-w')) || p.weight; p.height = parseFloat(g('p-h')) || p.height; p.age = parseInt(g('p-age'), 10) || p.age; p.days = parseInt(g('p-days'), 10); p.goal = g('p-goal'); save(); PROGRAMS.forEach((x) => { x.kcal = Math.round(x.list.reduce((s, it) => s + it.sets * (it.secs || 40) / 60 * it.e.kcalMin, 0) * p.weight / 70); }); toast('Perfil atualizado'); render(); break; }
    case 'reset': if (confirm('Apagar todos os dados do aplicativo?')) { localStorage.removeItem('vigora.v1'); location.hash = ''; location.reload(); } break;
  }
});

window.appBack = window.vigoraBack = function () { const h = location.hash; if (/^#\/(inicio|treinos|dieta|progresso|perfil|onboarding)?$/.test(h) || h === '') return false; history.back(); return true; };
if (!location.hash) location.hash = '#/inicio';
render();
})();
