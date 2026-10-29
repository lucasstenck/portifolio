// Portfólio dinâmico: os projetos vêm de projects.json; filtro, busca, "mostrar mais" e galeria rodam no navegador.
(() => {
  const PAGE = 24;
  const kinds = [["", "Todos"], ["sites", "Sites"], ["apps", "Aplicativos"], ["sistemas", "Sistemas"]];
  const kindName = { sites: "Site", apps: "Aplicativo", sistemas: "Sistema" };
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    for (const kid of kids) node.append(kid);
    return node;
  };
  const state = { all: [], kind: "", origin: "", q: "", shown: PAGE, current: null, shot: 0 };
  // Ordem a cada visita: embaralha velhos e novos e alterna app, site, app, site (um sistema a cada 12 itens).
  const shuffle = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  // Embaralha, mas distribui os projetos pessoais (poucos) de forma uniforme entre os da Oryveen.
  const spread = (list) => {
    const place = (items) => shuffle(items).map((p, i, a) => [(i + Math.random()) / a.length, p]);
    return [...place(list.filter((p) => p.source === "pessoal")), ...place(list.filter((p) => p.source !== "pessoal"))].sort((x, y) => y[0] - x[0]).map(([, p]) => p);
  };
  function interleave(all) {
    const apps = spread(all.filter((p) => p.kind === "apps")), sites = spread(all.filter((p) => p.kind === "sites")), systems = shuffle(all.filter((p) => p.kind === "sistemas"));
    const out = [];
    let turn = 0;
    while (apps.length || sites.length || systems.length) {
      if (systems.length && out.length % 12 === 11) { out.push(systems.pop()); continue; }
      const first = turn % 2 === 0 ? apps : sites, second = turn % 2 === 0 ? sites : apps;
      const next = first.length ? first : second.length ? second : systems;
      out.push(next.pop());
      turn++;
    }
    return out;
  }
  const norm = (text) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function filtered() {
    const q = norm(state.q.trim());
    return state.all.filter((p) =>
      (!state.kind || p.kind === state.kind) && (!state.origin || p.source === state.origin) &&
      (!q || norm(`${p.title} ${p.description} ${p.tags.join(" ")}`).includes(q)));
  }

  function card(p) {
    const img = el("img", { src: p.cover, alt: "", loading: "lazy", decoding: "async", width: 640, height: 427 });
    const txt = el("div", { className: "txt" });
    if (p.source === "oryveen") txt.append(el("span", { className: "badge", textContent: "Oryveen" }));
    txt.append(el("h3", { textContent: p.title }), el("p", { textContent: p.description }));
    const btn = el("button", { type: "button", className: "card", ariaLabel: `Ver ${p.title}` }, el("div", { className: "pic" }, img), txt);
    btn.addEventListener("click", () => open(p));
    return el("li", {}, btn);
  }

  function render() {
    const list = filtered();
    const grid = $("grid");
    grid.replaceChildren(...list.slice(0, state.shown).map(card));
    $("count").textContent = `${list.length} ${list.length === 1 ? "projeto" : "projetos"}`;
    $("empty").hidden = list.length > 0;
    $("more").hidden = list.length <= state.shown;
    for (const b of $("kinds").children) b.setAttribute("aria-pressed", String(b.dataset.kind === state.kind));
  }
  const reset = () => { state.shown = PAGE; render(); };

  function show(i) {
    const p = state.current;
    state.shot = (i + p.images.length) % p.images.length;
    const image = p.images[state.shot];
    const main = $("dlg-img");
    main.src = image.src;
    main.alt = image.alt || `${p.title}, imagem ${state.shot + 1}`;
    for (const [n, b] of [...$("dlg-thumbs").children].entries()) b.setAttribute("aria-current", String(n === state.shot));
  }

  function open(p) {
    state.current = p;
    $("dlg-kind").textContent = `${kindName[p.kind]}${p.source === "oryveen" ? " · Oryveen" : ""}`;
    $("dlg-title").textContent = p.title;
    $("dlg-desc").textContent = p.description;
    $("dlg-tags").replaceChildren(...p.tags.map((t) => el("li", { textContent: t })));
    const video = $("dlg-video");
    video.hidden = !p.video;
    if (p.video) video.href = p.video;
    const thumbs = $("dlg-thumbs");
    thumbs.hidden = p.images.length < 2;
    thumbs.replaceChildren(...p.images.map((image, n) => {
      const b = el("button", { type: "button", ariaLabel: `Imagem ${n + 1}` }, el("img", { src: image.src, alt: "", loading: "lazy", decoding: "async" }));
      b.addEventListener("click", () => show(n));
      return b;
    }));
    show(0);
    if (!$("dlg").open) $("dlg").showModal();
    history.replaceState(null, "", `#p=${encodeURIComponent(p.id)}`);
  }

  function close() { if ($("dlg").open) $("dlg").close(); }

  async function init() {
    $("year").textContent = new Date().getFullYear();
    try {
      state.all = interleave(await (await fetch("projects.json")).json());
    } catch {
      $("empty").textContent = "Não foi possível carregar os projetos agora. Recarregue a página.";
      $("empty").hidden = false;
      return;
    }
    const count = (kind) => state.all.filter((p) => p.kind === kind).length;
    $("stats").innerHTML = `<b>${state.all.length}</b> projetos · <b>${count("sites")}</b> sites · <b>${count("apps")}</b> aplicativos · <b>${count("sistemas")}</b> sistemas`;
    $("kinds").replaceChildren(...kinds.map(([value, label]) => {
      const b = el("button", { type: "button", textContent: label });
      b.dataset.kind = value;
      b.addEventListener("click", () => { state.kind = value; reset(); });
      return b;
    }));
    let timer;
    $("q").addEventListener("input", (event) => { clearTimeout(timer); timer = setTimeout(() => { state.q = event.target.value; reset(); }, 120); });
    $("origin").addEventListener("change", (event) => { state.origin = event.target.value; reset(); });
    $("more").addEventListener("click", () => { state.shown += PAGE; render(); });
    $("close").addEventListener("click", close);
    $("dlg").addEventListener("click", (event) => { if (event.target === $("dlg")) close(); });
    $("dlg").addEventListener("close", () => { history.replaceState(null, "", location.pathname + location.search); });
    $("dlg").addEventListener("keydown", (event) => {
      if (!state.current) return;
      if (event.key === "ArrowRight") show(state.shot + 1);
      if (event.key === "ArrowLeft") show(state.shot - 1);
    });
    render();
    // Link direto para um projeto: #p=id (também quando só o endereço muda)
    const fromHash = () => {
      const match = /^#p=(.+)$/.exec(location.hash);
      const direct = match && state.all.find((p) => p.id === decodeURIComponent(match[1]));
      if (direct && state.current?.id !== direct.id) open(direct);
    };
    window.addEventListener("hashchange", fromHash);
    fromHash();
  }
  init();
})();
