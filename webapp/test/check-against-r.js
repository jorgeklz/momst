#!/usr/bin/env node
/*
 * Checks that the JavaScript port (webapp/momst.js) reproduces
 * momst::run_momst() exactly: same instance weights, same Pareto front
 * (chromosomes and order) and the same objective values.
 *
 * Requires Rscript and the momst package installed (R CMD INSTALL .).
 * Usage: node webapp/test/check-against-r.js
 */
"use strict";

const { execFileSync } = require("child_process");
const momst = require("../momst.js");

const CASES = [
  { n: 6, numObj: 2, variant: "base", iterations: 1, popSize: 10, maxGenerations: 5, instSeed: 1, seed: 7 },
  { n: 10, numObj: 2, variant: "base", iterations: 2, popSize: 30, maxGenerations: 30, instSeed: 12345, seed: 2026 },
  { n: 10, numObj: 2, variant: "PR", iterations: 2, popSize: 30, maxGenerations: 30, instSeed: 12345, seed: 2026 },
  { n: 10, numObj: 2, variant: "PLS", iterations: 2, popSize: 30, maxGenerations: 30, instSeed: 12345, seed: 2026 },
  { n: 10, numObj: 2, variant: "TS", iterations: 2, popSize: 30, maxGenerations: 30, instSeed: 12345, seed: 2026 },
  { n: 12, numObj: 3, variant: "base", iterations: 2, popSize: 20, maxGenerations: 20, instSeed: 7, seed: 42 },
  { n: 12, numObj: 3, variant: "PR", iterations: 1, popSize: 20, maxGenerations: 15, instSeed: 7, seed: 42 },
  { n: 12, numObj: 3, variant: "PLS", iterations: 1, popSize: 20, maxGenerations: 15, instSeed: 7, seed: 42 },
  { n: 12, numObj: 3, variant: "TS", iterations: 2, popSize: 20, maxGenerations: 20, instSeed: 7, seed: 42 },
  { n: 15, numObj: 2, variant: "PLS", iterations: 1, popSize: 40, maxGenerations: 40, instSeed: 99, seed: -5,
    crossRate: 0.9, mutRate: 0.2, tourSize: 3, convergenceWindow: 5 },
  { n: 4, numObj: 2, variant: "TS", iterations: 3, popSize: 8, maxGenerations: 10, instSeed: 3, seed: 3 },
  { n: 25, numObj: 2, variant: "TS", iterations: 1, popSize: 50, maxGenerations: 25, instSeed: 5, seed: 11,
    rangeA: [1, 5], rangeB: [100, 300] }
];

function defaults(c) {
  return Object.assign({ crossRate: 0.8, mutRate: 0.05, tourSize: 2, convergenceWindow: 10,
    rangeA: [10, 100], rangeB: [10, 50], rangeC: [30, 200] }, c);
}

function rScript(c) {
  const v = (x) => `c(${x[0]}, ${x[1]})`;
  return `
suppressMessages(library(momst))
inst <- generate_instance(${c.n}, ${c.numObj}, ${v(c.rangeA)}, ${v(c.rangeB)}, ${v(c.rangeC)}, seed = ${c.instSeed}L)
for (k in seq_len(${c.numObj})) cat("W", sprintf("%.17g", inst[[paste0("weight_", k)]]), "\\n")
res <- run_momst(instance = inst, n = ${c.n}, num_obj = ${c.numObj}, variant = "${c.variant}",
                 iterations = ${c.iterations}L, pop_size = ${c.popSize}L, tour_size = ${c.tourSize}L,
                 cross_rate = ${c.crossRate}, mut_rate = ${c.mutRate},
                 max_generations = ${c.maxGenerations}L, convergence_window = ${c.convergenceWindow}L,
                 verbose = FALSE, seed = ${c.seed}L)
g <- res$global_pareto
oc <- grep("^objective_", names(g), value = TRUE)
for (i in seq_len(nrow(g))) {
  cat("P", paste(unlist(g[i, 1:${c.n - 2}]), collapse = "-"), sprintf("%.17g", unlist(g[i, oc])), "\\n")
}
`;
}

let failures = 0;
for (const raw of CASES) {
  const c = defaults(raw);
  const label = `n=${c.n} obj=${c.numObj} ${c.variant} iter=${c.iterations} pop=${c.popSize} gen=${c.maxGenerations}`;
  const out = execFileSync("Rscript", ["-e", rScript(c)], { encoding: "utf8" });
  const rWeights = [], rFront = [];
  for (const line of out.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === "W") rWeights.push(parts.slice(1).map(Number));
    if (parts[0] === "P") rFront.push({ chr: parts[1], obj: parts.slice(2).map(Number) });
  }

  const inst = momst.generateInstance(c.n, c.numObj, c.rangeA, c.rangeB, c.rangeC, c.instSeed);
  const problems = [];
  inst.weights.forEach((w, k) => {
    if (w.length !== rWeights[k].length || w.some((x, i) => x !== rWeights[k][i])) {
      problems.push(`instance weight_${k + 1} differs`);
    }
  });

  const res = momst.runMomst(inst, {
    variant: c.variant, iterations: c.iterations, popSize: c.popSize, tourSize: c.tourSize,
    crossRate: c.crossRate, mutRate: c.mutRate, maxGenerations: c.maxGenerations,
    convergenceWindow: c.convergenceWindow, seed: c.seed
  });
  const jsFront = res.globalPareto.map((it) => ({ chr: it.chr.join("-"), obj: it.obj }));
  if (jsFront.length !== rFront.length) {
    problems.push(`front size: JS ${jsFront.length}, R ${rFront.length}`);
  } else {
    for (let i = 0; i < jsFront.length; i++) {
      if (jsFront[i].chr !== rFront[i].chr) { problems.push(`row ${i + 1} chromosome differs`); break; }
      const bad = jsFront[i].obj.some((x, k) => Math.abs(x - rFront[i].obj[k]) > 1e-9 * Math.max(1, Math.abs(x)));
      if (bad) { problems.push(`row ${i + 1} objectives differ`); break; }
    }
  }
  if (problems.length) {
    failures++;
    console.log(`FAIL ${label}: ${problems.join("; ")}`);
  } else {
    console.log(`ok   ${label}: ${jsFront.length} solutions identical`);
  }
}

if (failures) {
  console.log(`\n${failures} of ${CASES.length} cases differ from R.`);
  process.exit(1);
}
console.log(`\nAll ${CASES.length} cases match momst::run_momst().`);
