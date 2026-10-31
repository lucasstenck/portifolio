/* Lance Certo — cliente web (SPA sem dependências). */
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dt = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
let ME = null, MATCHES = [], PREV = {}, FLASH = {}, SLIP = [], MODE = 'single', STAKE = 10, SLIPOPEN = false, EXP = new Set(), LEAGUE = 'all';
const MK = { '1X2': { name: 'Resultado final', picks: { 1: 'Casa', X: 'Empate', 2: 'Fora' } }, DC: { name: 'Dupla chance', picks: { '1X': 'Casa/Empate', '12': 'Casa/Fora', X2: 'Empate/Fora' } }, OU25: { name: 'Total de gols', picks: { over: '+2,5', under: '−2,5' } }, BTTS: { name: 'Ambos marcam', picks: { yes: 'Sim', no: 'Não' } } };

async function api(method, url, body) {
  try {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, ...j };
  } catch (e) { return { ok: false, status: 0, error: 'Sem conexão com o servidor.' }; }
}
function toast(t, err) { const el = document.createElement('div'); el.className = 'toast' + (err ? ' err' : ''); el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 3200); }
const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
const crest = (n) => `<span class="crest" style="background:hsl(${hue(n)} 55% 38%)">${esc(n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span>`;

/* ---------- navegação ---------- */
const NAV = [['esportes', 'Esportes', '⚽'], ['ao-vivo', 'Ao vivo', ''], ['cassino', 'Cassino', '🎰'], ['apostas', 'Minhas apostas', '🧾'], ['carteira', 'Carteira', '👛']];
function chrome() {
  const r = (location.hash.replace('#/', '') || 'esportes').split('/')[0];
  const cur = r === 'crash' || r === 'roleta' || r === 'dados' || r === 'slots' ? 'cassino' : r;
  $('#nav').innerHTML = NAV.map(([k, l]) => `<a href="#/${k}" class="${cur === k ? 'on' : ''}">${k === 'ao-vivo' ? '<i class="live-dot"></i>' : ''}${l}</a>`).join('');
  $('#mnav').innerHTML = [['esportes', 'Esportes', '⚽'], ['ao-vivo', 'Ao vivo', '🔴'], ['cassino', 'Cassino', '🎰'], ['apostas', 'Apostas', '🧾'], ['carteira', 'Carteira', '👛']].map(([k, l, e]) => `<a href="#/${k}" class="${cur === k ? 'on' : ''}"><span>${e}</span>${l}</a>`).join('');
  $('#right').innerHTML = ME ? `<div class="bal"><div><small>SALDO VIRTUAL</small><span id="balv">${money(ME.balance)}</span></div></div><a class="btn dep" href="#/carteira">Depositar</a><button class="btn ghost sm" id="menu" title="${esc(ME.email)}">${esc(ME.name.split(' ')[0])} ▾</button>` : `<button class="btn ghost" id="bl">Entrar</button><button class="btn" id="br">Cadastre-se</button>`;
  if (ME) $('#menu').onclick = () => { if (confirm('Sair da conta?')) api('POST', '/api/logout').then(() => { ME = null; SLIP = []; chrome(); route(); }); }; else { $('#bl').onclick = () => authModal('login'); $('#br').onclick = () => authModal('register'); }
}
async function refreshMe() { const r = await api('GET', '/api/me'); ME = r.user || null; return r; }
function setBal(b) { if (ME) { ME.balance = b; const e = $('#balv'); if (e) e.textContent = money(b); } }

/* ---------- autenticação ---------- */
function authModal(mode) {
  const el = document.createElement('div'); el.className = 'modal';
  const reg = mode === 'register';
  el.innerHTML = `<div class="dlg"><div style="text-align:right;margin:-8px -6px 0"><button data-x style="font-size:24px;color:var(--mut)">×</button></div><h2>${reg ? 'Crie sua conta' : 'Entrar'}</h2><p class="mut sm" style="margin:0 0 16px">${reg ? 'É grátis e leva 1 minuto. Você começa com saldo virtual de demonstração.' : 'Bem-vindo de volta!'}</p>
  <form id="af" novalidate>${reg ? `<div class="f" data-k="name"><label>Nome completo</label><input class="inp" name="name" autocomplete="name"><div class="er"></div></div>` : ''}
  <div class="f" data-k="email"><label>E-mail</label><input class="inp" name="email" type="email" autocomplete="email"><div class="er"></div></div>
  ${reg ? `<div class="r2"><div class="f" data-k="cpf"><label>CPF</label><input class="inp" name="cpf" inputmode="numeric" placeholder="000.000.000-00" maxlength="14"><div class="er"></div></div><div class="f" data-k="birth"><label>Nascimento</label><input class="inp" name="birth" type="date"><div class="er"></div></div></div>` : ''}
  <div class="f" data-k="password"><label>Senha ${reg ? '(mín. 8 caracteres)' : ''}</label><input class="inp" name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}"><div class="er"></div></div>
  ${reg ? `<label class="chk"><input type="checkbox" name="terms"><span>Declaro ter <b>18 anos ou mais</b> e aceito os Termos de Uso e a Política de Privacidade. Entendo que este é um ambiente de demonstração com saldo virtual.</span></label><div class="f bad" data-k="terms" style="margin-top:-8px;display:none"><div class="er"></div></div>` : ''}
  <button class="btn block" id="asub">${reg ? 'Criar conta' : 'Entrar'}</button></form>
  <p class="sm mut" style="text-align:center;margin:14px 0 0">${reg ? 'Já tem conta? <a href="#" data-sw style="color:var(--g)">Entrar</a>' : 'Novo por aqui? <a href="#" data-sw style="color:var(--g)">Cadastre-se</a>'}</p></div>`;
  document.body.appendChild(el);
  const cpf = $('[name=cpf]', el); if (cpf) cpf.oninput = () => { const v = cpf.value.replace(/\D/g, '').slice(0, 11); cpf.value = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); };
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-x]')) el.remove(); if (e.target.closest('[data-sw]')) { e.preventDefault(); el.remove(); authModal(reg ? 'login' : 'register'); } });
  $('#af', el).onsubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target), b = Object.fromEntries(fd); if (reg) b.terms = !!fd.get('terms');
    $$('.f', el).forEach((f) => f.classList.remove('bad')); const btn = $('#asub', el); btn.disabled = true;
    const r = await api('POST', reg ? '/api/register' : '/api/login', b); btn.disabled = false;
    if (!r.ok) { if (r.errors) Object.entries(r.errors).forEach(([k, m]) => { const f = $(`[data-k=${k}]`, el); if (f) { f.classList.add('bad'); f.style.display = ''; $('.er', f).textContent = m; } }); else toast(r.error || 'Erro', true); return; }
    ME = r.user; el.remove(); chrome(); route(); toast(reg ? 'Conta criada! Adicione saldo virtual na carteira.' : 'Login realizado!');
  };
}
const needLogin = () => { if (!ME) { authModal('login'); return true; } return false; };

