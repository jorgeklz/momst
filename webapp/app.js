/* momst explorer: user interface for webapp/momst.js. */
(function () {
  "use strict";

  var M = window.momst;

  var VARIANTS = ["base", "PR", "PLS", "TS"];
  var LABELS = { base: "NSGA-II (base)", PR: "NSGA-II + Path Relinking", PLS: "NSGA-II + Pareto LS", TS: "NSGA-II + Tabu Search" };
  // UTM green and gold lead; the four hues pass colour-vision checks and each
  // variant also has its own marker shape.
  var COLORS = { base: "#2e8a1f", PR: "#c99a06", PLS: "#3a6fc4", TS: "#9b4f96" };
  var SHAPES = { base: "circle", PR: "triangle", PLS: "square", TS: "diamond" };
  var INK = { text: "#17220f", text2: "#55604a", text3: "#98a18d", border: "#e1e5db", surface2: "#f0f2ec", g1: "#1e6b14", g6: "#e2f2da" };
  var SVGNS = "http://www.w3.org/2000/svg";

  var state = {
    view: "front",
    instance: null,      // instance described by the form
    instanceError: null,
    uploaded: null,      // parsed uploaded instance
    run: null,           // { instance, lookup, order: [...], results: {v: {front, elapsed}}, log }
    worker: null,
    running: false
  };

  // ------------------------------------------------------------ helpers ---

  function $(id) { return document.getElementById(id); }
  function num(id) { return Number($(id).value); }
  function int(id) { return Math.round(Number($(id).value)); }

  function h(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  function s(tag, attrs, children) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function fmt(x, d) { return Number(x).toFixed(d === undefined ? 2 : d); }

  function niceTicks(lo, hi, count) {
    if (!(hi > lo)) { lo -= 1; hi += 1; }
    var span = hi - lo;
    var step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = (count * step) / span;
    if (err <= 0.15) step *= 10; else if (err <= 0.35) step *= 5; else if (err <= 0.75) step *= 2;
    var ticks = [];
    for (var t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) ticks.push(Math.round(t / step) * step);
    return ticks;
  }

  function scale(d0, d1, r0, r1) {
    var k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
    return function (v) { return r0 + (v - d0) * k; };
  }

  function marker(shape, x, y, r, fill) {
    var a = { fill: fill, stroke: "#fff", "stroke-width": 2 };
    if (shape === "circle") return s("circle", Object.assign({ cx: x, cy: y, r: r }, a));
    if (shape === "square") return s("rect", Object.assign({ x: x - r * 0.9, y: y - r * 0.9, width: r * 1.8, height: r * 1.8, rx: 1.5 }, a));
    if (shape === "triangle") {
      var t = r * 1.2;
      return s("path", Object.assign({ d: "M" + x + "," + (y - t) + "L" + (x + t) + "," + (y + t * 0.75) + "L" + (x - t) + "," + (y + t * 0.75) + "Z" }, a));
    }
    var dd = r * 1.25;
    return s("path", Object.assign({ d: "M" + x + "," + (y - dd) + "L" + (x + dd) + "," + y + "L" + x + "," + (y + dd) + "L" + (x - dd) + "," + y + "Z" }, a));
  }

  function markerIcon(v) {
    var svg = s("svg", { width: 14, height: 14, viewBox: "0 0 14 14", "aria-hidden": "true" });
    svg.appendChild(marker(SHAPES[v], 7, 7, 4.2, COLORS[v]));
    return svg;
  }

  function downloadCsv(name, header, rows) {
    var esc = function (v) { var t = String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    var text = [header.map(esc).join(",")].concat(rows.map(function (r) { return r.map(esc).join(","); })).join("\n") + "\n";
    var url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    var a = h("a", { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function table(headers, rows, numeric) {
    var thead = h("thead", null, [h("tr", null, headers.map(function (t, i) {
      return h("th", numeric && numeric[i] ? { class: "num" } : null, [t]);
    }))]);
    var tbody = h("tbody", null, rows.map(function (r) {
      var tr = h("tr", r.attrs || null, r.cells.map(function (c, i) {
        return h("td", numeric && numeric[i] ? { class: "num" } : null, [String(c)]);
      }));
      if (r.onclick) tr.addEventListener("click", r.onclick);
      return tr;
    }));
    return h("div", { class: "tabla-envoltura" }, [h("table", { class: "tabla" }, [thead, tbody])]);
  }

  function empty(title, text) {
    return h("div", { class: "vacio" }, [h("strong", { text: title }), h("span", { text: text })]);
  }

  // ----------------------------------------------------------- instance ---

  function parseInstance(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });
    if (lines.length < 2) throw new Error("The file is empty.");
    var sep = lines[0].indexOf(",") >= 0 ? "," : lines[0].indexOf(";") >= 0 ? ";" : /\s+/;
    var split = function (l) {
      return l.trim().split(sep).map(function (x) { return x.trim().replace(/^"(.*)"$/, "$1"); });
    };
    var head = split(lines[0]).map(function (x) { return x.toLowerCase(); });
    var iFrom = head.indexOf("from"), iTo = head.indexOf("to");
    var wCols = [];
    for (var k = 1; k <= 3; k++) { var j = head.indexOf("weight_" + k); if (j >= 0) wCols.push(j); else break; }
    if (iFrom < 0 || iTo < 0 || wCols.length < 2) {
      throw new Error("The file needs the columns 'from', 'to', 'weight_1', 'weight_2' (and optionally 'weight_3').");
    }
    var from = [], to = [], weights = wCols.map(function () { return []; });
    lines.slice(1).forEach(function (l, r) {
      var c = split(l);
      var a = Number(c[iFrom]), b = Number(c[iTo]);
      if (!Number.isInteger(a) || !Number.isInteger(b)) throw new Error("Row " + (r + 2) + ": 'from' and 'to' must be integers.");
      from.push(a); to.push(b);
      wCols.forEach(function (col, q) {
        var w = Number(c[col]);
        if (!isFinite(w)) throw new Error("Row " + (r + 2) + ": weight_" + (q + 1) + " is not a number.");
        weights[q].push(w);
      });
    });
    var n = Math.max.apply(null, from.concat(to));
    if (Math.min.apply(null, from.concat(to)) < 1) throw new Error("Node labels must start at 1.");
    if (n < 3) throw new Error("The graph needs at least 3 nodes.");
    if (n > 60) throw new Error("The web app accepts graphs of up to 60 nodes.");
    var need = n * (n - 1) / 2;
    if (from.length !== need) {
      throw new Error("A complete graph with " + n + " nodes needs " + need + " edges, the file has " + from.length + ".");
    }
    var seen = Object.create(null);
    for (var e = 0; e < from.length; e++) {
      var key = Math.min(from[e], to[e]) + "-" + Math.max(from[e], to[e]);
      if (from[e] === to[e] || seen[key]) throw new Error("Row " + (e + 2) + " repeats an edge or joins a node with itself.");
      seen[key] = true;
    }
    return { n: n, numObj: wCols.length, from: from, to: to, weights: weights };
  }

  function readInstance() {
    if (document.querySelector("input[name=inst_src]:checked").value === "upload") {
      if (!state.uploaded) throw new Error("Choose an edge list file first.");
      return state.uploaded;
    }
    var n = int("n");
    if (!(n >= 3 && n <= 60)) throw new Error("Nodes must be between 3 and 60.");
    var numObj = int("num_obj");
    var ranges = [[num("a_min"), num("a_max")], [num("b_min"), num("b_max")], [num("c_min"), num("c_max")]];
    for (var k = 0; k < numObj; k++) {
      if (!isFinite(ranges[k][0]) || !isFinite(ranges[k][1]) || ranges[k][1] < ranges[k][0]) {
        throw new Error("The weight range of objective " + (k + 1) + " must go from a smaller to a larger number.");
      }
    }
    var seed = int("inst_seed");
    if (!Number.isFinite(seed)) throw new Error("The instance seed must be an integer.");
    return M.generateInstance(n, numObj, ranges[0], ranges[1], ranges[2], seed);
  }

  function refreshInstance() {
    try {
      state.instance = readInstance();
      state.instanceError = null;
    } catch (e) {
      state.instance = null;
      state.instanceError = e.message;
    }
    renderKpis();
    if (state.view === "instance") renderInstance();
  }

  // --------------------------------------------------------------- run ---

  function readParams() {
    var p = {
      iterations: int("iterations"), popSize: int("pop_size"), maxGenerations: int("max_generations"),
      seed: int("seed"), crossRate: num("cross_rate"), mutRate: num("mut_rate"),
      tourSize: int("tour_size"), convergenceWindow: int("convergence_window")
    };
    if (!(p.iterations >= 1 && p.iterations <= 30)) throw new Error("Independent runs must be between 1 and 30.");
    if (!(p.popSize >= 4 && p.popSize <= 200) || p.popSize % 2 !== 0) throw new Error("Population size must be an even number between 4 and 200.");
    if (!(p.maxGenerations >= 1 && p.maxGenerations <= 500)) throw new Error("Max generations must be between 1 and 500.");
    if (!Number.isFinite(p.seed)) throw new Error("The solver seed must be an integer.");
    if (!(p.crossRate >= 0 && p.crossRate <= 1) || !(p.mutRate >= 0 && p.mutRate <= 1)) throw new Error("Rates must be between 0 and 1.");
    if (!(p.tourSize >= 2 && p.tourSize <= 10)) throw new Error("Tournament size must be between 2 and 10.");
    if (!(p.convergenceWindow >= 2 && p.convergenceWindow <= 100)) throw new Error("Convergence window must be between 2 and 100.");
    return p;
  }

  function showError(msg) {
    var e = $("error");
    e.textContent = msg || "";
    e.hidden = !msg;
  }

  function setRunning(on) {
    state.running = on;
    $("run").disabled = on;
    $("cancel").hidden = !on;
    $("progreso").hidden = !on;
    if (on) $("progreso").firstElementChild.style.width = "0%";
  }

  function startRun(event) {
    if (event) event.preventDefault();
    showError(null);
    var variants = VARIANTS.filter(function (v) { return document.querySelector("input[name=variant][value=" + v + "]").checked; });
    var instance, params;
    try {
      if (variants.length === 0) throw new Error("Select at least one variant.");
      instance = readInstance();
      params = readParams();
    } catch (e) {
      showError(e.message);
      return;
    }
    var pending = { instance: instance, lookup: M.buildLookup(instance), order: [], results: {}, log: [], params: params };
    var total = variants.length * params.iterations * params.maxGenerations;
    setRunning(true);
    $("estado").textContent = "Starting...";

    function onMessage(msg) {
      if (msg.type === "progress") {
        var done = msg.index * params.iterations * params.maxGenerations + (msg.iteration - 1) * params.maxGenerations + msg.generation;
        $("progreso").firstElementChild.style.width = Math.min(100, (100 * done) / total).toFixed(1) + "%";
        $("estado").textContent = "Running " + msg.variant + " (" + (msg.index + 1) + " of " + variants.length + "), run " +
          msg.iteration + ", generation " + msg.generation;
      } else if (msg.type === "result") {
        var front = msg.result.globalPareto.slice().sort(function (a, b) { return a.obj[0] - b.obj[0]; });
        pending.order.push(msg.variant);
        pending.results[msg.variant] = { front: front, elapsed: msg.result.elapsed };
        pending.log = pending.log.concat(msg.log);
      } else if (msg.type === "done") {
        finish(pending);
      } else if (msg.type === "error") {
        stopWorker();
        setRunning(false);
        $("estado").textContent = "";
        showError("The solver stopped: " + msg.message);
      }
    }

    var job = { instance: instance, variants: variants, params: params };
    var worker = null;
    try { worker = new Worker("worker.js"); } catch (e) { worker = null; }
    if (worker) {
      state.worker = worker;
      worker.onmessage = function (ev) { onMessage(ev.data); };
      worker.onerror = function (ev) {
        ev.preventDefault();
        stopWorker();
        runInPage(job, onMessage);
      };
      worker.postMessage(job);
    } else {
      runInPage(job, onMessage);
    }
  }

  // Fallback when Web Workers are not available (for example file:// pages).
  function runInPage(job, onMessage) {
    setTimeout(function () {
      try {
        job.variants.forEach(function (v, index) {
          var lines = [];
          var res = M.runMomst(job.instance, Object.assign({}, job.params, { variant: v, log: function (l) { lines.push(l); } }));
          onMessage({ type: "result", variant: v, index: index, result: res, log: lines });
        });
        onMessage({ type: "done" });
      } catch (e) {
        onMessage({ type: "error", message: e.message });
      }
    }, 30);
  }

  function stopWorker() {
    if (state.worker) { state.worker.terminate(); state.worker = null; }
  }

  function cancelRun() {
    stopWorker();
    setRunning(false);
    $("estado").textContent = "Run cancelled.";
  }

  function finish(pending) {
    stopWorker();
    setRunning(false);
    state.run = pending;
    $("estado").textContent = "Done in " + pending.order.reduce(function (t, v) { return t + pending.results[v].elapsed; }, 0).toFixed(2) + " s.";
    ["tree_variant", "table_variant"].forEach(function (id) {
      var sel = $(id);
      sel.innerHTML = "";
      pending.order.forEach(function (v) { sel.appendChild(h("option", { value: v, text: v })); });
    });
    $("log").textContent = pending.log.join("\n");
    renderAll();
    revealResults($("kpis"));
  }

  // ------------------------------------------------------------- render ---

  function renderAll() {
    renderKpis();
    renderView();
  }

  function renderKpis() {
    var box = $("kpis");
    box.innerHTML = "";
    var inst = state.run ? state.run.instance : state.instance;
    if (inst) {
      box.appendChild(kpi(String(inst.n), null, "Nodes", (inst.n * (inst.n - 1) / 2) + " edges, complete graph", null, "kpi-instancia"));
      box.appendChild(kpi(String(inst.numObj), null, "Objectives", state.run ? "instance of the last run" : "current instance", null, "kpi-instancia"));
    }
    if (state.run) {
      state.run.order.forEach(function (v) {
        var r = state.run.results[v];
        box.appendChild(kpi(String(r.front.length), "solutions", LABELS[v], fmt(r.elapsed) + " s", v));
      });
    }
  }

  function kpi(value, unit, label, note, variant, cls) {
    return h("div", { class: "tarjeta kpi " + (cls || "") }, [
      h("div", { class: "kpi-valor" }, [value, unit ? h("small", { text: unit }) : null]),
      h("div", { class: "kpi-etiqueta" }, [variant ? markerIcon(variant) : null, label]),
      note ? h("div", { class: "kpi-nota", text: note }) : null
    ]);
  }

  function renderView() {
    var v = state.view;
    if (v === "front") renderFront();
    else if (v === "tree") renderTree();
    else if (v === "solutions") renderSolutions();
    else if (v === "compare") renderCompare();
    else if (v === "instance") renderInstance();
  }

  function needRun(box) {
    if (state.run) return false;
    box.innerHTML = "";
    box.appendChild(empty("No results yet", "Set the parameters above and press Run solver."));
    return true;
  }

  // Pareto front -----------------------------------------------------------

  function renderFront() {
    var box = $("front");
    if (needRun(box)) return;
    box.innerHTML = "";
    var run = state.run;
    if (run.order.length > 1) {
      box.appendChild(h("div", { class: "leyenda" }, run.order.map(function (v) {
        return h("span", null, [markerIcon(v), v]);
      })));
    }
    if (run.instance.numObj === 2) {
      box.appendChild(frontChart(run, 0, 1, Math.max(300, box.clientWidth), window.innerWidth < 640 ? 320 : 430, true));
    } else {
      var grid = h("div", { class: "cuadricula fila-graficos" });
      [[0, 1], [0, 2], [1, 2]].forEach(function (p) {
        var cell = h("div", { class: "panel-grafico" }, [h("div", { class: "titulo-grafico", text: "Objective " + (p[0] + 1) + " vs objective " + (p[1] + 1) })]);
        grid.appendChild(cell);
      });
      box.appendChild(grid);
      var w = Math.max(260, grid.firstChild.clientWidth || 300);
      [[0, 1], [0, 2], [1, 2]].forEach(function (p, i) {
        grid.children[i].appendChild(frontChart(run, p[0], p[1], w, 300, false));
      });
    }
  }

  function frontChart(run, ix, iy, width, height, steps) {
    var m = { l: 58, r: 14, t: 10, b: 46 };
    var all = [];
    run.order.forEach(function (v) { run.results[v].front.forEach(function (it) { all.push(it.obj); }); });
    var xs = all.map(function (o) { return o[ix]; }), ys = all.map(function (o) { return o[iy]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var px = (x1 - x0) * 0.04 || 1, py = (y1 - y0) * 0.06 || 1;
    x0 -= px; x1 += px; y0 -= py; y1 += py;
    var sx = scale(x0, x1, m.l, width - m.r), sy = scale(y0, y1, height - m.b, m.t);
    var svg = s("svg", { viewBox: "0 0 " + width + " " + height, width: "100%", class: "grafico", role: "img",
      "aria-label": "Pareto front, objective " + (ix + 1) + " against objective " + (iy + 1) });
    var grid = s("g");
    niceTicks(x0, x1, width < 420 ? 4 : 7).forEach(function (t) {
      if (t < x0 || t > x1) return;
      grid.appendChild(s("line", { x1: sx(t), x2: sx(t), y1: m.t, y2: height - m.b, stroke: INK.surface2 }));
      grid.appendChild(s("text", { x: sx(t), y: height - m.b + 18, "text-anchor": "middle", class: "eje", text: String(t) }));
    });
    niceTicks(y0, y1, 5).forEach(function (t) {
      if (t < y0 || t > y1) return;
      grid.appendChild(s("line", { x1: m.l, x2: width - m.r, y1: sy(t), y2: sy(t), stroke: INK.surface2 }));
      grid.appendChild(s("text", { x: m.l - 8, y: sy(t) + 4, "text-anchor": "end", class: "eje", text: String(t) }));
    });
    grid.appendChild(s("line", { x1: m.l, x2: width - m.r, y1: height - m.b, y2: height - m.b, stroke: INK.border }));
    grid.appendChild(s("line", { x1: m.l, x2: m.l, y1: m.t, y2: height - m.b, stroke: INK.border }));
    grid.appendChild(s("text", { x: (m.l + width - m.r) / 2, y: height - 8, "text-anchor": "middle", class: "eje-titulo", text: "Objective " + (ix + 1) }));
    grid.appendChild(s("text", { x: 14, y: (m.t + height - m.b) / 2, "text-anchor": "middle", class: "eje-titulo",
      transform: "rotate(-90 14 " + (m.t + height - m.b) / 2 + ")", text: "Objective " + (iy + 1) }));
    svg.appendChild(grid);

    run.order.forEach(function (v) {
      var front = run.results[v].front;
      if (steps && front.length > 1) {
        var d = "M" + sx(front[0].obj[ix]) + "," + sy(front[0].obj[iy]);
        for (var i = 1; i < front.length; i++) {
          d += "H" + sx(front[i].obj[ix]) + "V" + sy(front[i].obj[iy]);
        }
        svg.appendChild(s("path", { d: d, fill: "none", stroke: COLORS[v], "stroke-width": 2, "stroke-opacity": 0.85 }));
      }
    });
    run.order.forEach(function (v) {
      var g = s("g");
      run.results[v].front.forEach(function (it, i) {
        var cx = sx(it.obj[ix]), cy = sy(it.obj[iy]);
        var mk = marker(SHAPES[v], cx, cy, 5, COLORS[v]);
        var hit = s("circle", { cx: cx, cy: cy, r: 11, fill: "transparent", class: "punto-activo", tabindex: 0,
          "aria-label": v + " row " + (i + 1) + ": " + it.obj.map(function (o) { return fmt(o); }).join(", ") });
        var tip = function (ev) {
          mk.setAttribute("stroke", INK.text);
          showTip(ev, [h("strong", null, [markerIcon(v), " " + v + ", row " + (i + 1)])].concat(it.obj.map(function (o, k) {
            return h("div", { text: "Objective " + (k + 1) + ": " + fmt(o) });
          })).concat([h("div", { class: "tip-nota", text: "Click to draw its tree" })]));
        };
        var off = function () { mk.setAttribute("stroke", "#fff"); hideTip(); };
        hit.addEventListener("mousemove", tip);
        hit.addEventListener("focus", function (ev) { tip({ clientX: ev.target.getBoundingClientRect().left + 10, clientY: ev.target.getBoundingClientRect().top }); });
        hit.addEventListener("mouseleave", off);
        hit.addEventListener("blur", off);
        var go = function () { hideTip(); openTree(v, i + 1); };
        hit.addEventListener("click", go);
        hit.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } });
        g.appendChild(mk);
        g.appendChild(hit);
      });
      svg.appendChild(g);
    });
    return svg;
  }

  function showTip(ev, content) {
    var t = $("tooltip");
    t.innerHTML = "";
    content.forEach(function (c) { t.appendChild(c); });
    t.hidden = false;
    var w = t.offsetWidth, hgt = t.offsetHeight;
    var x = ev.clientX + 14, y = ev.clientY - hgt - 10;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - 14;
    if (y < 8) y = ev.clientY + 16;
    t.style.left = x + "px";
    t.style.top = y + "px";
  }

  function hideTip() { $("tooltip").hidden = true; }

  function openTree(variant, row) {
    $("tree_variant").value = variant;
    document.querySelector("input[name=tree_pick][value=row]").checked = true;
    $("tree_row").value = row;
    setView("tree", true);
  }

  // Spanning tree -------------------------------------------------------------

  function selectedSolution() {
    var run = state.run;
    var v = $("tree_variant").value || run.order[0];
    var front = run.results[v].front;
    var pick = document.querySelector("input[name=tree_pick]:checked").value;
    $("campo-fila").hidden = pick !== "row";
    $("tree_row").max = front.length;
    var idx;
    if (pick === "row") {
      var r = int("tree_row");
      if (!(r >= 1 && r <= front.length)) return { error: "Row must be between 1 and " + front.length + "." };
      idx = r - 1;
    } else {
      var M2 = run.instance.numObj;
      var mins = [], rng = [];
      for (var k = 0; k < M2; k++) {
        var vals = front.map(function (it) { return it.obj[k]; });
        mins.push(Math.min.apply(null, vals));
        rng.push(Math.max.apply(null, vals) - mins[k] || 1);
      }
      var best = Infinity;
      front.forEach(function (it, i) {
        var sc = 0;
        for (var k2 = 0; k2 < M2; k2++) sc += pick === "sum" ? it.obj[k2] : (it.obj[k2] - mins[k2]) / rng[k2];
        if (sc < best) { best = sc; idx = i; }
      });
    }
    return { variant: v, row: idx + 1, item: front[idx] };
  }

  function treeLayout(edges, n) {
    var adj = [];
    for (var i = 0; i <= n; i++) adj.push([]);
    edges.forEach(function (e) { adj[e[0]].push(e[1]); adj[e[1]].push(e[0]); });
    var root = 1;
    for (i = 2; i <= n; i++) if (adj[i].length > adj[root].length) root = i;
    var x = new Array(n + 1), y = new Array(n + 1), next = 0;
    (function place(v, parent, depth) {
      y[v] = depth;
      var kids = [];
      adj[v].forEach(function (k) { if (k !== parent && kids.indexOf(k) < 0) kids.push(k); });
      if (kids.length === 0) { x[v] = next++; return; }
      kids.forEach(function (k) { place(k, v, depth + 1); });
      x[v] = kids.reduce(function (t, k) { return t + x[k]; }, 0) / kids.length;
    })(root, 0, 0);
    return { x: x, y: y };
  }

  function renderTree() {
    var box = $("tree");
    var title = $("tree_title");
    var edgesBox = $("tree_edges");
    if (needRun(box)) { title.textContent = ""; edgesBox.innerHTML = ""; return; }
    var run = state.run;
    var sel = selectedSolution();
    box.innerHTML = "";
    edgesBox.innerHTML = "";
    if (sel.error) { title.textContent = ""; box.appendChild(empty("Row out of range", sel.error)); return; }
    var n = run.instance.n;
    var edges = M.decodePrufer(sel.item.chr, n);
    var L = run.lookup;
    var weightOf = function (e, k) { return L[k][(e[0] - 1) * n + (e[1] - 1)]; };

    title.innerHTML = "";
    title.appendChild(markerIcon(sel.variant));
    title.appendChild(h("span", { class: "fuerte", text: sel.variant + ", row " + sel.row }));
    title.appendChild(h("span", { class: "suave", text: sel.item.obj.map(function (o, k) { return "objective " + (k + 1) + " = " + fmt(o); }).join("  ·  ") }));

    edgesBox.appendChild(table(["From", "To"].concat(L.map(function (_, k) { return "w" + (k + 1); })),
      edges.map(function (e) { return { cells: [e[0], e[1]].concat(L.map(function (_, k) { return fmt(weightOf(e, k)); })) }; }),
      [true, true, true, true, true]));

    var lay = treeLayout(edges, n);
    var maxX = Math.max.apply(null, lay.x.slice(1)), maxY = Math.max.apply(null, lay.y.slice(1));
    var width = Math.max(320, box.clientWidth || 600);
    var height = Math.max(320, Math.min(640, 110 + maxY * 95));
    var pad = 34;
    var sx = scale(0, Math.max(1, maxX), pad, width - pad);
    var sy = scale(0, Math.max(1, maxY), pad, height - pad);
    if (maxX === 0) sx = function () { return width / 2; };
    var svg = s("svg", { viewBox: "0 0 " + width + " " + height, width: "100%", class: "grafico", role: "img",
      "aria-label": "Spanning tree with " + n + " nodes" });
    edges.forEach(function (e) {
      svg.appendChild(s("line", { x1: sx(lay.x[e[0]]), y1: sy(lay.y[e[0]]), x2: sx(lay.x[e[1]]), y2: sy(lay.y[e[1]]), stroke: INK.text3, "stroke-width": 2 }));
    });
    if ($("show_weights").checked) {
      var fs = L.length > 2 ? 10 : 11;
      edges.forEach(function (e) {
        var up = lay.y[e[0]] < lay.y[e[1]] ? e[0] : e[1];
        var dn = up === e[0] ? e[1] : e[0];
        var mx = sx(lay.x[up]) + 0.62 * (sx(lay.x[dn]) - sx(lay.x[up]));
        var my = sy(lay.y[up]) + 0.62 * (sy(lay.y[dn]) - sy(lay.y[up]));
        var label = "(" + L.map(function (_, k) { return String(Math.round(weightOf(e, k) * 10) / 10); }).join(", ") + ")";
        var w = label.length * fs * 0.56 + 6;
        svg.appendChild(s("rect", { x: mx - w / 2, y: my - fs * 0.75, width: w, height: fs * 1.5, rx: 4, fill: "#fff" }));
        svg.appendChild(s("text", { x: mx, y: my + fs * 0.36, "text-anchor": "middle", class: "peso", "font-size": fs, text: label }));
      });
    }
    var r = n <= 20 ? 12 : n <= 40 ? 10 : 8;
    for (var v = 1; v <= n; v++) {
      svg.appendChild(s("circle", { cx: sx(lay.x[v]), cy: sy(lay.y[v]), r: r, fill: INK.g6, stroke: INK.g1, "stroke-width": 1.6 }));
      svg.appendChild(s("text", { x: sx(lay.x[v]), y: sy(lay.y[v]) + 4, "text-anchor": "middle", class: "nodo", "font-size": n <= 40 ? 11 : 9, text: String(v) }));
    }
    box.appendChild(svg);
  }

  // Pareto solutions ----------------------------------------------------------

  function solutionRows() {
    var run = state.run;
    var v = $("table_variant").value || run.order[0];
    return { variant: v, rows: run.results[v].front.map(function (it, i) { return { row: i + 1, obj: it.obj, chr: it.chr.join("-") }; }) };
  }

  function renderSolutions() {
    var box = $("front_table");
    if (needRun(box)) return;
    box.innerHTML = "";
    var data = solutionRows();
    var k = state.run.instance.numObj;
    var headers = ["Row"].concat(Array.from({ length: k }, function (_, i) { return "Objective " + (i + 1); })).concat(["Prufer sequence"]);
    var numeric = [true, true, true, k === 3, false];
    box.appendChild(table(headers, data.rows.map(function (r) {
      return {
        cells: [r.row].concat(r.obj.map(function (o) { return fmt(o, 3); })).concat([r.chr]),
        attrs: { class: "fila-enlace", title: "Draw this spanning tree" },
        onclick: function () { openTree(data.variant, r.row); }
      };
    }), numeric));
  }

  // Variant comparison --------------------------------------------------------

  function hypervolume2d(obj, ref) {
    var pts = obj.filter(function (o) { return o[0] < ref[0] && o[1] < ref[1]; })
      .sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var hv = 0, bestY = ref[1];
    pts.forEach(function (o) {
      if (o[1] < bestY) { hv += (ref[0] - o[0]) * (bestY - o[1]); bestY = o[1]; }
    });
    return hv;
  }

  function renderCompare() {
    var box = $("compare_table");
    var plot = $("time_plot");
    if (needRun(box)) { plot.innerHTML = ""; return; }
    box.innerHTML = "";
    plot.innerHTML = "";
    var run = state.run, k = run.instance.numObj;
    var fronts = run.order.map(function (v) { return run.results[v].front.map(function (it) { return it.obj; }); });
    var ref = null;
    if (k === 2) {
      var all = [].concat.apply([], fronts);
      ref = [0, 1].map(function (j) { return Math.max.apply(null, all.map(function (o) { return o[j]; })) * 1.1; });
    }
    $("hv_note").hidden = k !== 2;
    var headers = ["Variant", "Solutions", "Seconds"].concat(Array.from({ length: k }, function (_, i) { return "Min objective " + (i + 1); }));
    if (k === 2) headers.push("Hypervolume");
    box.appendChild(table(headers, run.order.map(function (v, i) {
      var f = fronts[i];
      var cells = [v, f.length, fmt(run.results[v].elapsed)];
      for (var j = 0; j < k; j++) cells.push(fmt(Math.min.apply(null, f.map(function (o) { return o[j]; }))));
      if (k === 2) cells.push(fmt(hypervolume2d(f, ref)));
      return { cells: cells };
    }), headers.map(function (_, i) { return i > 0; })));

    var width = Math.max(300, plot.clientWidth || 600);
    var rowH = 34, m = { l: 56, r: 64, t: 6, b: 8 };
    var height = m.t + m.b + rowH * run.order.length;
    var maxT = Math.max.apply(null, run.order.map(function (v) { return run.results[v].elapsed; })) || 1;
    var sx = scale(0, maxT, m.l, width - m.r);
    var svg = s("svg", { viewBox: "0 0 " + width + " " + height, width: "100%", class: "grafico", role: "img", "aria-label": "Runtime per variant" });
    run.order.forEach(function (v, i) {
      var t = run.results[v].elapsed;
      var y = m.t + i * rowH + 6;
      var w = Math.max(4, sx(t) - m.l);
      svg.appendChild(s("text", { x: m.l - 10, y: y + 15, "text-anchor": "end", class: "eje", text: v }));
      svg.appendChild(s("rect", { x: m.l, y: y, width: w, height: 22, rx: 4, fill: COLORS[v] }));
      svg.appendChild(s("text", { x: m.l + w + 8, y: y + 15, class: "eje", text: fmt(t) + " s" }));
    });
    plot.appendChild(svg);
  }

  // Instance ------------------------------------------------------------------

  function renderInstance() {
    var box = $("inst_table");
    box.innerHTML = "";
    var inst = state.instance;
    if (!inst) {
      $("inst_title").textContent = "Instance";
      box.appendChild(empty("No instance", state.instanceError || "Set the instance parameters above."));
      return;
    }
    $("inst_title").textContent = "Instance: " + inst.n + " nodes, " + inst.from.length + " edges";
    var headers = ["From", "To"].concat(inst.weights.map(function (_, k) { return "weight_" + (k + 1); }));
    box.appendChild(table(headers, inst.from.map(function (f, i) {
      return { cells: [f, inst.to[i]].concat(inst.weights.map(function (w) { return fmt(w[i]); })) };
    }), headers.map(function () { return true; })));
  }

  // -------------------------------------------------------------- views ---

  // Bring the results into view when they start below the visible area.
  function revealResults(target) {
    var el = target || document.querySelector(".resultados");
    if (!el) return;
    var top = el.getBoundingClientRect().top;
    if (top > window.innerHeight * 0.55 || top < 0) {
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }

  function setView(view, reveal) {
    state.view = view;
    document.querySelectorAll(".pestana").forEach(function (b) {
      var on = b.getAttribute("data-view") === view;
      b.classList.toggle("activa", on);
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll(".vista").forEach(function (sec) { sec.hidden = sec.getAttribute("data-view") !== view; });
    hideTip();
    renderView();
    if (reveal) revealResults();
  }

  // --------------------------------------------------------------- init ---

  function init() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".pestana"));
    tabs.forEach(function (b, i) {
      b.addEventListener("click", function () { setView(b.getAttribute("data-view")); });
      // Arrow keys move between tabs (WAI-ARIA tabs pattern).
      b.addEventListener("keydown", function (ev) {
        var j = ev.key === "ArrowRight" ? i + 1 : ev.key === "ArrowLeft" ? i - 1 : ev.key === "Home" ? 0 : ev.key === "End" ? tabs.length - 1 : null;
        if (j === null) return;
        ev.preventDefault();
        var t = tabs[(j + tabs.length) % tabs.length];
        t.focus();
        setView(t.getAttribute("data-view"));
      });
    });

    $("form").addEventListener("submit", startRun);
    $("cancel").addEventListener("click", cancelRun);

    document.querySelectorAll("input[name=inst_src]").forEach(function (r) {
      r.addEventListener("change", function () {
        var up = r.value === "upload" && r.checked;
        if (!r.checked) return;
        $("campos-random").hidden = up;
        $("campos-upload").hidden = !up;
        refreshInstance();
      });
    });
    $("num_obj").addEventListener("change", function () { $("campo-c").hidden = $("num_obj").value !== "3"; refreshInstance(); });
    ["n", "inst_seed", "a_min", "a_max", "b_min", "b_max", "c_min", "c_max"].forEach(function (id) {
      $(id).addEventListener("change", refreshInstance);
    });
    $("inst_file").addEventListener("change", function () {
      var f = $("inst_file").files[0];
      state.uploaded = null;
      if (!f) { $("archivo-estado").textContent = ""; refreshInstance(); return; }
      f.text().then(function (text) {
        try {
          state.uploaded = parseInstance(text);
          $("archivo-estado").textContent = "Loaded " + f.name + ": " + state.uploaded.n + " nodes, " + state.uploaded.numObj + " objectives.";
          showError(null);
        } catch (e) {
          $("archivo-estado").textContent = "";
          showError(e.message);
        }
        refreshInstance();
      });
    });

    $("tree_variant").addEventListener("change", renderTree);
    document.querySelectorAll("input[name=tree_pick]").forEach(function (r) { r.addEventListener("change", renderTree); });
    $("tree_row").addEventListener("input", renderTree);
    $("show_weights").addEventListener("change", renderTree);
    $("table_variant").addEventListener("change", renderSolutions);

    $("dl_front").addEventListener("click", function () {
      if (!state.run) return;
      var data = solutionRows();
      var k = state.run.instance.numObj;
      downloadCsv("momst_pareto_" + data.variant + ".csv",
        ["row"].concat(Array.from({ length: k }, function (_, i) { return "objective_" + (i + 1); })).concat(["prufer"]),
        data.rows.map(function (r) { return [r.row].concat(r.obj).concat([r.chr]); }));
    });
    $("dl_inst").addEventListener("click", function () {
      var inst = state.instance;
      if (!inst) return;
      downloadCsv("momst_instance_n" + inst.n + "_obj" + inst.numObj + ".csv",
        ["from", "to"].concat(inst.weights.map(function (_, k) { return "weight_" + (k + 1); })),
        inst.from.map(function (f, i) { return [f, inst.to[i]].concat(inst.weights.map(function (w) { return w[i]; })); }));
    });

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (state.run) renderView(); }, 150);
    });

    // An earlier version of this page ran on shinylive and registered a
    // Service Worker here; it is no longer needed.
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) {
          var sw = r.active || r.waiting || r.installing;
          if (sw && /shinylive-sw\.js$/.test(sw.scriptURL)) r.unregister();
        });
      }).catch(function () {});
    }

    document.querySelectorAll(".marca").forEach(function (i) { i.appendChild(markerIcon(i.getAttribute("data-v"))); });
    $("campo-c").hidden = true;
    refreshInstance();
    setView("front");
  }

  init();
})();
