(() => {
  "use strict";

  const DATA = window.SITE;
  if (!DATA) {
    document.body.innerHTML =
      '<p style="padding:2rem;font-family:system-ui">No se encontró <code>assets/content.js</code>. Ejecuta <code>python3 build/build.py</code>.</p>';
    return;
  }

  const { meta, phases, chapters } = DATA;
  const BY_ID = new Map(chapters.map((c) => [c.id, c]));
  const CHAPTERS = chapters.filter((c) => c.kind !== "appendix");
  const APPENDICES = chapters.filter((c) => c.kind === "appendix");

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const page = $("#page");
  const main = $("#contenido");
  const toc = $("#toc");
  const tocInner = $("#toc-inner");
  const sidebar = $("#sidebar");
  const sideNav = $("#side-nav");
  const scrim = $("#scrim");
  const menuBtn = $("#menu-btn");
  const sidebarClose = $("#sidebar-close");
  const searchBtn = $("#search-btn");
  const searchDialog = $("#search-dialog");
  const searchInput = $("#search-input");
  const searchResults = $("#search-results");
  const searchEmpty = $("#search-empty");
  const searchCount = $("#search-count");
  const searchClose = $("#search-close");
  const toast = $("#toast");
  const progressBar = $("#progress-bar");

  const esc = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));

  const normalize = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const stripHtml = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html;
    return (t.content.textContent || "").replace(/\s+/g, " ").trim();
  };

  const chapterHref = (id) => `#/capitulo/${encodeURIComponent(id)}`;
  const phaseOf = (id) => phases.find((p) => p.id === id);
  const appendicesLabel = `${APPENDICES.length}`;

  /* ------------------------------------------------------------------------
     Enriquecer contenido: bloques de código, tablas, enlaces de ancla
     ---------------------------------------------------------------------- */

  function enhanceContent(root) {
    $$("pre", root).forEach((pre) => {
      if (pre.closest(".ascii")) return;
      if (pre.parentElement && pre.parentElement.classList.contains("code-block")) return;
      const code = pre.querySelector("code");
      const text = code ? code.textContent : pre.textContent;
      const cls = code ? code.className : "";
      const lang = cls.includes("language-bash")
        ? "BASH"
        : cls.includes("language-text")
        ? "TEXTO"
        : "SQL";

      const wrap = document.createElement("div");
      wrap.className = "code-block";
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      const head = document.createElement("div");
      head.className = "code-block__head";
      head.innerHTML = `<span class="code-block__lang">${lang}</span>
        <button class="copy-btn" type="button" aria-label="Copiar código">
          <span class="copy-btn__text">Copiar</span>
        </button>`;
      wrap.insertBefore(head, pre);
      const btn = head.querySelector(".copy-btn");
      btn.addEventListener("click", async () => {
        const ok = await copyText(text);
        if (ok) {
          btn.classList.add("is-copied");
          btn.querySelector(".copy-btn__text").textContent = "Copiado";
          showToast("Código copiado");
          setTimeout(() => {
            btn.classList.remove("is-copied");
            btn.querySelector(".copy-btn__text").textContent = "Copiar";
          }, 1600);
        } else {
          showToast("No se pudo copiar");
        }
      });
    });

    $$("table", root).forEach((table) => {
      if (table.parentElement && table.parentElement.classList.contains("table-wrap")) return;
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      area.remove();
      return ok;
    }
  }

  /* ------------------------------------------------------------------------
     Extraer índice de la página
     ---------------------------------------------------------------------- */

  function headingsFrom(html) {
    const t = document.createElement("template");
    t.innerHTML = html;
    return $$("h2[id], h3[id]", t.content).map((h) => ({
      id: h.id,
      label: h.textContent.trim(),
      level: h.tagName === "H2" ? 2 : 3,
    }));
  }

  function tocItemsFor(chapter) {
    return headingsFrom(chapter.html).filter((h) => h.level === 2);
  }

  let tocObserver = null;
  let activeTocId = null;

  function renderToc(items, base) {
    if (tocObserver) {
      tocObserver.disconnect();
      tocObserver = null;
    }
    activeTocId = null;

    if (!items.length) {
      tocInner.innerHTML = "";
      return;
    }

    const list = items
      .map(
        (item) => `<li class="toc__item toc__item--${item.level}">
          <a class="toc__link" href="${base}#${item.id}" data-anchor="${item.id}">${esc(item.label)}</a>
        </li>`
      )
      .join("");

    tocInner.innerHTML = `
      <p class="toc__label">En esta página</p>
      <ol class="toc__list">${list}</ol>
      <a class="toc__top" href="${base}">↑ Volver arriba</a>`;

    if (!("IntersectionObserver" in window)) return;
    tocObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) setTocActive(visible[0].target.id);
      },
      { rootMargin: "-16% 0px -70% 0px", threshold: 0 }
    );
    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) tocObserver.observe(el);
    });
    setTocActive(items[0].id);
  }

  function setTocActive(id) {
    if (id === activeTocId) return;
    activeTocId = id;
    $$(".toc__link", tocInner).forEach((link) => {
      link.classList.toggle("is-active", link.dataset.anchor === id);
    });
  }

  /* ------------------------------------------------------------------------
     Portada
     ---------------------------------------------------------------------- */

  function pipelineStep(num, name, detail) {
    return `<li class="pipeline__step">
      <span class="pipeline__num">${num}</span>
      <span class="pipeline__name">${name}</span>
      <span class="pipeline__detail">${detail}</span>
    </li>`;
  }

  function renderHome(anchor) {
    const phaseCards = phases
      .map((phase) => {
        const list = CHAPTERS.filter((c) => c.phase === phase.id);
        const target = list[0] ? list[0].id : "proyecto-banco-sangre";
        return `<li><a class="phase-card" href="${chapterHref(target)}">
          <span class="phase-card__top">
            <span class="phase-card__range">${esc(phase.range)}</span>
            <span class="phase-card__count">${list.length} ${list.length === 1 ? "capítulo" : "capítulos"}</span>
          </span>
          <h3 class="phase-card__title">${esc(phase.label)}</h3>
          <span class="phase-card__desc">${esc(phase.desc)}</span>
          <span class="phase-card__cta">Entrar
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </span>
        </a></li>`;
      })
      .join("");

    const quickLinks = [
      ["01", "DBMS y el rol del DBA", "que-es-un-dbms"],
      ["07", "SELECT esencial", "select-esencial"],
      ["11", "Funciones de ventana", "ventanas"],
      ["16", "Índices y EXPLAIN", "indices"],
      ["20", "Failover y quorum", "clustering-failover"],
      ["24", "El proyecto completo", "proyecto-banco-sangre"],
    ]
      .map(
        ([num, label, id]) =>
          `<a class="quick-link" href="${chapterHref(id)}"><span class="quick-link__num">${num}</span><span>${esc(label)}</span><span class="quick-link__arrow" aria-hidden="true">→</span></a>`
      )
      .join("");

    page.innerHTML = `
      <div class="home">
        <section class="hero">
          <div class="hero__copy">
            <p class="eyebrow"><span class="eyebrow__line" aria-hidden="true"></span>Curso de Administración de Bases de Datos</p>
            <h1>MySQL,<br><em>del SELECT<br>al clúster.</em></h1>
            <p class="hero__lead">Un recorrido por lo que no sabías al empezar y lo que un DBA necesita dominar, con el <strong>Banco de Sangre</strong> como caso real. Cada tema termina en un script que puedes ejecutar.</p>
            <div class="hero__actions">
              <a class="btn btn--primary" href="${chapterHref("que-es-un-dbms")}">Empezar por el 01
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </a>
              <a class="btn btn--ghost" href="${chapterHref("proyecto-banco-sangre")}">Ver el proyecto</a>
            </div>
            <ul class="hero__meta">
              <li><strong>${meta.chapterCount}</strong><span>capítulos</span></li>
              <li><strong>12</strong><span>tablas del caso</span></li>
              <li><strong>6</strong><span>scripts ejecutables</span></li>
            </ul>
          </div>

          <figure class="trace" aria-labelledby="trace-title">
            <div class="trace__head">
              <div>
                <p class="trace__eyebrow">Trazabilidad · banco_sangre</p>
                <p class="trace__title" id="trace-title">Una unidad, todo su recorrido</p>
              </div>
              <span class="trace__badge">GR-2026-0001</span>
            </div>
            <div class="trace__body">
              <div class="trace__row">
                <span class="trace__dot trace__dot--donor" aria-hidden="true"></span>
                <div><strong>Donante</strong><span>Ana Sofía · O+</span></div>
                <span class="trace__time">03 ago</span>
              </div>
              <div class="trace__row">
                <span class="trace__dot trace__dot--unit" aria-hidden="true"></span>
                <div><strong>Unidad derivada</strong><span>Glóbulos rojos · 280 ml</span></div>
                <span class="trace__time">03 ago</span>
              </div>
              <div class="trace__row">
                <span class="trace__dot trace__dot--test" aria-hidden="true"></span>
                <div><strong>Prueba</strong><span>VIH, HBV, HCV · negativo</span></div>
                <span class="trace__time">03 ago</span>
              </div>
              <div class="trace__row">
                <span class="trace__dot trace__dot--request" aria-hidden="true"></span>
                <div><strong>Solicitud</strong><span>Hospital General · urgente</span></div>
                <span class="trace__time">04 ago</span>
              </div>
              <div class="trace__row">
                <span class="trace__dot trace__dot--dispatch" aria-hidden="true"></span>
                <div><strong>Despacho</strong><span>Entregada · auditoría</span></div>
                <span class="trace__time">04 ago</span>
              </div>
            </div>
            <figcaption class="trace__caption">Cada paso deja una fila, una prueba y un movimiento. Eso es trazabilidad.</figcaption>
          </figure>
        </section>

        <section class="section" id="mapa">
          <div class="section__head">
            <p class="eyebrow"><span class="eyebrow__line" aria-hidden="true"></span>Mapa</p>
            <h2>Cinco fases, veinticuatro paradas</h2>
            <p>Primero el vocabulario que faltaba, después el taller de consultas, luego el diseño y el espacio, la operación y la disponibilidad. Al final, el proyecto completo con su demo.</p>
          </div>
          <ol class="phase-grid">${phaseCards}</ol>
        </section>

        <section class="section section--case" id="caso">
          <div class="case-head">
            <p class="eyebrow"><span class="eyebrow__line" aria-hidden="true"></span>El caso</p>
            <h2>Un banco de sangre no guarda sangre. Guarda decisiones.</h2>
            <p>Cada unidad tiene grupo, componente, vencimiento, pruebas y un destino. El modelo tiene que responder tres preguntas a la vez: <strong>¿qué hay?</strong>, <strong>¿de dónde vino?</strong> y <strong>¿a dónde fue?</strong>.</p>
          </div>

          <ol class="pipeline" aria-label="Ciclo de la sangre en el proyecto">
            ${pipelineStep("01", "Donante", "Registro y elegibilidad")}
            ${pipelineStep("02", "Donación", "Extracción y estado")}
            ${pipelineStep("03", "Unidad", "Componente y vencimiento")}
            ${pipelineStep("04", "Prueba", "Tamizaje obligatorio")}
            ${pipelineStep("05", "Solicitud", "Hospital y prioridad")}
            ${pipelineStep("06", "Despacho", "Salida y auditoría")}
          </ol>

          <div class="case-grid">
            <article class="case-card">
              <p class="case-card__num">12</p>
              <h3>tablas relacionadas</h3>
              <p>Donantes, donaciones, unidades, pruebas, hospitales, solicitudes, despachos, movimientos y auditoría.</p>
            </article>
            <article class="case-card">
              <p class="case-card__num">3</p>
              <h3>tipos de partición</h3>
              <p>RANGE por año, LIST por estado y HASH por unidad. Cada una resuelve una pregunta distinta.</p>
            </article>
            <article class="case-card">
              <p class="case-card__num">4</p>
              <h3>eventos automáticos</h3>
              <p>Vencimientos, movimientos, Uptime y purga de auditoría, sin depender de que alguien se acuerde.</p>
            </article>
          </div>
          <a class="link-arrow" href="${chapterHref("proyecto-banco-sangre")}">Leer el proyecto completo
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>
        </section>

        <section class="section" id="empieza">
          <div class="section__head">
            <p class="eyebrow"><span class="eyebrow__line" aria-hidden="true"></span>Atajos</p>
            <h2>Si vienes con una duda concreta</h2>
            <p>Estas son las paradas que más se consultan. La búsqueda (<kbd>Ctrl</kbd> + <kbd>K</kbd>) llega a cualquier sección.</p>
          </div>
          <div class="quick-grid">${quickLinks}</div>
        </section>

        <section class="section" id="ejecutar">
          <div class="how">
            <div>
              <p class="eyebrow"><span class="eyebrow__line" aria-hidden="true"></span>Del texto a MySQL</p>
              <h2>Prosa para entender, scripts para probar.</h2>
              <p>El proyecto vive en <code>proyecto/sql/</code>. Los seis archivos se ejecutan en orden y dejan una base <code>banco_sangre</code> lista para la demo.</p>
              <pre class="how__command"><code>mysql -u root -p &lt; proyecto/sql/00_esquema.sql</code><button type="button" data-copy="mysql -u root -p < proyecto/sql/00_esquema.sql" aria-label="Copiar comando">Copiar</button></pre>
              <p class="how__note">O abre cada archivo en MySQL Workbench y ejecútalo por bloques.</p>
            </div>
            <ol class="how__steps">
              <li><span>01</span><div><h3>Elige una parada</h3><p>La barra lateral agrupa por fase. Cada capítulo termina con el anterior y el siguiente.</p></div></li>
              <li><span>02</span><div><h3>Lee y copia</h3><p>Los avisos <em>Ojo</em> y <em>Caso banco de sangre</em> conectan la teoría con el proyecto.</p></div></li>
              <li><span>03</span><div><h3>Ejecuta</h3><p>Cada bloque SQL tiene su botón Copiar. La guía explica el orden y los requisitos.</p></div></li>
            </ol>
          </div>
          <div class="home__guide">
            <a class="link-arrow" href="${chapterHref("guia")}">Abrir la guía de uso
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </a>
          </div>
        </section>
      </div>`;

    document.body.dataset.view = "home";
    renderToc([], "#/");
    document.title = `${meta.title} · Cuaderno de bases de datos`;
    updateSidebarActive("home");
    enhanceContent(page);
    if (anchor) scheduleAnchor(anchor);
    else window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ------------------------------------------------------------------------
     Capítulo y apéndices
     ---------------------------------------------------------------------- */

  function pageHeader({ breadcrumb, eyebrow, title, lead, metaHtml, inlineToc }) {
    return `<header class="page-head">
      <nav class="breadcrumb" aria-label="Migas de pan">${breadcrumb}</nav>
      <p class="eyebrow"><span class="eyebrow__line" aria-hidden="true"></span>${eyebrow}</p>
      <h1>${title}</h1>
      <p class="lead">${lead}</p>
      <div class="page-meta">${metaHtml}</div>
      ${inlineToc || ""}
    </header>`;
  }

  function inlineToc(items, base) {
    if (!items.length) return "";
    const links = items
      .map((item) => `<li><a href="${base}#${item.id}" data-anchor="${item.id}">${esc(item.label)}</a></li>`)
      .join("");
    return `<details class="toc-inline"><summary>En esta página</summary><ol>${links}</ol></details>`;
  }

  function renderChapter(chapter, anchor) {
    const isAppendix = chapter.kind === "appendix";
    const phase = isAppendix ? "Apéndice" : phaseOf(chapter.phase)?.label || "Capítulo";
    const tocItems = tocItemsFor(chapter);
    const base = chapterHref(chapter.id);

    const breadcrumb = `<a href="#/">Portada</a><span aria-hidden="true">/</span><span aria-current="page">${
      isAppendix ? "Apéndice " + chapter.num : "Capítulo " + chapter.num
    }</span>`;

    const metaHtml = `
      <span class="meta-chip">${chapter.reading} min de lectura</span>
      <span class="meta-chip">${phase}</span>
      <a class="meta-link" href="${esc(chapter.source)}" target="_blank" rel="noreferrer">${esc(
        chapter.sourceLabel || "Ver fuente"
      )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>
      </a>`;

    const idx = chapters.indexOf(chapter);
    const prev = chapters[idx - 1];
    const next = chapters[idx + 1];
    const pager = `<nav class="pager" aria-label="Página anterior y siguiente">
      ${
        prev
          ? `<a class="pager__link" href="${chapterHref(prev.id)}" rel="prev">
              <span class="pager__label">Anterior</span>
              <span class="pager__title">${esc(prev.title)}</span>
              <span class="pager__arrow">← ${prev.num}</span>
            </a>`
          : ""
      }
      ${
        next
          ? `<a class="pager__link pager__link--next" href="${chapterHref(next.id)}" rel="next">
              <span class="pager__label">Siguiente</span>
              <span class="pager__title">${esc(next.title)}</span>
              <span class="pager__arrow">${next.num} →</span>
            </a>`
          : ""
      }
    </nav>`;

    page.innerHTML = `<article class="chapter">
      ${pageHeader({
        breadcrumb,
        eyebrow: isAppendix ? `Apéndice ${chapter.num} · ${phase}` : `Capítulo ${chapter.num} · ${phase}`,
        title: esc(chapter.title),
        lead: esc(chapter.summary),
        metaHtml,
        inlineToc: inlineToc(tocItems, base),
      })}
      <aside class="takeaways" id="lo-esencial" aria-labelledby="takeaways-label">
        <p class="takeaways__label" id="takeaways-label">Lo esencial</p>
        <ul>${chapter.takeaways.map((t) => `<li>${t}</li>`).join("")}</ul>
      </aside>
      <div class="chapter-body">${chapter.html}</div>
      ${pager}
    </article>`;

    document.body.dataset.view = isAppendix ? "appendix" : "chapter";
    renderToc(tocItems, base);
    document.title = `${chapter.num} · ${chapter.title} — ${meta.title}`;
    updateSidebarActive(chapter.id);
    enhanceContent(page);

    if (anchor) scheduleAnchor(anchor);
    else window.scrollTo({ top: 0, behavior: "auto" });
    if (!isFirstRender) main.focus({ preventScroll: true });
  }

  function renderNotFound() {
    page.innerHTML = `<div class="chapter">
      <header class="page-head">
        <nav class="breadcrumb" aria-label="Migas de pan"><a href="#/">Portada</a><span aria-hidden="true">/</span><span aria-current="page">No encontrado</span></nav>
        <p class="eyebrow"><span class="eyebrow__line" aria-hidden="true"></span>Error 404</p>
        <h1>Esa parada no existe.</h1>
        <p class="lead">El enlace apunta a un capítulo que no está en este cuaderno. Vuelve a la portada o empieza por el 01.</p>
        <div class="page-meta"><a class="btn btn--primary" href="#/">Volver a la portada</a></div>
      </header>
    </div>`;
    document.body.dataset.view = "chapter";
    renderToc([], "#/");
    document.title = `No encontrado — ${meta.title}`;
    updateSidebarActive(null);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ------------------------------------------------------------------------
     Barra lateral
     ---------------------------------------------------------------------- */

  function buildSidebar() {
    const home = `<a class="side-home" href="#/" data-side="home"><span class="side-home__dot" aria-hidden="true"></span>Portada</a>`;

    const groups = phases
      .map((phase) => {
        const list = CHAPTERS.filter((c) => c.phase === phase.id);
        if (!list.length) return "";
        const items = list
          .map(
            (c) =>
              `<li><a class="side-link" href="${chapterHref(c.id)}" data-side="${c.id}"><span class="side-link__num">${c.num}</span><span>${esc(c.short)}</span></a></li>`
          )
          .join("");
        return `<div class="side-group">
          <div class="side-group__head"><span>${esc(phase.label)}</span><span class="side-group__range">${esc(phase.range)}</span></div>
          <ol class="side-list">${items}</ol>
        </div>`;
      })
      .join("");

    const appendixItems = APPENDICES.map(
      (c) =>
        `<li><a class="side-link" href="${chapterHref(c.id)}" data-side="${c.id}"><span class="side-link__num">${c.num}</span><span>${esc(c.short)}</span></a></li>`
    ).join("");

    sideNav.innerHTML =
      home +
      groups +
      `<div class="side-group">
        <div class="side-group__head"><span>Apéndices</span><span class="side-group__range">A1–${appendicesLabel}</span></div>
        <ol class="side-list">${appendixItems}</ol>
      </div>`;

    $("#side-count").textContent = `${CHAPTERS.length} capítulos · ${APPENDICES.length} apéndices`;
    $("#footer-generated").textContent = `Compilado el ${meta.generatedLabel}`;
  }

  function updateSidebarActive(id) {
    $$("[data-side]", sideNav).forEach((link) => {
      const active = id !== null && link.dataset.side === id;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  /* ------------------------------------------------------------------------
     Rutas
     ---------------------------------------------------------------------- */

  let currentRouteKey = null;
  let isFirstRender = true;

  function parseHash() {
    const raw = window.location.hash || "#/";
    if (!raw.startsWith("#/")) return { type: "anchor", id: decodeURIComponent(raw.slice(1)) };
    const [path, anchor] = raw.slice(1).split("#");
    const parts = path.split("/").filter(Boolean);
    if (parts[0] === "capitulo") return { type: "chapter", id: decodeURIComponent(parts[1] || ""), anchor };
    return { type: "home", anchor };
  }

  function scheduleAnchor(id) {
    requestAnimationFrame(() => setTimeout(() => scrollToAnchor(id), 40));
  }

  function scrollToAnchor(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    const topbarH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h"), 10) || 64;
    const top = el.getBoundingClientRect().top + window.scrollY - topbarH - 20;
    window.scrollTo({ top, behavior: REDUCED ? "auto" : "smooth" });
    if (/^(H[1-6]|ASIDE|SECTION|MAIN)$/.test(el.tagName)) {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    }
    setTocActive(id);
  }

  function handleRoute() {
    const route = parseHash();
    closeNav(false);

    if (route.type === "anchor") {
      if (!currentRouteKey) {
        renderHome();
        currentRouteKey = "home";
      }
      if (route.id) scheduleAnchor(route.id);
      return;
    }

    const key = route.type === "chapter" ? `chapter:${route.id}` : "home";
    if (key !== currentRouteKey) {
      if (route.type === "home") renderHome(route.anchor);
      else {
        const chapter = BY_ID.get(route.id);
        if (chapter) renderChapter(chapter, route.anchor);
        else renderNotFound();
      }
      currentRouteKey = key;
      if (!isFirstRender && route.type === "home") main.focus({ preventScroll: true });
      isFirstRender = false;
    } else if (route.type === "chapter") {
      const chapter = BY_ID.get(route.id);
      if (chapter && route.anchor) scheduleAnchor(route.anchor);
      else if (chapter) window.scrollTo({ top: 0, behavior: "auto" });
    } else if (route.type === "home") {
      if (route.anchor) scheduleAnchor(route.anchor);
      else window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  /* ------------------------------------------------------------------------
     Búsqueda
     ---------------------------------------------------------------------- */

  const searchIndex = [];

  function buildSearchIndex() {
    chapters.forEach((chapter) => {
      const phase = chapter.kind === "appendix" ? "Apéndice" : phaseOf(chapter.phase)?.label || "Capítulo";
      const body = normalize(stripHtml(chapter.html));
      searchIndex.push({
        kind: "chapter",
        num: chapter.num,
        title: chapter.title,
        meta: `${chapter.kind === "appendix" ? "Apéndice" : "Capítulo"} ${chapter.num} · ${phase}`,
        snippet: chapter.summary,
        route: chapterHref(chapter.id),
        haystack: normalize(
          [
            chapter.title,
            chapter.short,
            chapter.summary,
            ...chapter.takeaways.map(stripHtml),
            ...headingsFrom(chapter.html).map((h) => h.label),
          ].join(" ")
        ),
        body,
        weight: 3,
      });
      headingsFrom(chapter.html).forEach((h) => {
        searchIndex.push({
          kind: "heading",
          num: chapter.num,
          title: h.label,
          meta: `${chapter.kind === "appendix" ? "Apéndice" : "Capítulo"} ${chapter.num} · ${chapter.title}`,
          snippet: "",
          route: `${chapterHref(chapter.id)}#${h.id}`,
          haystack: normalize(h.label),
          weight: 2,
        });
      });
    });
  }

  const SUGGESTED = ["que-es-un-dbms", "select-esencial", "agregacion", "ventanas", "indices", "respaldos", "ejercicios", "datos-del-caso"];

  function defaultResults() {
    return SUGGESTED.map((id) => searchIndex.find((i) => i.kind === "chapter" && BY_ID.get(id)?.num === i.num)).filter(Boolean);
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlight(text, query) {
    const safe = esc(text);
    if (!query) return safe;
    try {
      return safe.replace(new RegExp(`(${escapeRegExp(esc(query))})`, "ig"), "<mark>$1</mark>");
    } catch {
      return safe;
    }
  }

  function search(query) {
    const q = normalize(query.trim());
    if (!q) return defaultResults();
    return searchIndex
      .map((item) => {
        const title = normalize(item.title);
        let score = 0;
        if (title === q) score += 120;
        else if (title.startsWith(q)) score += 80;
        else if (title.includes(q)) score += 50;
        if (normalize(item.meta).includes(q)) score += 18;
        if (normalize(item.snippet).includes(q)) score += 14;
        if (item.haystack.includes(q)) score += 10;
        if (item.body && item.body.includes(q)) score += 4;
        if (score > 0 && item.weight) score += item.weight;
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "es"))
      .slice(0, 12)
      .map((entry) => entry.item);
  }

  let searchActive = 0;
  let currentResults = [];

  function renderSearchResults(query) {
    currentResults = search(query);
    searchActive = 0;
    searchEmpty.hidden = currentResults.length > 0;

    if (!query.trim()) searchCount.textContent = "Sugerencias para empezar";
    else if (!currentResults.length) searchCount.textContent = "Sin resultados";
    else searchCount.textContent = `${currentResults.length} ${currentResults.length === 1 ? "resultado" : "resultados"}`;

    searchResults.innerHTML = currentResults
      .map((item, index) => {
        const active = index === searchActive;
        const snippet = item.snippet ? `<span class="search-result__snippet">${highlight(item.snippet, query)}</span>` : "";
        return `<li id="search-opt-${index}" role="option" aria-selected="${active}">
          <a class="search-result ${active ? "is-active" : ""}" href="${item.route}" data-result-index="${index}" tabindex="-1">
            <span class="search-result__num">${esc(item.num)}</span>
            <span class="search-result__body">
              <span class="search-result__title">${highlight(item.title, query)}</span>
              <span class="search-result__meta">${esc(item.meta)}</span>
              ${snippet}
            </span>
            <span class="search-result__arrow" aria-hidden="true">↵</span>
          </a>
        </li>`;
      })
      .join("");

    if (currentResults.length) searchInput.setAttribute("aria-activedescendant", "search-opt-0");
    else searchInput.removeAttribute("aria-activedescendant");
  }

  function updateSearchActive(next) {
    if (!currentResults.length) return;
    searchActive = (next + currentResults.length) % currentResults.length;
    $$("li[role='option']", searchResults).forEach((li, index) => {
      const active = index === searchActive;
      li.setAttribute("aria-selected", String(active));
      const link = $(".search-result", li);
      if (link) link.classList.toggle("is-active", active);
    });
    searchInput.setAttribute("aria-activedescendant", `search-opt-${searchActive}`);
    const activeLink = $(`#search-opt-${searchActive} .search-result`);
    if (activeLink) activeLink.scrollIntoView({ block: "nearest" });
  }

  function openSearch() {
    closeNav(false);
    if (searchDialog.open) {
      searchInput.focus();
      return;
    }
    searchInput.value = "";
    renderSearchResults("");
    searchDialog.showModal();
    searchInput.setAttribute("aria-expanded", "true");
    setTimeout(() => searchInput.focus(), 30);
  }

  function closeSearch() {
    if (searchDialog.open) searchDialog.close();
  }

  /* ------------------------------------------------------------------------
     Navegación móvil
     ---------------------------------------------------------------------- */

  let navReturnFocus = null;
  let navOpen = false;

  function openNav() {
    if (navOpen) return;
    navOpen = true;
    navReturnFocus = document.activeElement;
    document.body.classList.add("nav-open");
    scrim.hidden = false;
    menuBtn.setAttribute("aria-expanded", "true");
    [main, toc, $(".site-footer")].forEach((el) => {
      if (el) el.inert = true;
    });
    setTimeout(() => {
      const first = $(".side-link, .side-home", sidebar);
      if (first) first.focus();
    }, 60);
  }

  function closeNav(restoreFocus = true) {
    if (!navOpen) return;
    navOpen = false;
    document.body.classList.remove("nav-open");
    scrim.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
    [main, toc, $(".site-footer")].forEach((el) => {
      if (el) el.inert = false;
    });
    if (restoreFocus && navReturnFocus) navReturnFocus.focus({ preventScroll: true });
  }

  function trapNavFocus(event) {
    if (!navOpen || event.key !== "Tab") return;
    const focusables = $$("a[href], button:not([disabled])", sidebar).filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ------------------------------------------------------------------------
     Aviso flotante
     ---------------------------------------------------------------------- */

  let toastTimer = null;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
  }

  /* ------------------------------------------------------------------------
     Eventos
     ---------------------------------------------------------------------- */

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute("href");
    const current = window.location.hash;
    if (!href || href === "#" || !current || href !== current) return;
    event.preventDefault();
    const route = parseHash();
    if (route.type === "anchor" ? route.id : route.anchor) {
      scrollToAnchor(route.type === "anchor" ? route.id : route.anchor);
    } else {
      window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
    }
  });

  document.addEventListener("click", (event) => {
    const copyBtn = event.target.closest("[data-copy]");
    if (!copyBtn) return;
    const text = copyBtn.dataset.copy || "";
    if (!text) return;
    copyText(text).then((ok) => {
      if (ok) {
        const old = copyBtn.textContent;
        copyBtn.textContent = "Copiado";
        copyBtn.classList.add("is-copied");
        showToast("Comando copiado");
        setTimeout(() => {
          copyBtn.textContent = old;
          copyBtn.classList.remove("is-copied");
        }, 1600);
      } else {
        showToast("No se pudo copiar");
      }
    });
  });

  document.addEventListener("click", (event) => {
    const sideLink = event.target.closest(".side-link, .side-home");
    if (sideLink && window.matchMedia("(max-width: 980px)").matches) closeNav(false);
    if (event.target.closest(".search-result")) closeSearch();
  });

  document.addEventListener("mouseover", (event) => {
    const result = event.target.closest(".search-result");
    if (!result) return;
    const index = Number(result.dataset.resultIndex);
    if (Number.isInteger(index) && index !== searchActive) updateSearchActive(index);
  });

  searchBtn.addEventListener("click", openSearch);
  searchClose.addEventListener("click", closeSearch);
  searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      updateSearchActive(searchActive + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      updateSearchActive(searchActive - 1);
    } else if (event.key === "Enter" && currentResults.length) {
      event.preventDefault();
      const target = currentResults[searchActive];
      if (target) {
        closeSearch();
        window.location.hash = target.route.slice(1);
      }
    }
  });

  searchDialog.addEventListener("close", () => {
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
    searchBtn.focus({ preventScroll: true });
  });
  searchDialog.addEventListener("click", (event) => {
    if (event.target === searchDialog) closeSearch();
  });

  menuBtn.addEventListener("click", () => (navOpen ? closeNav() : openNav()));
  sidebarClose.addEventListener("click", () => closeNav());
  scrim.addEventListener("click", () => closeNav());

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const typing =
      target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);

    if (event.key === "Escape" && navOpen) {
      event.preventDefault();
      closeNav();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
      return;
    }
    if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      openSearch();
      return;
    }
    trapNavFocus(event);
  });

  window.addEventListener("hashchange", handleRoute);

  let progressFrame = 0;
  function updateProgress() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progressBar.style.width = `${(value * 100).toFixed(2)}%`;
  }
  window.addEventListener(
    "scroll",
    () => {
      if (progressFrame) return;
      progressFrame = requestAnimationFrame(() => {
        progressFrame = 0;
        updateProgress();
      });
    },
    { passive: true }
  );
  window.addEventListener("resize", updateProgress);

  window.matchMedia("(min-width: 981px)").addEventListener("change", (event) => {
    if (event.matches && navOpen) closeNav(false);
  });

  /* ------------------------------------------------------------------------
     Arranque
     ---------------------------------------------------------------------- */

  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "");
  if (isMac) $$(".search-trigger__kbd").forEach((el) => (el.textContent = "⌘ K"));

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  buildSidebar();
  buildSearchIndex();
  updateProgress();
  handleRoute();
})();