/* ---------- esportes ---------- */
async function loadMatches() { const r = await api('GET', '/api/matches'); if (!r.matches) return; for (const m of r.matches) { const old = PREV[m.id]; if (old) for (const [mk, o] of Object.entries(m.odds)) for (const [p, v] of Object.entries(o)) { const ov = old.odds[mk]?.[p]; if (ov && v && ov !== v) FLASH[`${m.id}|${mk}|${p}`] = v > ov ? 'up' : 'dn'; } PREV[m.id] = m; } MATCHES = r.matches; setTimeout(() => (FLASH = {}), 1800); }
const inSlip = (id, mk, p) => SLIP.find((s) => s.matchId === id && s.market === mk && s.pick === p);
function oddBtn(m, mk, p) {
  const v = m.odds[mk][p], sel = inSlip(m.id, mk, p), f = FLASH[`${m.id}|${mk}|${p}`] || '';
  return `<button class="o ${sel ? 'on' : ''} ${f}" ${v ? '' : 'disabled'} data-m="${m.id}" data-mk="${mk}" data-p="${p}"><small>${esc(MK[mk].picks[p])}</small><b>${v ? v.toFixed(2) : '🔒'}</b></button>`;
}
function matchCard(m) {
  const live = m.status === 'live', fin = m.status === 'finished', ex = EXP.has(m.id);
  const last = m.events.filter((e) => e.type === 'goal').slice(-1)[0];
  const secs = Math.max(0, Math.round((m.startAt - Date.now()) / 1000));
  const status = live ? `<span class="badge"><i class="live-dot"></i>AO VIVO ${m.minute}'</span>` : fin ? '<span class="badge fin">ENCERRADO</span>' : `<span class="badge up">${secs > 90 ? Math.round(secs / 60) + ' min' : secs + ' s'}</span>`;
  return `<div class="match ${live ? 'live' : ''}"><div class="hd"><span>🏆 ${esc(m.leagueName)}</span>${status}</div><div class="bd"><div class="teams"><div class="t">${crest(m.home)}${esc(m.home)}<span class="sc">${live || fin ? m.hg : ''}</span></div><div class="t">${crest(m.away)}${esc(m.away)}<span class="sc">${live || fin ? m.ag : ''}</span></div>${live && last ? `<div class="ev">⚽ Gol do ${last.team === 'home' ? esc(m.home) : esc(m.away)} aos ${last.min}'</div>` : ''}</div>
  ${fin ? '<div class="mut sm" style="text-align:center">Mercados liquidados</div>' : `<div class="odds">${['1', 'X', '2'].map((p) => oddBtn(m, '1X2', p)).join('')}</div>`}</div>
  ${fin ? '' : `<div class="exp"><span>${m.open ? '' : '🔒 Mercados suspensos'}</span><button data-exp="${m.id}">${ex ? 'Menos mercados ▲' : '+3 mercados ▼'}</button></div>${ex ? `<div class="more">${['DC', 'OU25', 'BTTS'].map((mk) => `<div class="mk"><h4>${MK[mk].name}</h4><div class="odds ${Object.keys(MK[mk].picks).length === 2 ? 'two' : ''}">${Object.keys(MK[mk].picks).map((p) => oddBtn(m, mk, p)).join('')}</div></div>`).join('')}</div>` : ''}`}</div>`;
}
function sportsView(onlyLive) {
  const leagues = [...new Set(MATCHES.map((m) => m.league))];
  const L = MATCHES.filter((m) => LEAGUE === 'all' || m.league === LEAGUE);
  const live = L.filter((m) => m.status === 'live'), up = L.filter((m) => m.status === 'upcoming').sort((a, b) => a.startAt - b.startAt), fin = L.filter((m) => m.status === 'finished').slice(-4).reverse();
  return `${onlyLive ? '' : `<div class="hero"><h1>Aposte ao vivo com odds que se atualizam a cada gol</h1><p>Partidas simuladas em tempo acelerado, com precificação em tempo real, múltiplas, cash-out e liquidação automática.</p>${ME ? '' : '<button class="btn" id="hr">Criar conta grátis</button>'}</div>`}
  <div class="chips" style="margin-bottom:14px"><button class="chip ${LEAGUE === 'all' ? 'on' : ''}" data-lg="all">Todas as ligas</button>${leagues.map((l) => `<button class="chip ${LEAGUE === l ? 'on' : ''}" data-lg="${l}">${esc(MATCHES.find((m) => m.league === l).leagueName)}</button>`).join('')}</div>
  <div id="mlist">${live.length ? `<div class="sec" style="margin-top:6px"><h2><i class="live-dot" style="display:inline-block;margin-right:8px"></i>Ao vivo agora</h2><span class="mut sm">${live.length} partidas</span></div>${live.map(matchCard).join('')}` : ''}
  ${onlyLive ? '' : `<div class="sec"><h2>Próximas partidas</h2><span class="mut sm">${up.length}</span></div>${up.slice(0, 8).map(matchCard).join('')}${fin.length ? `<div class="sec"><h2>Resultados recentes</h2></div>${fin.map(matchCard).join('')}` : ''}`}</div>`;
}
function slipHtml() {
  const odds = SLIP.map((s) => { const m = MATCHES.find((x) => x.id === s.matchId); return m ? { s, m, cur: m.odds[s.market][s.pick] } : null; }).filter(Boolean);
  const stakeC = Math.round(STAKE * 100), total = MODE === 'multi' ? odds.reduce((a, x) => a * (x.cur || x.s.odds), 1) : 0;
  const ret = MODE === 'multi' ? stakeC * total : odds.reduce((a, x) => a + stakeC * (x.cur || x.s.odds), 0), cost = MODE === 'multi' ? stakeC : stakeC * odds.length;
  return `<div class="panel pad slip ${SLIPOPEN ? 'open' : ''}" id="slip"><h3>Cupom de apostas <span class="cnt">${SLIP.length}</span>${SLIPOPEN ? '<button data-closeslip style="font-size:22px;color:var(--mut)">×</button>' : ''}</h3>
  ${SLIP.length ? `<div class="seg" style="margin-top:12px"><button data-mode="single" class="${MODE === 'single' ? 'on' : ''}">Simples</button><button data-mode="multi" class="${MODE === 'multi' ? 'on' : ''}" ${SLIP.length < 2 ? 'disabled' : ''}>Múltipla</button></div>
  ${odds.map(({ s, m, cur }) => `<div class="sel"><button class="x" data-rm="${m.id}|${s.market}|${s.pick}">×</button><div class="mk2">${esc(m.home)} x ${esc(m.away)} ${m.status === 'live' ? `• <span class="red">${m.minute}'</span>` : ''}</div><b class="od ${cur && Math.abs(cur - s.odds) > 0.001 ? (cur > s.odds ? 'g' : 'red') : ''}">${cur ? cur.toFixed(2) : '🔒'}</b><div class="b">${esc(MK[s.market].picks[s.pick])}</div><div class="mk2">${MK[s.market].name}</div></div>`).join('')}
  <div style="position:relative;margin-top:12px"><span class="mut" style="position:absolute;left:14px;top:12px;font-weight:700">R$</span><input class="inp" id="stake" inputmode="decimal" style="padding-left:42px" value="${String(STAKE).replace('.', ',')}"></div>
  <div class="qk">${[5, 10, 25, 50].map((v) => `<button data-q="${v}">+${v}</button>`).join('')}</div>
  <div class="kv"><span>${MODE === 'multi' ? 'Odd total' : 'Seleções'}</span><b>${MODE === 'multi' ? total.toFixed(2) : odds.length}</b></div><div class="kv"><span>Total apostado</span><b>${money(cost)}</b></div><div class="kv"><span>Retorno possível</span><b class="g">${money(Math.round(ret))}</b></div>
  <button class="btn block" style="margin-top:12px" id="place" ${odds.some((o) => !o.cur) ? 'disabled' : ''}>${ME ? 'Fazer aposta' : 'Entrar para apostar'}</button>` : '<div class="empty">Clique em uma odd para adicionar ao cupom.<br><span class="sm">Em múltiplas, só uma seleção por partida.</span></div>'}</div>`;
}
function drawSlip() {
  const w = $('#slipwrap'); if (w) w.innerHTML = slipHtml();
  const f = $('#fab'); f.hidden = !SLIP.length; $('#fabn').textContent = SLIP.length;
}
async function placeBet() {
  if (needLogin()) return;
  await loadMatches();
  const build = () => SLIP.map((s) => { const cur = MATCHES.find((m) => m.id === s.matchId)?.odds[s.market][s.pick]; return { matchId: s.matchId, market: s.market, pick: s.pick, odds: cur || s.odds }; });
  let r = await api('POST', '/api/bets', { selections: build(), stake: STAKE, type: MODE });
  if (r.status === 409 && r.code === 'ODDS') { await loadMatches(); r = await api('POST', '/api/bets', { selections: build(), stake: STAKE, type: MODE }); }
  if (r.status === 409 && r.code === 'ODDS') { const s = SLIP.find((x) => x.matchId === r.matchId && x.market === r.market && x.pick === r.pick); if (s) s.odds = r.odds; drawSlip(); return toast('As odds mudaram. Confira e confirme novamente.', true); }
  if (!r.ok) return toast(r.error || 'Não foi possível apostar.', true);
  setBal(r.balance); SLIP = []; SLIPOPEN = false; drawSlip(); toast(`Aposta realizada! ${r.bets.length > 1 ? r.bets.length + ' apostas' : 'Boa sorte!'} 🍀`);
}
let pollT = null;
async function sportsRoute(onlyLive) {
  $('#app').innerHTML = `<div class="wrap"><main id="main"></main><aside id="slipwrap"></aside></div>`;
  const paint = () => { const cur = (location.hash.replace('#/', '') || 'esportes'); if (cur !== (onlyLive ? 'ao-vivo' : 'esportes') && !(cur === '' && !onlyLive)) return; const m = $('#main'); if (!m) return; m.innerHTML = sportsView(onlyLive); drawSlip(); const b = $('#hr'); if (b) b.onclick = () => authModal('register'); };
  await loadMatches(); paint();
  clearInterval(pollT); pollT = setInterval(async () => { if (document.hidden) return; const a = document.activeElement; const typing = a && a.id === 'stake'; await loadMatches(); const m = $('#main'); if (!m) return clearInterval(pollT); const sy = scrollY; m.innerHTML = sportsView(onlyLive); if (!typing) drawSlip(); scrollTo(0, sy); if (typing) { const el = $('#stake'); } }, 1500);
}
document.addEventListener('click', (e) => {
  const o = e.target.closest('.o'); if (o && !o.disabled) { const id = +o.dataset.m, mk = o.dataset.mk, p = o.dataset.p, ex = inSlip(id, mk, p); const m = MATCHES.find((x) => x.id === id);
    if (ex) SLIP = SLIP.filter((s) => s !== ex); else { if (MODE === 'multi') SLIP = SLIP.filter((s) => s.matchId !== id); else SLIP = SLIP.filter((s) => !(s.matchId === id && s.market === mk)); SLIP.push({ matchId: id, market: mk, pick: p, odds: m.odds[mk][p] }); }
    if (SLIP.length < 2) MODE = 'single'; drawSlip(); $$('.o').forEach((b) => b.classList.toggle('on', !!inSlip(+b.dataset.m, b.dataset.mk, b.dataset.p))); return; }
  const x = e.target.closest('[data-exp]'); if (x) { const id = +x.dataset.exp; EXP.has(id) ? EXP.delete(id) : EXP.add(id); const m = $('#main'); m.innerHTML = sportsView(location.hash.includes('ao-vivo')); return; }
  const lg = e.target.closest('[data-lg]'); if (lg) { LEAGUE = lg.dataset.lg; $('#main').innerHTML = sportsView(location.hash.includes('ao-vivo')); return; }
  const rm = e.target.closest('[data-rm]'); if (rm) { const [id, mk, p] = rm.dataset.rm.split('|'); SLIP = SLIP.filter((s) => !(s.matchId === +id && s.market === mk && s.pick === p)); if (SLIP.length < 2) MODE = 'single'; drawSlip(); $$('.o').forEach((b) => b.classList.toggle('on', !!inSlip(+b.dataset.m, b.dataset.mk, b.dataset.p))); return; }
  const md = e.target.closest('[data-mode]'); if (md && !md.disabled) { MODE = md.dataset.mode; if (MODE === 'multi') { const seen = new Set(); SLIP = SLIP.filter((s) => !seen.has(s.matchId) && seen.add(s.matchId)); } drawSlip(); return; }
  const q = e.target.closest('[data-q]'); if (q) { STAKE = Math.round((STAKE + +q.dataset.q) * 100) / 100; drawSlip(); return; }
  if (e.target.closest('#place')) return placeBet();
  if (e.target.closest('#fab')) { SLIPOPEN = true; drawSlip(); return; }
  if (e.target.closest('[data-closeslip]')) { SLIPOPEN = false; drawSlip(); }
});
document.addEventListener('input', (e) => { if (e.target.id === 'stake') { const v = parseFloat(e.target.value.replace(',', '.')); STAKE = v > 0 ? v : 0; const sel = $('#slip'); if (!sel) return; const stakeC = Math.round(STAKE * 100), odds = SLIP.map((s) => MATCHES.find((x) => x.id === s.matchId)?.odds[s.market][s.pick] || s.odds); const ret = MODE === 'multi' ? stakeC * odds.reduce((a, b) => a * b, 1) : odds.reduce((a, o) => a + stakeC * o, 0), cost = MODE === 'multi' ? stakeC : stakeC * odds.length; const k = $$('.kv b', sel); if (k.length >= 3) { k[1].textContent = money(cost); k[2].textContent = money(Math.round(ret)); } } });

/* ---------- minhas apostas ---------- */
let BTAB = 'open', betsT = null;
async function betsRoute() {
  if (!ME) { $('#app').innerHTML = `<div class="wrap full"><div class="panel empty">Faça login para ver suas apostas.<br><br><button class="btn" id="lg">Entrar</button></div></div>`; $('#lg').onclick = () => authModal('login'); return; }
  $('#app').innerHTML = `<div class="wrap full"><main id="bb"></main></div>`;
  const paint = async () => {
    const r = await api('GET', '/api/bets'); if (!r.bets || !$('#bb')) return clearInterval(betsT);
    const list = r.bets.filter((b) => (BTAB === 'open' ? b.status === 'open' : b.status !== 'open'));
    const stat = { open: r.bets.filter((b) => b.status === 'open').length, done: r.bets.length };
    $('#bb').innerHTML = `<h1 style="margin-bottom:14px">Minhas apostas</h1><div class="tabs"><button data-bt="open" class="${BTAB === 'open' ? 'on' : ''}">Em aberto (${stat.open})</button><button data-bt="done" class="${BTAB === 'done' ? 'on' : ''}">Encerradas</button></div>
    ${list.map((b) => `<div class="bet"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>${b.type === 'multi' ? 'Múltipla (' + b.legs.length + ')' : 'Simples'} <span class="mut sm">#${b.id} • ${dt(b.placedAt)}</span></b><span class="st ${b.status}">${{ open: 'EM ABERTO', won: 'GANHOU', lost: 'PERDEU', cashout: 'CASH-OUT' }[b.status]}</span></div>
    ${b.legs.map((l) => `<div class="leg"><div><b>${esc(MK[l.market].picks[l.pick])}</b> <span class="mut">${MK[l.market].name}</span><br><span class="mut sm">${esc(l.home)} x ${esc(l.away)}${l.live ? ' • ao vivo' : ''}</span></div><div style="text-align:right"><b>${l.odds.toFixed(2)}</b><br>${l.result === 'won' ? '<span class="g sm">✓ acertou</span>' : l.result === 'lost' ? '<span class="red sm">✗ errou</span>' : '<span class="mut sm">aguardando</span>'}</div></div>`).join('')}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:10px;border-top:1px solid var(--line)"><div><span class="mut sm">Apostado</span> <b>${money(b.stake)}</b> &nbsp; <span class="mut sm">Odd</span> <b>${b.totalOdds.toFixed(2)}</b></div><div style="text-align:right">${b.status === 'open' ? `<span class="mut sm">Retorno possível</span> <b class="g">${money(Math.round(b.stake * b.totalOdds))}</b>${b.cashout ? `<br><button class="btn gold sm" style="margin-top:6px" data-co="${b.id}" data-v="${b.cashout}">Cash-out ${money(b.cashout)}</button>` : ''}` : `<span class="mut sm">Retorno</span> <b class="${b.payout > 0 ? 'g' : ''}">${money(b.payout)}</b>`}</div></div></div>`).join('') || `<div class="panel empty">${BTAB === 'open' ? 'Nenhuma aposta em aberto.' : 'Nenhuma aposta encerrada ainda.'}<br><br><a class="btn" href="#/esportes">Ver partidas</a></div>`}`;
  };
  await paint(); clearInterval(betsT); betsT = setInterval(paint, 2500);
}
document.addEventListener('click', async (e) => {
  const bt = e.target.closest('[data-bt]'); if (bt) { BTAB = bt.dataset.bt; return betsRoute(); }
  const co = e.target.closest('[data-co]'); if (co) { const r = await api('POST', '/api/bets/cashout', { id: +co.dataset.co, expected: +co.dataset.v }); if (!r.ok) return toast(r.error + (r.cashout ? ` Novo valor: ${money(r.cashout)}` : ''), true); setBal(r.balance); toast(`Cash-out realizado: ${money(r.payout)}`); betsRoute(); }
});

/* ---------- carteira ---------- */
async function walletRoute() {
  if (!ME) { $('#app').innerHTML = `<div class="wrap full"><div class="panel empty">Faça login para acessar sua carteira.<br><br><button class="btn" id="lg">Entrar</button></div></div>`; $('#lg').onclick = () => authModal('login'); return; }
  const r = await api('GET', '/api/wallet'); setBal(r.balance);
  const TY = { deposit: ['Depósito', 'g'], withdraw: ['Saque', ''], bet: ['Aposta esportiva', ''], win: ['Prêmio', 'g'], cashout: ['Cash-out', 'g'], casino_bet: ['Aposta cassino', ''], casino_win: ['Prêmio cassino', 'g'], refund: ['Estorno', 'g'] };
  $('#app').innerHTML = `<div class="wrap"><main><h1 style="margin-bottom:14px">Carteira</h1>
  <div class="panel pad" style="background:linear-gradient(120deg,#102a22,#0d1822);border-color:#1c4636"><div class="mut sm">Saldo virtual disponível</div><div style="font-size:40px;font-weight:900">${money(r.balance)}</div><div class="mut sm">Depositado hoje ${money(r.depositedToday)} • limite diário ${money(r.limits.dailyDeposit || 500000)}</div></div>
  <div class="sec"><h2>Adicionar saldo virtual</h2></div><div class="panel pad"><div class="qk" style="grid-template-columns:repeat(5,1fr)">${[20, 50, 100, 250, 500].map((v) => `<button data-dep="${v}">R$ ${v}</button>`).join('')}</div><div style="display:flex;gap:10px"><input class="inp" id="depv" inputmode="decimal" placeholder="Outro valor (R$ 10 a R$ 5.000)"><button class="btn" id="depb">Depositar</button></div><p class="mut sm" style="margin:10px 0 0">Depósito instantâneo de demonstração (Pix simulado). Nenhuma cobrança real é feita.</p></div>
  <div class="sec"><h2>Solicitar saque</h2></div><div class="panel pad"><div class="r2"><input class="inp" id="wdv" inputmode="decimal" placeholder="Valor (mín. R$ 20)"><input class="inp" id="wdk" placeholder="Chave Pix"></div><button class="btn ghost" style="margin-top:10px" id="wdb">Solicitar saque</button>${r.withdrawals.length ? `<div style="margin-top:14px">${r.withdrawals.map((w) => `<div class="tx"><span>Saque #${w.id} • ${dt(w.at)}</span><span><b>${money(w.amount)}</b> <span class="st ${w.status === 'aprovado' ? 'won' : w.status === 'recusado' ? 'lost' : 'open'}">${w.status.toUpperCase()}</span></span></div>`).join('')}</div>` : ''}</div>
  <div class="sec"><h2>Extrato</h2></div><div class="panel pad">${r.tx.map((t) => `<div class="tx"><div><b>${(TY[t.type] || [t.type])[0]}</b><br><span class="mut sm">${esc(t.ref)} • ${dt(t.at)}</span></div><div style="text-align:right"><b class="${t.amount > 0 ? 'g' : ''}">${t.amount > 0 ? '+' : ''}${money(t.amount)}</b><br><span class="mut sm">saldo ${money(t.balance)}</span></div></div>`).join('') || '<div class="empty">Sem movimentações.</div>'}</div></main>
  <aside><div class="panel pad"><h3>🛡️ Jogo responsável</h3><p class="mut sm">Defina limites e pausas. Reduções valem na hora; aumentos só após 24 h.</p><a class="btn ghost block" href="#/responsavel" style="margin-top:10px">Configurar limites</a></div></aside></div>`;
  const dep = async (v) => { const x = await api('POST', '/api/deposit', { amount: v, method: 'pix' }); if (!x.ok) return toast(x.error, true); setBal(x.balance); toast(`Depósito de ${money(Math.round(v * 100))} confirmado`); walletRoute(); };
  $$('[data-dep]').forEach((b) => (b.onclick = () => dep(+b.dataset.dep))); $('#depb').onclick = () => dep(parseFloat($('#depv').value.replace(',', '.')) || 0);
  $('#wdb').onclick = async () => { const x = await api('POST', '/api/withdraw', { amount: parseFloat($('#wdv').value.replace(',', '.')) || 0, key: $('#wdk').value }); if (!x.ok) return toast(x.error, true); setBal(x.balance); toast('Saque solicitado. Aguardando aprovação.'); walletRoute(); };
}

/* ---------- jogo responsável ---------- */
async function responsibleRoute() {
  if (!ME) { $('#app').innerHTML = `<div class="wrap full"><div class="panel empty">Faça login para configurar seus limites.<br><br><button class="btn" id="lg">Entrar</button></div></div>`; $('#lg').onclick = () => authModal('login'); return; }
  await refreshMe(); const l = ME.limits || {}, t = (await api('GET', '/api/me')).today;
  const ex = ME.excludedUntil > Date.now();
  $('#app').innerHTML = `<div class="wrap"><main><h1>Jogo responsável</h1><p class="mut" style="margin:4px 0 16px">Ferramentas para manter o controle. Elas valem para esportes e cassino.</p>
  <div class="grid3" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px"><div class="panel pad"><div class="mut sm">Apostado hoje</div><div style="font-size:24px;font-weight:800">${money(t.staked)}</div></div><div class="panel pad"><div class="mut sm">Prêmios hoje</div><div style="font-size:24px;font-weight:800" class="g">${money(t.won)}</div></div><div class="panel pad"><div class="mut sm">Resultado do dia</div><div style="font-size:24px;font-weight:800" class="${t.won - t.staked >= 0 ? 'g' : 'red'}">${money(t.won - t.staked)}</div></div></div>
  <div class="panel pad"><h3>Limites diários</h3><div class="r2" style="margin-top:12px"><div class="f"><label>Limite de depósito (R$/dia)</label><input class="inp" id="ld" value="${l.dailyDeposit ? l.dailyDeposit / 100 : ''}" placeholder="5000"></div><div class="f"><label>Limite de perdas (R$/dia)</label><input class="inp" id="ll" value="${l.dailyLoss ? l.dailyLoss / 100 : ''}" placeholder="Sem limite"></div></div>${l.dailyDepositPending || l.dailyLossPending ? '<p class="gold sm">⏳ Há aumentos de limite aguardando a carência de 24 h.</p>' : ''}<button class="btn" id="lsave">Salvar limites</button></div>
  <div class="panel pad" style="margin-top:16px"><h3>Autoexclusão</h3><p class="mut sm">Bloqueia depósitos, apostas e jogos pelo período escolhido. Não pode ser desfeita antes do prazo.</p>${ex ? `<p class="red b">Conta bloqueada até ${new Date(ME.excludedUntil).toLocaleDateString('pt-BR')}.</p>` : `<div class="chips">${[[1, '24 horas'], [7, '7 dias'], [30, '30 dias'], [90, '90 dias'], [365, '1 ano']].map(([d, n]) => `<button class="chip" data-ex="${d}">${n}</button>`).join('')}</div>`}</div></main>
  <aside><div class="panel pad"><h3>Precisa de ajuda?</h3><p class="mut sm">Se o jogo deixou de ser diversão, procure apoio: CVV 188 (24 h, gratuito) ou os Jogadores Anônimos Brasil.</p></div></aside></div>`;
  $('#lsave').onclick = async () => { const v = (id) => { const x = $(id).value.trim(); return x === '' ? null : parseFloat(x.replace(',', '.')); }; const r = await api('POST', '/api/limits', { dailyDeposit: v('#ld'), dailyLoss: v('#ll') }); if (!r.ok) return toast(r.error, true); toast('Limites atualizados'); responsibleRoute(); };
  $$('[data-ex]').forEach((b) => (b.onclick = async () => { if (!confirm(`Confirmar autoexclusão por ${b.textContent}?`)) return; const r = await api('POST', '/api/selfexclude', { days: +b.dataset.ex }); if (!r.ok) return toast(r.error, true); toast('Autoexclusão ativada'); responsibleRoute(); }));
}

/* ---------- cassino ---------- */
async function casinoRoute() {
  const info = await api('GET', '/api/info'), lb = await api('GET', '/api/leaderboard');
  $('#app').innerHTML = `<div class="wrap full"><main><h1>Cassino</h1><p class="mut" style="margin:4px 0 16px">Todos os resultados são verificáveis (Provably Fair). Vantagem da casa publicada em cada jogo.</p>
  <div class="grid3">${[['crash', '🚀', 'Crash', 'Multiplicador ao vivo. Saque antes de estourar!', '#2a1747,#14101f', 'RTP 97%'], ['roleta', '🎡', 'Roleta Europeia', 'Uma zero. Pagamentos de 1:1 a 35:1.', '#10331f,#0d1822', 'RTP 97,3%'], ['dados', '🎲', 'Dados', 'Escolha o alvo e o risco. Você define a chance.', '#33200f,#131822', 'RTP 97%'], ['slots', '🍒', 'Slots Frutas', 'Três rolos, combinações de até 250x.', '#331019,#131822', 'RTP ' + (info.slotsRtp * 100).toFixed(1).replace('.', ',') + '%']].map(([k, e, n, d, g, r]) => `<a class="tile" href="#/${k}" style="background:linear-gradient(135deg,${g})"><span class="em">${e}</span><span class="badge up" style="align-self:flex-start;margin-bottom:auto">${r}</span><h3>${n}</h3><p>${d}</p></a>`).join('')}</div>
  <div class="sec"><h2>🏆 Maiores ganhos de hoje</h2></div><div class="panel pad">${lb.length ? lb.map((x, i) => `<div class="tx"><span><b>${i + 1}º</b> &nbsp;${esc(x.name)}</span><b class="g">${money(x.won)}</b></div>`).join('') : '<div class="empty">Ainda sem prêmios hoje. Seja o primeiro!</div>'}</div></main></div>`;
}
const fairBar = (f) => `<p class="mut sm" style="margin:8px 0 0">🔒 Hash da seed: <code>${esc(f.hash.slice(0, 16))}…</code> • nonce ${f.nonce} • <a href="#/fair" style="color:var(--g)">verificar</a></p>`;
const stakeBox = (id, v = 5) => `<div class="f"><label>Valor da aposta</label><div style="position:relative"><span class="mut" style="position:absolute;left:14px;top:12px;font-weight:700">R$</span><input class="inp" id="${id}" style="padding-left:42px" value="${v}" inputmode="decimal"></div></div><div class="qk"><button data-s="1">1</button><button data-s="5">5</button><button data-s="25">25</button><button data-s="100">100</button></div>`;
document.addEventListener('click', (e) => { const s = e.target.closest('[data-s]'); if (s) { const i = $('#gstake'); if (i) i.value = s.dataset.s; } });
const gstake = () => { const i = $('#gstake'); return i ? parseFloat((i.value || '0').replace(',', '.')) || 0 : 5; };

/* Crash */
let crashT = null, crashRAF = null, CS = null, OFF = 0;
async function crashRoute() {
  $('#app').innerHTML = `<div class="wrap full"><main><a class="mut" href="#/cassino">← Cassino</a><div class="game" style="margin-top:10px"><div><div class="stage" id="stage" style="height:430px"><canvas id="cv" style="width:100%;height:100%"></canvas><div id="cm" style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;pointer-events:none"></div></div><div class="hist" id="ch" style="margin-top:12px"></div></div>
  <div><div class="panel pad">${stakeBox('gstake')}<div class="f"><label>Saque automático em (x) — opcional</label><input class="inp" id="gauto" placeholder="Ex.: 2,00" inputmode="decimal"></div><button class="btn block" id="cbtn">Apostar</button><div id="cfair"></div></div><div class="panel" style="margin-top:14px"><div class="pad" style="padding-bottom:6px"><h3>Jogadores na rodada <span class="mut sm" id="cpn"></span></h3></div><div id="cpl" style="max-height:230px;overflow:auto"></div></div></div></div></main></div>`;
  const fair = await api('GET', '/api/fair'); if (fair.hash) $('#cfair').innerHTML = `<p class="mut sm" style="margin:8px 0 0">Hash da rodada visível acima do gráfico • <a href="#/fair" style="color:var(--g)">como verificar</a></p>`;
  const poll = async () => { const t0 = Date.now(), s = await api('GET', '/api/casino/crash'); if (!s.phase) return; OFF = s.now - (t0 + Date.now()) / 2; CS = s; if (s.balance != null) setBal(s.balance); if (!$('#cbtn')) return; ui(); };
  const ui = () => {
    const s = CS, mine = s.mine; $('#ch').innerHTML = '<span class="mut sm" style="padding:3px 0">Últimos:</span>' + s.history.map((h) => `<span class="${h.point >= 5 ? 'hi' : h.point >= 2 ? 'md' : ''}">${h.point.toFixed(2)}x</span>`).join('');
    $('#cpn').textContent = `(${s.players.length})`; $('#cpl').innerHTML = `<table>${s.players.map((p) => `<tr><td>${esc(p.name)}</td><td>${money(p.amount)}</td><td style="text-align:right" class="${p.cashed ? 'g' : p.lost ? 'red' : 'mut'}">${p.cashed ? p.cashed.toFixed(2) + 'x • ' + money(p.payout) : p.lost ? 'perdeu' : '—'}</td></tr>`).join('') || '<tr><td class="mut">Seja o primeiro a apostar nesta rodada.</td></tr>'}</table>`;
    const b = $('#cbtn'); if (s.phase === 'betting') { b.textContent = mine ? `Aposta feita: ${money(mine.amount)}` : 'Apostar'; b.disabled = !!mine; b.className = 'btn block'; } else if (s.phase === 'running' && mine && !mine.cashed && !mine.lost) { b.disabled = false; b.className = 'btn gold block'; } else { b.disabled = true; b.textContent = s.phase === 'running' ? 'Rodada em andamento' : 'Aguarde a próxima rodada'; b.className = 'btn block'; }
  };
  $('#cbtn').onclick = async () => { if (needLogin()) return; const s = CS; if (s.phase === 'betting') { const r = await api('POST', '/api/casino/crash/bet', { amount: gstake(), auto: parseFloat(($('#gauto').value || '').replace(',', '.')) || null }); if (!r.ok) return toast(r.error, true); setBal(r.balance); toast('Aposta registrada!'); } else { const r = await api('POST', '/api/casino/crash/cashout', {}); if (!r.ok) return toast(r.error, true); setBal(r.balance); toast(`Sacou ${r.mult.toFixed(2)}x = ${money(r.payout)} 🎉`); } poll(); };
  await poll(); clearInterval(crashT); crashT = setInterval(() => { if (!$('#cbtn')) { clearInterval(crashT); cancelAnimationFrame(crashRAF); return; } poll(); }, 600);
  const draw = () => {
    const cv = $('#cv'); if (!cv) return; const dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; } const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    const s = CS; if (!s) return (crashRAF = requestAnimationFrame(draw)); const now = Date.now() + OFF;
    const el = s.phase === 'running' ? (now - s.runStart) / 1000 : s.phase === 'crashed' ? Math.log(s.point) / 0.09 : 0, m = s.phase === 'running' ? Math.max(1, Math.floor(Math.exp(0.09 * el) * 100) / 100) : s.phase === 'crashed' ? s.point : 1;
    c.strokeStyle = '#1c2633'; c.lineWidth = 1; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(0, h * i / 5); c.lineTo(w, h * i / 5); c.stroke(); }
    const tmax = Math.max(8, el * 1.15), ymax = Math.max(2, m * 1.25), X = (t) => 40 + t / tmax * (w - 70), Y = (v) => h - 36 - (v - 1) / (ymax - 1) * (h - 80);
    if (s.phase !== 'betting') { c.beginPath(); for (let i = 0; i <= 80; i++) { const t = el * i / 80; i ? c.lineTo(X(t), Y(Math.exp(0.09 * t))) : c.moveTo(X(t), Y(1)); } c.strokeStyle = s.phase === 'crashed' ? '#ff4d5e' : '#19e68c'; c.lineWidth = 4; c.lineCap = 'round'; c.stroke(); const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, s.phase === 'crashed' ? 'rgba(255,77,94,.25)' : 'rgba(25,230,140,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.lineTo(X(el), h - 36); c.lineTo(X(0), h - 36); c.fillStyle = g; c.fill(); c.font = '34px serif'; c.fillText(s.phase === 'crashed' ? '💥' : '🚀', X(el) - 16, Y(m) + 10); }
    const cm = $('#cm'); if (cm) cm.innerHTML = s.phase === 'betting' ? `<div><div class="mut b" style="letter-spacing:.1em">PRÓXIMA RODADA EM</div><div class="mult">${Math.max(0, (s.startsAt - now) / 1000).toFixed(1)}s</div><div class="mut sm">Faça sua aposta • hash ${s.hash.slice(0, 14)}…</div></div>` : s.phase === 'running' ? `<div><div class="mult g">${m.toFixed(2)}x</div>${s.mine && !s.mine.cashed && !s.mine.lost ? `<div class="gold b">Retorno atual ${money(Math.floor(s.mine.amount * m))}</div>` : ''}</div>` : `<div><div class="mut b" style="letter-spacing:.1em;color:var(--red)">ESTOUROU EM</div><div class="mult red">${s.point.toFixed(2)}x</div>${s.mine ? (s.mine.cashed ? `<div class="g b">Você sacou ${s.mine.cashed.toFixed(2)}x • +${money(s.mine.payout)}</div>` : '<div class="red b">Você perdeu esta rodada</div>') : ''}</div>`;
    crashRAF = requestAnimationFrame(draw);
  };
  cancelAnimationFrame(crashRAF); draw();
}

/* Roleta */
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
let RBETS = [], CHIP = 5, RLAST = null;
function roulRoute() {
  const cell = (n) => { const a = RBETS.filter((b) => b.type === 'straight' && +b.value === n).reduce((s, b) => s + b.amount, 0); return `<button class="${n === 0 ? 'zero' : REDS.has(n) ? 'red' : 'blk'} ${a ? 'has' : ''}" data-a="${a}" data-rb="straight" data-rv="${n}">${n}</button>`; };
  const out = (t, v, l, cls = '') => { const a = RBETS.filter((b) => b.type === t && String(b.value) === String(v)).reduce((s, b) => s + b.amount, 0); return `<button class="${cls} ${a ? 'has' : ''}" data-a="${a}" data-rb="${t}" data-rv="${v}">${l}</button>`; };
  const nums = []; for (let r = 3; r >= 1; r--) for (let c = 0; c < 12; c++) nums.push(c * 3 + r);
  const tot = RBETS.reduce((s, b) => s + b.amount, 0);
  $('#app').innerHTML = `<div class="wrap full"><main><a class="mut" href="#/cassino">← Cassino</a><div class="game" style="margin-top:10px"><div class="stage pad" style="min-height:0"><div style="text-align:center;margin-bottom:16px"><div class="ball" id="ball" style="${RLAST ? `background:${RLAST.color === 'red' ? '#c4263c' : RLAST.color === 'green' ? '#0f7a43' : '#1d2530'}` : 'background:#1a2331'}">${RLAST ? RLAST.number : '?'}</div><div class="mut sm" id="rmsg" style="margin-top:8px">${RLAST ? (RLAST.returned ? `Você ganhou ${money(RLAST.returned)}` : 'Não foi dessa vez') : 'Faça suas apostas'}</div></div>
  <div class="rt">${cell(0)}${nums.map(cell).join('')}${[3, 2, 1].map((c) => out('column', c, '2:1', 'col')).join('')}</div>
  <div class="out3">${[1, 2, 3].map((d) => out('dozen', d, ['1ª dúzia', '2ª dúzia', '3ª dúzia'][d - 1])).join('')}${out('half', 'low', '1–18')}${out('parity', 'even', 'Par')}${out('color', 'red', '●', 'rr')}${out('color', 'black', '●', 'bb')}${out('parity', 'odd', 'Ímpar')}${out('half', 'high', '19–36')}</div></div>
  <div><div class="panel pad"><div class="f"><label>Valor da ficha</label><div class="chips">${[1, 5, 10, 25, 100].map((v) => `<button class="chip ${CHIP === v ? 'on' : ''}" data-chip="${v}">R$ ${v}</button>`).join('')}</div></div><div class="kv"><span>Total na mesa</span><b>${money(tot * 100)}</b></div><div class="kv"><span>Fichas</span><b>${RBETS.length}</b></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost" data-rclear>Limpar</button><button class="btn block" id="spin" ${tot ? '' : 'disabled'}>Girar</button></div><p class="mut sm" style="margin:10px 0 0">Toque nas casas para colocar fichas. Zero: a casa vence apostas externas.</p></div></div></div></main></div>`;
}
document.addEventListener('click', async (e) => {
  if (!location.hash.startsWith('#/roleta')) return;
  const bt = e.target.closest('[data-rb]'); if (bt) { RBETS.push({ type: bt.dataset.rb, value: bt.dataset.rv, amount: CHIP }); return roulRoute(); }
  const ch = e.target.closest('[data-chip]'); if (ch) { CHIP = +ch.dataset.chip; return roulRoute(); }
  if (e.target.closest('[data-rclear]')) { RBETS = []; return roulRoute(); }
  if (e.target.closest('#spin')) {
    if (needLogin()) return; const btn = $('#spin'); btn.disabled = true; const ball = $('#ball'); let i = 0; const spin = setInterval(() => { ball.textContent = Math.floor(Math.random() * 37); ball.style.background = '#1a2331'; if (++i > 200) clearInterval(spin); }, 70);
    const r = await api('POST', '/api/casino/roulette', { bets: RBETS.map((b) => ({ ...b, amount: b.amount })) });
    await new Promise((x) => setTimeout(x, 1400)); clearInterval(spin);
    if (!r.ok) { toast(r.error, true); return roulRoute(); }
    setBal(r.balance); RLAST = r; roulRoute(); toast(r.returned ? `Número ${r.number}! Você ganhou ${money(r.returned)}` : `Saiu ${r.number}. Não foi dessa vez.`, !r.returned);
  }
});

/* Dados */
let DT = 50, DOVER = true, DLAST = null;
function diceRoute() {
  const chance = DOVER ? 99.99 - DT : DT, mult = Math.floor(97 / chance * 100) / 100;
  $('#app').innerHTML = `<div class="wrap full"><main><a class="mut" href="#/cassino">← Cassino</a><div class="game" style="margin-top:10px"><div class="stage pad"><div style="text-align:center;margin-top:20px"><div class="mut b" style="letter-spacing:.1em">ÚLTIMO RESULTADO</div><div class="mult ${DLAST ? (DLAST.win ? 'g' : 'red') : ''}" id="dr">${DLAST ? DLAST.roll.toFixed(2) : '00.00'}</div><div class="sm ${DLAST && DLAST.win ? 'g' : 'mut'}" id="dm">${DLAST ? (DLAST.win ? 'Você ganhou ' + money(DLAST.payout) : 'Não foi dessa vez') : 'Escolha o alvo e role os dados'}</div></div>
  <div class="bigbar" id="bb" style="--p:${DOVER ? DT : 100 - DT}%;${DOVER ? 'background:linear-gradient(90deg,var(--red) ' + DT + '%,var(--g) ' + DT + '%)' : 'background:linear-gradient(90deg,var(--g) ' + DT + '%,var(--red) ' + DT + '%)'};--r:${DLAST ? DLAST.roll : 0}%"><i></i></div><div style="display:flex;justify-content:space-between" class="mut sm"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
  <input type="range" id="dt" min="2" max="98" step="0.5" value="${DT}" style="margin-top:22px"><div class="grid3" style="grid-template-columns:repeat(3,1fr);margin-top:18px"><div class="panel pad"><div class="mut sm">Alvo</div><b style="font-size:20px">${DT.toFixed(2)}</b></div><div class="panel pad"><div class="mut sm">Chance</div><b style="font-size:20px">${chance.toFixed(2)}%</b></div><div class="panel pad"><div class="mut sm">Multiplicador</div><b style="font-size:20px" class="g">${mult.toFixed(2)}x</b></div></div></div>
  <div><div class="panel pad"><div class="seg"><button data-dov="0" class="${!DOVER ? 'on' : ''}">Abaixo</button><button data-dov="1" class="${DOVER ? 'on' : ''}">Acima</button></div>${stakeBox('gstake')}<div class="kv"><span>Retorno possível</span><b class="g">${money(Math.floor(gstake() * 100 * mult) || Math.floor(500 * mult))}</b></div><button class="btn block" style="margin-top:12px" id="roll">Rolar dados</button><div id="dfair"></div></div></div></div></main></div>`;
  api('GET', '/api/fair').then((f) => { if (f.hash && $('#dfair')) $('#dfair').innerHTML = fairBar(f); });
  $('#dt').oninput = (e) => { DT = +e.target.value; diceRoute(); $('#dt').focus(); };
}
document.addEventListener('click', async (e) => {
  if (!location.hash.startsWith('#/dados')) return;
  const d = e.target.closest('[data-dov]'); if (d) { DOVER = d.dataset.dov === '1'; return diceRoute(); }
  if (e.target.closest('#roll')) { if (needLogin()) return; const r = await api('POST', '/api/casino/dice', { amount: gstake(), target: DT, over: DOVER }); if (!r.ok) return toast(r.error, true); setBal(r.balance); DLAST = r; diceRoute(); toast(r.win ? `Rolou ${r.roll.toFixed(2)} — você ganhou ${money(r.payout)}!` : `Rolou ${r.roll.toFixed(2)}. Não foi dessa vez.`, !r.win); }
});

/* Slots */
let SL = null;
function slotsRoute() {
  const sym = SL ? SL.reels.map((r) => r.e) : ['🍒', '🍋', '🔔'];
  $('#app').innerHTML = `<div class="wrap full"><main><a class="mut" href="#/cassino">← Cassino</a><div class="game" style="margin-top:10px"><div class="stage pad"><div style="text-align:center;margin-top:16px"><div class="mut b" style="letter-spacing:.1em">SLOTS FRUTAS</div></div><div class="reels">${sym.map((s) => `<div class="reel"><span>${s}</span></div>`).join('')}</div><div style="text-align:center;min-height:56px" id="sm">${SL ? (SL.payout ? `<div class="mult g" style="font-size:40px">+${money(SL.payout)}</div><div class="gold b">${SL.mult}x</div>` : '<div class="mut">Sem combinação. Tente de novo!</div>') : '<div class="mut">Alinhe 3 símbolos iguais ou 2 cerejas.</div>'}</div>
  <div class="panel pad" style="margin:14px"><h3 style="margin-bottom:8px">Tabela de pagamentos (×aposta)</h3><div class="grid3" style="grid-template-columns:repeat(3,1fr);gap:8px">${[['🍒🍒🍒', 8], ['🍋🍋🍋', 12], ['🔔🔔🔔', 25], ['🍇🍇🍇', 40], ['💎💎💎', 100], ['7️⃣7️⃣7️⃣', 250]].map(([s, v]) => `<div class="tx" style="border:0;padding:4px 0"><span>${s}</span><b class="gold">${v}x</b></div>`).join('')}</div><div class="tx" style="border:0;padding:4px 0"><span>🍒🍒 (duas cerejas)</span><b class="gold">1,1x</b></div></div></div>
  <div><div class="panel pad">${stakeBox('gstake')}<button class="btn block" id="spinsl">Girar</button><div id="sfair"></div></div></div></div></main></div>`;
  api('GET', '/api/fair').then((f) => { if (f.hash && $('#sfair')) $('#sfair').innerHTML = fairBar(f); });
}
document.addEventListener('click', async (e) => {
  if (!location.hash.startsWith('#/slots') || !e.target.closest('#spinsl')) return;
  if (needLogin()) return; const btn = $('#spinsl'); btn.disabled = true; $$('.reel').forEach((r) => r.classList.add('spin'));
  const r = await api('POST', '/api/casino/slots', { amount: gstake() }); await new Promise((x) => setTimeout(x, 900));
  if (!r.ok) { toast(r.error, true); return slotsRoute(); }
  setBal(r.balance); SL = r; slotsRoute(); if (r.payout) toast(`Ganhou ${money(r.payout)}! 🎉`); 
});

/* ---------- provably fair ---------- */
async function fairRoute() {
  const f = ME ? await api('GET', '/api/fair') : null;
  $('#app').innerHTML = `<div class="wrap"><main><h1>Provably Fair</h1><p class="mut" style="margin:4px 0 16px">Você não precisa confiar em nós: cada resultado pode ser conferido matematicamente.</p>
  <div class="panel pad"><h3>Como funciona</h3><ol class="mut" style="line-height:1.8;padding-left:20px"><li>Antes de você jogar, publicamos o <b>hash SHA-256</b> da nossa seed secreta (compromisso).</li><li>Cada resultado = HMAC-SHA256(<i>seed do servidor</i>, <i>"seed do cliente:nonce:i"</i>), convertido em número entre 0 e 1.</li><li>Ao girar a seed, revelamos a seed antiga. Você confere que o hash bate e recalcula todos os resultados.</li><li>No Crash, cada rodada tem seu próprio hash, revelado no estouro.</li></ol></div>
  ${f && f.hash ? `<div class="panel pad" style="margin-top:16px"><h3>Suas seeds</h3><div class="kv"><span>Hash da seed do servidor (ativa)</span><b style="font-size:12px;word-break:break-all">${f.hash}</b></div><div class="f" style="margin-top:12px"><label>Seed do cliente (você controla)</label><div style="display:flex;gap:8px"><input class="inp" id="fcs" value="${esc(f.clientSeed)}"><button class="btn ghost" id="fcsb">Salvar</button></div></div><div class="kv"><span>Nonce (apostas feitas)</span><b>${f.nonce}</b></div><button class="btn block" style="margin-top:12px" id="frot">Girar seed e revelar a anterior</button>${f.previous.length ? `<h3 style="margin-top:18px">Seeds reveladas</h3>${f.previous.map((p) => `<div class="tx"><div style="min-width:0"><span class="mut sm">Seed:</span> <code style="font-size:11.5px;word-break:break-all">${p.seed}</code><br><span class="mut sm">Cliente: ${esc(p.clientSeed)} • ${p.nonces} apostas</span></div></div>`).join('')}` : ''}</div>` : '<div class="panel pad" style="margin-top:16px"><p class="mut">Faça login para ver suas seeds.</p></div>'}
  <div class="panel pad" style="margin-top:16px"><h3>Verificador</h3><div class="r2" style="margin-top:10px"><div class="f"><label>Seed do servidor</label><input class="inp" id="vs"></div><div class="f"><label>Seed do cliente</label><input class="inp" id="vc"></div></div><div class="r2"><div class="f"><label>Nonce</label><input class="inp" id="vn" value="0"></div><div style="display:flex;align-items:end;margin-bottom:12px"><button class="btn block" id="vb">Verificar</button></div></div><div id="vr"></div></div></main></div>`;
  if (f && f.hash) { $('#fcsb').onclick = async () => { const r = await api('POST', '/api/fair/client-seed', { seed: $('#fcs').value }); if (!r.hash) return toast(r.error, true); toast('Seed do cliente atualizada (nonce reiniciado)'); fairRoute(); }; $('#frot').onclick = async () => { const r = await api('POST', '/api/fair/rotate'); toast('Seed anterior revelada'); fairRoute(); }; }
  $('#vb').onclick = async () => { const r = await api('GET', `/api/fair/verify?seed=${encodeURIComponent($('#vs').value)}&client=${encodeURIComponent($('#vc').value)}&nonce=${encodeURIComponent($('#vn').value)}`); $('#vr').innerHTML = `<div class="panel pad" style="background:var(--bg2)"><div class="kv"><span>SHA-256 da seed</span><b style="font-size:12px;word-break:break-all">${r.hash}</b></div><div class="kv"><span>Número gerado (0–1)</span><b>${r.value.toFixed(8)}</b></div><div class="kv"><span>Resultado nos Dados</span><b>${r.dice.toFixed(2)}</b></div><div class="kv"><span>Resultado na Roleta</span><b>${r.roulette}</b></div></div>`; };
}

/* ---------- roteador ---------- */
async function route() {
  const [r] = (location.hash.replace('#/', '') || 'esportes').split('/');
  clearInterval(pollT); clearInterval(betsT); clearInterval(crashT); cancelAnimationFrame(crashRAF);
  chrome(); $('#fab').hidden = true; scrollTo(0, 0);
  const R = { esportes: () => sportsRoute(false), 'ao-vivo': () => sportsRoute(true), cassino: casinoRoute, crash: crashRoute, roleta: roulRoute, dados: diceRoute, slots: slotsRoute, apostas: betsRoute, carteira: walletRoute, responsavel: responsibleRoute, fair: fairRoute };
  await (R[r] || R.esportes)();
}
window.addEventListener('hashchange', route);
(async () => { await refreshMe(); if (!location.hash) location.hash = '#/esportes'; route(); })();
