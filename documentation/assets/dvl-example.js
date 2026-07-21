// <dvl-example> — live, EDITABLE documentation examples, running the CURRENT dvl source.
//
// Authoring: a fenced code block with the `dvl` language in any doc page:
//
//   ```dvl
//   const v = canvas(640, 300);
//   v.dot('penguins', { x: linear('bill_length_mm'), y: linear('body_mass_g'), fill: ordinal('species') });
//   return v;
//   ```
//
// Each block becomes a card with a CodeMirror editor (the SAME editor as the demo playground —
// src/lib/dvl-demo/editor.ts) above the rendered chart. Edit the code and it re-runs live. The
// block gets the SAME sandbox as the demo (canvas/db/scales/layouts/refs/aggs — runtime.ts, the
// single source of truth), against a shared DuckDB-Wasm instance (jsDelivr CDN assets) seeded
// with the demo base tables, on a throwaway db BRANCH per run. The runtime + editor come from
// documentation/assets/dvl.js — an esbuild bundle of the live source tree, rebuilt on change
// while `npm run dev` runs (vite.config.ts docsDvlBundle).
//
// Load as a CLASSIC script (uses document.currentScript.src) somewhere in the page.
(function () {
  // the bundle sits next to this script — resolve against our own URL so any base path works
  var ASSETS_BASE = new URL(".", document.currentScript.src);

  // ── the bundle: ONE import (editor + runtime), memoized ──
  var modulePromise = null;
  function loadModule() {
    // runtime-lazy by design: the bundle is a build artifact resolved relative to this script's
    // URL (unknowable at author time), and must not load unless a page contains an example.
    if (!modulePromise) modulePromise = import(new URL("dvl.js", ASSETS_BASE).href);
    return modulePromise;
  }

  // ── the database: ONE DuckDB, booted on first run (heavier than the module) ──
  var runtimePromise = null;
  function runtime() {
    if (!runtimePromise) {
      runtimePromise = (async function () {
        var mod = await loadModule();
        var boot = await mod.bootDemoDb();
        return { mod: mod, db: boot.db };
      })();
    }
    return runtimePromise;
  }

  // renders are serialized through a queue — a page of examples must not stampede the database
  var queue = [];
  var pumping = false;
  function enqueue(job) {
    queue.push(job);
    if (pumping) return;
    pumping = true;
    (async function pump() {
      while (queue.length) {
        try { await queue.shift()(); } catch (e) { console.error("[dvl-example]", e); }
      }
      pumping = false;
    })();
  }

  // hydrate (mount the editor + first run) only when scrolled into view
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      var card = entry.target;
      enqueue(function () { return hydrate(card); });
    });
  }, { rootMargin: "250px" });

  function openHref(code) {
    // "Open in editor" → the demo playground with this block's (edited) source preloaded (?code=…),
    // which boots the SAME dataset (runtime.bootDemoDb) the docs ran it against.
    return "/dvl-demo/?code=" + encodeURIComponent(code);
  }

  async function renderExample(card) {
    var out = card.querySelector(".dvl-example-output");
    out.innerHTML = '<div class="dvl-example-status">running…</div>';
    try {
      var rt = await runtime();
      var svg = await rt.mod.runExample(rt.db, card.dataset.dvlCode, "docs");
      out.innerHTML = svg;
      out.classList.add("ok");
    } catch (err) {
      out.innerHTML = "";
      var pre = document.createElement("pre");
      pre.className = "dvl-example-error";
      pre.textContent = String((err && err.message) || err);
      out.appendChild(pre);
    }
  }

  // Replace the static code placeholder with a live CodeMirror editor; edits re-run (debounced).
  async function hydrate(card) {
    var mod = await loadModule();
    var host = card.querySelector(".dvl-example-editor");
    var open = card.querySelector(".dvl-example-open");
    host.innerHTML = "";
    var timer = null;
    card._dvlView = mod.createDvlEditor({
      parent: host,
      doc: card.dataset.dvlCode,
      onChange: function (code) {
        card.dataset.dvlCode = code;
        if (open) open.href = openHref(code);
        clearTimeout(timer);
        timer = setTimeout(function () { enqueue(function () { return renderExample(card); }); }, 350);
      },
    });
    await renderExample(card);
  }

  /** Replace every ```dvl fence docsify rendered (<pre data-lang="dvl">) with an example card:
   *  an editable editor above (a highlighted placeholder until hydrated), the chart below. */
  function upgrade(root) {
    root.querySelectorAll('pre[data-lang="dvl"]').forEach(function (pre) {
      var code = pre.textContent;
      var card = document.createElement("div");
      card.className = "dvl-example";
      card.dataset.dvlCode = code;

      var hint = document.createElement("span");
      hint.className = "dvl-example-hint";
      hint.textContent = "edits run live";

      var open = document.createElement("a");
      open.className = "dvl-example-open";
      open.href = openHref(code);
      open.target = "_blank";
      open.rel = "noopener";
      open.textContent = "Open in editor ↗";

      // the editor host — a highlighted <pre> placeholder shows the code until hydrate() swaps in
      // the live CodeMirror editor (on scroll into view).
      var host = document.createElement("div");
      host.className = "dvl-example-editor";
      var codePre = document.createElement("pre");
      var codeEl = document.createElement("code");
      codeEl.className = "lang-js";
      codeEl.textContent = code;
      codePre.appendChild(codeEl);
      host.appendChild(codePre);
      if (window.Prism) window.Prism.highlightElement(codeEl);

      var out = document.createElement("div");
      out.className = "dvl-example-output";
      out.innerHTML = '<div class="dvl-example-status">live example — runs when scrolled into view</div>';

      var head = document.createElement("div");
      head.className = "dvl-example-head";
      head.appendChild(hint);
      head.appendChild(open);
      card.appendChild(head);
      card.appendChild(host);
      card.appendChild(out);
      pre.replaceWith(card);
      io.observe(card);
    });
  }

  // Static site (no docsify): scan for ```dvl fences once the page is parsed. Each becomes an
  // editable, live-running example card.
  function run() { upgrade(document.querySelector(".markdown-section") || document.body); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
