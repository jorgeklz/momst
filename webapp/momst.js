/*
 * momst.js
 *
 * JavaScript port of the momst R package solver (NSGA-II with Prufer encoding
 * and optional Pareto local search) for the web app published on GitHub Pages.
 *
 * The port follows R/run_momst.R and its helpers line by line, including R's
 * random number generator (Mersenne-Twister with set.seed() scrambling,
 * runif() and the rejection sampling used by sample.int()). With the same
 * instance, parameters and seed it returns the same Pareto front as
 * momst::run_momst(). webapp/test/check-against-r.js verifies this against
 * the installed R package.
 *
 * Works as a classic script (browser, Web Worker via importScripts) and as a
 * CommonJS module (Node).
 */
(function (root) {
  "use strict";

  // ------------------------------------------------------------------ RNG ---

  // R's default RNG: Mersenne-Twister, "Inversion" normals, "Rejection" sample.
  var MT_N = 624;
  var MT_M = 397;
  var UPPER_MASK = 0x80000000;
  var LOWER_MASK = 0x7fffffff;
  var MATRIX_A = 0x9908b0df;
  var I2_32M1 = 2.328306437080797e-10; // 1 / (2^32 - 1)

  function RRandom(seed) {
    // dummy[0] holds mti, dummy[1..624] the state, as in R's RNG.c.
    this.dummy = new Uint32Array(MT_N + 1);
    this.setSeed(seed);
  }

  RRandom.prototype.setSeed = function (seed) {
    var s = seed >>> 0;
    var j;
    for (j = 0; j < 50; j++) s = (Math.imul(69069, s) + 1) >>> 0;
    for (j = 0; j < MT_N + 1; j++) {
      s = (Math.imul(69069, s) + 1) >>> 0;
      this.dummy[j] = s;
    }
    this.dummy[0] = MT_N; // FixupSeeds(initial = TRUE)
  };

  RRandom.prototype.mtGenrand = function () {
    var d = this.dummy;
    var mti = d[0];
    var y, kk;
    if (mti >= MT_N) {
      for (kk = 0; kk < MT_N - MT_M; kk++) {
        y = ((d[kk + 1] & UPPER_MASK) | (d[kk + 2] & LOWER_MASK)) >>> 0;
        d[kk + 1] = (d[kk + MT_M + 1] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0)) >>> 0;
      }
      for (; kk < MT_N - 1; kk++) {
        y = ((d[kk + 1] & UPPER_MASK) | (d[kk + 2] & LOWER_MASK)) >>> 0;
        d[kk + 1] = (d[kk + (MT_M - MT_N) + 1] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0)) >>> 0;
      }
      y = ((d[MT_N] & UPPER_MASK) | (d[1] & LOWER_MASK)) >>> 0;
      d[MT_N] = (d[MT_M] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0)) >>> 0;
      mti = 0;
    }
    y = d[mti + 1];
    mti++;
    y = (y ^ (y >>> 11)) >>> 0;
    y = (y ^ ((y << 7) & 0x9d2c5680)) >>> 0;
    y = (y ^ ((y << 15) & 0xefc60000)) >>> 0;
    y = (y ^ (y >>> 18)) >>> 0;
    d[0] = mti;
    return y * 2.3283064365386963e-10;
  };

  RRandom.prototype.unifRand = function () {
    var x = this.mtGenrand();
    if (x <= 0) return 0.5 * I2_32M1;
    if (1 - x <= 0) return 1 - 0.5 * I2_32M1;
    return x;
  };

  // runif(1, a, b)
  RRandom.prototype.runif = function (a, b) {
    if (a === b) return a;
    var u;
    do { u = this.unifRand(); } while (u <= 0 || u >= 1);
    return a + (b - a) * u;
  };

  RRandom.prototype.rbits = function (bits) {
    var v = 0;
    for (var n = 0; n <= bits; n += 16) {
      var v1 = Math.floor(this.unifRand() * 65536);
      v = 65536 * v + v1;
    }
    return v % Math.pow(2, bits);
  };

  // R_unif_index(dn), sample.kind = "Rejection"
  RRandom.prototype.unifIndex = function (dn) {
    if (dn <= 0) return 0;
    var bits = Math.ceil(Math.log2(dn));
    var dv;
    do { dv = this.rbits(bits); } while (dn <= dv);
    return dv;
  };

  // sample.int(n, size, replace = TRUE); also sample.int(n, 1)
  RRandom.prototype.sampleInt = function (n, size) {
    var out = new Array(size);
    for (var i = 0; i < size; i++) out[i] = this.unifIndex(n) + 1;
    return out;
  };

  // ------------------------------------------------------------- helpers ---

  // Correctly rounded floating point sum (Shewchuk / Python's fsum). R's sum()
  // and rowSums() accumulate in long double, so this matches R's results.
  function fsum(values) {
    var partials = [];
    var i, j, x, y, t, hi, lo;
    for (i = 0; i < values.length; i++) {
      x = values[i];
      var k = 0;
      for (j = 0; j < partials.length; j++) {
        y = partials[j];
        if (Math.abs(x) < Math.abs(y)) { t = x; x = y; y = t; }
        hi = x + y;
        lo = y - (hi - x);
        if (lo !== 0) partials[k++] = lo;
        x = hi;
      }
      partials.length = k;
      partials.push(x);
    }
    var total = 0;
    if (partials.length > 0) {
      var n = partials.length - 1;
      hi = partials[n];
      lo = 0;
      while (n > 0) {
        x = hi;
        y = partials[--n];
        hi = x + y;
        var yr = hi - x;
        lo = y - yr;
        if (lo !== 0) break;
      }
      if (n > 0 && ((lo < 0 && partials[n - 1] < 0) || (lo > 0 && partials[n - 1] > 0))) {
        y = lo * 2;
        x = hi + y;
        if (y === x - hi) hi = x;
      }
      total = hi;
    }
    if (!isFinite(total)) {
      total = 0;
      for (i = 0; i < values.length; i++) total += values[i];
    }
    return total;
  }

  function rowKey(r) { return r.join("_"); }

  function sameRow(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // unique() for a matrix: keeps the first occurrence of each row.
  function uniqueRows(rows) {
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var k = rowKey(rows[i]);
      if (!seen[k]) { seen[k] = true; out.push(rows[i]); }
    }
    return out;
  }

  function rowInMatrix(r, m) {
    for (var i = 0; i < m.length; i++) if (sameRow(r, m[i])) return true;
    return false;
  }

  // Stable order() of numbers (ties keep their original position).
  function orderBy(values) {
    var idx = values.map(function (_, i) { return i; });
    idx.sort(function (a, b) {
      if (values[a] < values[b]) return -1;
      if (values[a] > values[b]) return 1;
      return a - b;
    });
    return idx;
  }

  // ------------------------------------------------------------ instance ---

  // generate_instance(): complete graph, one uniform weight per objective.
  function generateInstance(n, numObj, rangeA, rangeB, rangeC, seed) {
    if (numObj !== 2 && numObj !== 3) throw new Error("num_obj must be 2 or 3.");
    if (n < 3) throw new Error("n must be at least 3.");
    var rng = new RRandom(seed);
    var from = [], to = [];
    for (var i = 1; i < n; i++) {
      for (var j = i + 1; j <= n; j++) { from.push(i); to.push(j); }
    }
    var e = from.length;
    var ranges = [rangeA, rangeB, rangeC];
    var weights = [];
    for (var k = 0; k < numObj; k++) {
      var w = new Array(e);
      for (var q = 0; q < e; q++) w[q] = rng.runif(ranges[k][0], ranges[k][1]);
      weights.push(w);
    }
    return { n: n, numObj: numObj, from: from, to: to, weights: weights };
  }

  // build_weight_lookup(): one dense n x n matrix per objective.
  function buildLookup(instance) {
    var n = instance.n;
    return instance.weights.map(function (w) {
      var L = new Float64Array(n * n);
      for (var q = 0; q < w.length; q++) {
        var a = instance.from[q] - 1, b = instance.to[q] - 1;
        L[a * n + b] = w[q];
        L[b * n + a] = w[q];
      }
      return L;
    });
  }

  // --------------------------------------------------------------- prufer ---

  // decode_prufer(): returns n - 1 edges [from, to] (1-based labels).
  function decodePrufer(seq, n) {
    var len = seq.length;
    var degree = new Int32Array(n + 2);
    var i;
    for (i = 1; i <= n; i++) degree[i] = 1;
    for (i = 0; i < len; i++) degree[seq[i]]++;
    var edges = new Array(n - 1);
    var ptr = 1;
    while (degree[ptr] !== 1) ptr++;
    var leaf = ptr;
    for (i = 0; i < len; i++) {
      var v = seq[i];
      edges[i] = [leaf, v];
      degree[leaf]--;
      degree[v]--;
      if (degree[v] === 1 && v < ptr) {
        leaf = v;
      } else {
        ptr++;
        while (ptr <= n && degree[ptr] !== 1) ptr++;
        leaf = ptr;
      }
    }
    var remaining = [];
    for (i = 1; i <= n && remaining.length < 2; i++) if (degree[i] === 1) remaining.push(i);
    edges[n - 2] = [remaining[0], remaining[1]];
    return edges;
  }

  // generate_prufer_population(): matrix(sample.int(...), nrow = pop_size),
  // filled column by column as in R.
  function generatePopulation(rng, n, popSize) {
    var genes = n - 2;
    var draws = rng.sampleInt(n, popSize * genes);
    var pop = [];
    for (var r = 0; r < popSize; r++) {
      var row = new Array(genes);
      for (var c = 0; c < genes; c++) row[c] = draws[c * popSize + r];
      pop.push(row);
    }
    return pop;
  }

  // ------------------------------------------------------------ NSGA-II ---

  // compute_objectives(): [{chr, obj}]
  function computeObjectives(chromosomes, lookup, n) {
    return chromosomes.map(function (chr) {
      var edges = decodePrufer(chr, n);
      var obj = lookup.map(function (L) {
        var w = new Array(edges.length);
        for (var e = 0; e < edges.length; e++) w[e] = L[(edges[e][0] - 1) * n + (edges[e][1] - 1)];
        return fsum(w);
      });
      return { chr: chr, obj: obj };
    });
  }

  function fastNonDominatedSort(objs) {
    var N = objs.length;
    if (N === 0) return [];
    if (N === 1) return [[0]];
    var count = new Int32Array(N);
    var dominates = [];
    var i, j, m;
    for (i = 0; i < N; i++) dominates.push([]);
    var M = objs[0].length;
    for (i = 0; i < N - 1; i++) {
      var oi = objs[i];
      for (j = i + 1; j < N; j++) {
        var oj = objs[j];
        var anyGt = false, anyLt = false;
        for (m = 0; m < M; m++) {
          if (oi[m] > oj[m]) anyGt = true;
          else if (oi[m] < oj[m]) anyLt = true;
        }
        if (!anyGt && anyLt) {
          dominates[i].push(j);
          count[j]++;
        } else if (!anyLt && anyGt) {
          dominates[j].push(i);
          count[i]++;
        }
      }
    }
    var fronts = [];
    var current = [];
    for (i = 0; i < N; i++) if (count[i] === 0) current.push(i);
    while (current.length > 0) {
      fronts.push(current);
      var next = [];
      for (var a = 0; a < current.length; a++) {
        var d = dominates[current[a]];
        for (var b = 0; b < d.length; b++) {
          count[d[b]]--;
          if (count[d[b]] === 0) next.push(d[b]);
        }
      }
      current = next;
    }
    return fronts;
  }

  // non_dominated_crowding(): adds rank and density, sorted by
  // order(rank, -density).
  function nonDominatedCrowding(items) {
    var N = items.length;
    if (N === 0) return [];
    var objs = items.map(function (it) { return it.obj; });
    var M = objs[0].length;
    var fronts = fastNonDominatedSort(objs);
    var rank = new Int32Array(N);
    fronts.forEach(function (f, k) { f.forEach(function (i) { rank[i] = k + 1; }); });
    var ranges = [];
    var m, i;
    for (m = 0; m < M; m++) {
      var lo = Infinity, hi = -Infinity;
      for (i = 0; i < N; i++) { lo = Math.min(lo, objs[i][m]); hi = Math.max(hi, objs[i][m]); }
      ranges.push(hi - lo);
    }
    var cd = [];
    for (i = 0; i < N; i++) cd.push(new Array(M).fill(0));
    fronts.forEach(function (front) {
      var lf = front.length;
      if (lf === 0) return;
      if (lf <= 2) {
        front.forEach(function (i2) { for (var m2 = 0; m2 < M; m2++) cd[i2][m2] = Infinity; });
        return;
      }
      for (var m3 = 0; m3 < M; m3++) {
        var vals = front.map(function (i3) { return objs[i3][m3]; });
        var ord = orderBy(vals).map(function (p) { return front[p]; });
        cd[ord[0]][m3] = Infinity;
        cd[ord[lf - 1]][m3] = Infinity;
        var r = ranges[m3];
        if (isFinite(r) && r > 0) {
          var upd = [];
          for (var q = 1; q < lf - 1; q++) upd.push((objs[ord[q + 1]][m3] - objs[ord[q - 1]][m3]) / r);
          for (q = 1; q < lf - 1; q++) cd[ord[q]][m3] = upd[q - 1];
        }
      }
    });
    var density = cd.map(fsum);
    var idx = items.map(function (_, k) { return k; });
    idx.sort(function (a, b) {
      if (rank[a] !== rank[b]) return rank[a] - rank[b];
      if (density[a] > density[b]) return -1;
      if (density[a] < density[b]) return 1;
      return a - b;
    });
    return idx.map(function (k) {
      return { chr: items[k].chr, obj: items[k].obj, rank: rank[k], density: density[k] };
    });
  }

  function evaluate(chromosomes, lookup, n) {
    return nonDominatedCrowding(computeObjectives(chromosomes, lookup, n));
  }

  function firstFront(evaluated) {
    return evaluated.filter(function (it) { return it.rank === 1; });
  }

  // tournament_selection(): tournaments is a pop_size x tour_size matrix
  // filled column by column.
  function tournamentSelection(rng, population, popSize, tourSize) {
    var N = population.length;
    var draws = rng.sampleInt(N, popSize * tourSize);
    var out = [];
    for (var r = 0; r < popSize; r++) {
      var best = -1;
      for (var c = 0; c < tourSize; c++) {
        var cand = draws[c * popSize + r] - 1;
        if (best < 0) { best = cand; continue; }
        var a = population[cand], b = population[best];
        if (a.rank < b.rank || (a.rank === b.rank && a.density > b.density)) best = cand;
      }
      out.push(population[best]);
    }
    return out;
  }

  // uniform_crossover()
  function uniformCrossover(rng, pool, popSize, crossRate) {
    var genes = pool[0].length;
    var nPairs = Math.floor(popSize / 2);
    var draws = rng.sampleInt(popSize, 2 * nPairs);
    var doCross = [];
    var k;
    for (k = 0; k < nPairs; k++) doCross.push(rng.runif(0, 1) < crossRate);
    var offspring = new Array(popSize);
    for (k = 0; k < nPairs; k++) {
      var i = 2 * k;
      var p1 = pool[draws[k] - 1];
      var p2 = pool[draws[nPairs + k] - 1];
      if (doCross[k]) {
        var c1 = new Array(genes), c2 = new Array(genes);
        for (var g = 0; g < genes; g++) {
          var mask = rng.runif(0, 1) <= 0.5;
          c1[g] = mask ? p1[g] : p2[g];
          c2[g] = mask ? p2[g] : p1[g];
        }
        offspring[i] = c1;
        offspring[i + 1] = c2;
      } else {
        offspring[i] = p1.slice();
        offspring[i + 1] = p2.slice();
      }
    }
    for (k = 2 * nPairs; k < popSize; k++) offspring[k] = new Array(genes).fill(0);
    return offspring;
  }

  // random_mutation()
  function randomMutation(rng, population, popSize, mutRate) {
    var genes = population[0].length;
    var nNodes = genes + 2;
    var rows = [];
    for (var i = 0; i < popSize; i++) if (rng.runif(0, 1) < mutRate) rows.push(i);
    if (rows.length === 0) return population;
    var cols = rng.sampleInt(genes, rows.length);
    var vals = rng.sampleInt(nNodes, rows.length);
    var out = population.map(function (r) { return r.slice(); });
    for (var q = 0; q < rows.length; q++) out[rows[q]][cols[q] - 1] = vals[q];
    return out;
  }

  // ------------------------------------------------------- local search ---

  function truncateUnique(paretoPop, popSize) {
    var rows = paretoPop.length > popSize ? paretoPop.slice(0, popSize) : paretoPop;
    return uniqueRows(rows);
  }

  // tabu_search()
  function tabuSearch(rng, paretoPop, n, popSize, lookup, neighbourFrac) {
    var genes = n - 2;
    var pop = truncateUnique(paretoPop, popSize);
    if (pop.length <= 1) return pop;
    var numNeighbours = Math.max(1, Math.ceil(neighbourFrac * n));
    if (numNeighbours > pop.length) numNeighbours = pop.length;
    var bestNeighbours = [];
    for (var s = 0; s < pop.length; s++) {
      var tabu = [];
      var base = pop[s];
      var hood = [];
      for (var i = 0; i < numNeighbours; i++) {
        var pos = rng.sampleInt(genes, 1)[0];
        var newv = rng.sampleInt(n, 1)[0];
        var child = base.slice();
        child[pos - 1] = newv;
        if (!rowInMatrix(child, tabu)) hood.push(child);
      }
      if (hood.length === 0) continue;
      hood.push(base);
      hood = uniqueRows(hood);
      if (hood.length > 1) {
        firstFront(evaluate(hood, lookup, n)).forEach(function (it) { bestNeighbours.push(it.chr); });
      } else {
        hood.forEach(function (r) { bestNeighbours.push(r); });
      }
    }
    if (bestNeighbours.length === 0) return pop;
    if (bestNeighbours.length > 1) {
      return uniqueRows(firstFront(evaluate(bestNeighbours, lookup, n)).map(function (it) { return it.chr; }));
    }
    return pop;
  }

  // path_relinking()
  function pathRelinking(paretoPop, n, popSize, lookup) {
    var genes = n - 2;
    var pop = truncateUnique(paretoPop, popSize);
    if (pop.length <= 1) return pop;
    var pairs = [];
    var a, b;
    if (pop.length === 2) {
      pairs = [[0, 1], [1, 0]];
    } else {
      for (a = 0; a < pop.length - 1; a++) for (b = a + 1; b < pop.length; b++) pairs.push([a, b]);
      var rev = pairs.map(function (p) { return [p[1], p[0]]; });
      pairs = pairs.concat(rev);
    }
    var pathSolutions = [];
    var seen = Object.create(null);
    for (var p = 0; p < pairs.length; p++) {
      var sInit = pop[pairs[p][0]].slice();
      var sGuide = pop[pairs[p][1]];
      while (!sameRow(sInit, sGuide)) {
        var diff = [];
        for (var g = 0; g < genes; g++) if (sInit[g] !== sGuide[g]) diff.push(g);
        if (diff.length === 0) break;
        var inter = diff.map(function (d) {
          var r = sInit.slice();
          r[d] = sGuide[d];
          return r;
        });
        inter = uniqueRows(inter);
        if (inter.length > 1) {
          var best = evaluate(inter, lookup, n)[0].chr.slice();
          var key = rowKey(best);
          if (seen[key]) break;
          pathSolutions.push(best);
          seen[key] = true;
          sInit = best;
        } else {
          sInit = inter[0].slice();
        }
      }
    }
    var combined = uniqueRows(pop.concat(pathSolutions));
    return uniqueRows(firstFront(evaluate(combined, lookup, n)).map(function (it) { return it.chr; }));
  }

  // pareto_local_search()
  function paretoLocalSearch(rng, paretoPop, n, popSize, lookup, neighbourFrac) {
    var genes = n - 2;
    var archive = truncateUnique(paretoPop, popSize);
    if (archive.length <= 1) return archive;
    var explored = Object.create(null);
    var numNeighbours = Math.max(1, Math.ceil(neighbourFrac * n));
    if (numNeighbours > archive.length) numNeighbours = archive.length;
    var maxOuter = 5 * archive.length + 50;
    var outer = 0;
    for (;;) {
      outer++;
      if (outer > maxOuter) break;
      var keys = archive.map(rowKey);
      var unexplored = [];
      for (var q = 0; q < keys.length; q++) if (!explored[keys[q]]) unexplored.push(q);
      if (unexplored.length === 0) break;
      var sIdx = unexplored[rng.sampleInt(unexplored.length, 1)[0] - 1];
      var sRow = archive[sIdx];
      var sKey = keys[sIdx];
      var pos = rng.sampleInt(genes, 1)[0];
      for (var i = 0; i < numNeighbours; i++) {
        var newv = rng.sampleInt(n, 1)[0];
        var sprime = sRow.slice();
        sprime[pos - 1] = newv;
        var combined = uniqueRows([sprime].concat(archive));
        if (combined.length <= 1) continue;
        var nd = uniqueRows(firstFront(evaluate(combined, lookup, n)).map(function (it) { return it.chr; }));
        if (rowInMatrix(sprime, nd)) archive = nd;
      }
      explored[sKey] = true;
    }
    return archive;
  }

  function applyLocalSearch(rng, variant, paretoPop, n, popSize, lookup) {
    switch (variant) {
      case "base": return paretoPop;
      case "PR": return pathRelinking(paretoPop, n, popSize, lookup);
      case "PLS": return paretoLocalSearch(rng, paretoPop, n, popSize, lookup, 0.10);
      case "TS": return tabuSearch(rng, paretoPop, n, popSize, lookup, 0.05);
      default: throw new Error("Unknown variant: " + variant);
    }
  }

  // ----------------------------------------------------------- run_momst ---

  function dedupeByChr(items) {
    var seen = Object.create(null);
    return items.filter(function (it) {
      var k = rowKey(it.chr);
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  /*
   * runMomst(instance, options) mirrors momst::run_momst(instance = ...).
   * options: variant, iterations, popSize, tourSize, crossRate, mutRate,
   * maxGenerations, convergenceWindow, seed, onProgress(info), log(line).
   * Returns { globalPareto: [{chr, obj, rank, density}], lookup, elapsed }.
   */
  function now() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  function runMomst(instance, options) {
    var o = Object.assign({
      variant: "base", iterations: 10, popSize: 50, tourSize: 2, crossRate: 0.8,
      mutRate: 0.05, maxGenerations: 100, convergenceWindow: 10, seed: null,
      onProgress: null, log: null
    }, options || {});
    var n = instance.n, numObj = instance.numObj, popSize = o.popSize;
    if (popSize % 2 !== 0) throw new Error("pop_size must be even.");
    var rng = new RRandom(o.seed === null || o.seed === undefined ? Math.floor(Math.random() * 2147483647) : o.seed);
    var lookup = buildLookup(instance);
    var log = o.log || function () {};
    var t0 = now();
    var genes = n - 2;

    log(" ################################# ");
    log(" Evaluating mo-MST ");
    log(" Algorithm: NSGA-II ");
    log(" Local search: " + o.variant);
    log(" nodes: " + n + " | weights: " + numObj);
    log(" Iterations 1 to " + o.iterations);
    log(" ################################# ");

    var iterFinals = [];
    for (var iter = 1; iter <= o.iterations; iter++) {
      log(" iteration " + iter);
      var popP = generatePopulation(rng, n, popSize);
      var convergence = Object.create(null);
      var popR = null;
      var g = 1;
      while (g <= o.maxGenerations) {
        if (o.onProgress) o.onProgress({ iteration: iter, generation: g });
        var evP = evaluate(popP, lookup, n);
        var popS = tournamentSelection(rng, evP, popSize, o.tourSize);
        var popC = uniformCrossover(rng, popS.map(function (it) { return it.chr; }), popSize, o.crossRate);
        var popM = randomMutation(rng, popC, popSize, o.mutRate);
        var evR = evaluate(evP.map(function (it) { return it.chr; }).concat(popM), lookup, n);
        var pareto = firstFront(evR).map(function (it) { return it.chr; });
        popR = applyLocalSearch(rng, o.variant, pareto, n, popSize, lookup);

        if (popR.length > 1) {
          var ev = evaluate(popR, lookup, n);
          var mins = [];
          for (var k = 0; k < numObj; k++) {
            var mn = Infinity;
            for (var q = 0; q < ev.length; q++) mn = Math.min(mn, ev[q].obj[k]);
            mins.push(mn);
          }
          var key = mins.map(String).join("|");
          convergence[key] = (convergence[key] || 0) + 1;
          var maxFreq = 0;
          for (var c in convergence) maxFreq = Math.max(maxFreq, convergence[c]);
          if (maxFreq >= o.convergenceWindow) {
            log("   ... convergence ... ");
            g = o.maxGenerations;
          }
        }

        if (popR.length < popSize) {
          var extra = generatePopulation(rng, n, popSize);
          popR = popR.concat(extra.slice(popR.length, popSize));
        }
        popP = popR.slice(0, popSize).map(function (r) { return r.slice(0, genes); });
        g++;
      }
      iterFinals.push(popR.slice(0, popSize));
    }

    var paretoPerIter = iterFinals.map(function (chrs) {
      var front = firstFront(evaluate(chrs, lookup, n));
      return front.length > 1 ? dedupeByChr(front) : front;
    });
    var all = [];
    paretoPerIter.forEach(function (f) { all = all.concat(f); });
    var globalPareto;
    if (all.length > 1) {
      globalPareto = dedupeByChr(firstFront(evaluate(all.map(function (it) { return it.chr; }), lookup, n)));
    } else {
      globalPareto = all;
    }
    var elapsed = (now() - t0) / 1000;
    log("Total time: " + elapsed.toFixed(2) + " seconds");
    return { globalPareto: globalPareto, paretoPerIter: paretoPerIter, lookup: lookup, elapsed: elapsed };
  }

  var api = {
    RRandom: RRandom,
    fsum: fsum,
    generateInstance: generateInstance,
    buildLookup: buildLookup,
    decodePrufer: decodePrufer,
    computeObjectives: computeObjectives,
    nonDominatedCrowding: nonDominatedCrowding,
    runMomst: runMomst
  };

  root.momst = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : this);
