# Package index

## Package overview

Welcome page and pointers to the rest of the documentation.

- [`momst`](https://jorgeklz.github.io/momst/reference/momst-package.md)
  [`momst-package`](https://jorgeklz.github.io/momst/reference/momst-package.md)
  : momst: Multi-Objective Minimum Spanning Tree via NSGA-II with Local
  Search

## Main solver

Single entry point to run the NSGA-II based MO-MST solver.

- [`run_momst()`](https://jorgeklz.github.io/momst/reference/run_momst.md)
  : Run the MO-MST NSGA-II Solver

## Instance and lookup

Generate random complete-graph instances and pre-compute edge-weight
lookup tables.

- [`generate_instance()`](https://jorgeklz.github.io/momst/reference/generate_instance.md)
  : Generate a Complete-Graph Instance for MO-MST
- [`build_weight_lookup()`](https://jorgeklz.github.io/momst/reference/build_weight_lookup.md)
  : Pre-build Edge-Weight Lookup Matrices

## Prufer encoding

Tree encoding helpers used internally by the genetic operators.

- [`decode_prufer()`](https://jorgeklz.github.io/momst/reference/decode_prufer.md)
  : Decode a Prufer Sequence to its Spanning Tree (Linear Time)
- [`generate_prufer_population()`](https://jorgeklz.github.io/momst/reference/generate_prufer_population.md)
  : Generate an Initial Prufer-Encoded Population

## NSGA-II operators

Objective evaluation, ranking, and the standard NSGA-II operators.

- [`compute_objectives()`](https://jorgeklz.github.io/momst/reference/compute_objectives.md)
  : Compute Multi-Objective Costs for a Population
- [`non_dominated_crowding()`](https://jorgeklz.github.io/momst/reference/non_dominated_crowding.md)
  : Assign Pareto Rank and Crowding Distance
- [`tournament_selection()`](https://jorgeklz.github.io/momst/reference/tournament_selection.md)
  : Tournament Selection
- [`uniform_crossover()`](https://jorgeklz.github.io/momst/reference/uniform_crossover.md)
  : Uniform Crossover for Prufer Sequences
- [`random_mutation()`](https://jorgeklz.github.io/momst/reference/random_mutation.md)
  : Random Mutation on Prufer Sequences

## Local search operators

Three local search strategies and the dispatcher used by run_momst().

- [`apply_local_search()`](https://jorgeklz.github.io/momst/reference/apply_local_search.md)
  : Apply the Configured Local-Search Variant
- [`path_relinking()`](https://jorgeklz.github.io/momst/reference/path_relinking.md)
  : Path Relinking on the Current Pareto Front
- [`pareto_local_search()`](https://jorgeklz.github.io/momst/reference/pareto_local_search.md)
  : Pareto Local Search
- [`tabu_search()`](https://jorgeklz.github.io/momst/reference/tabu_search.md)
  : Tabu Search on the Current Pareto Front

## Plotting

Convenience plots for the Pareto front and the best compromise tree.

- [`plot_pareto_front()`](https://jorgeklz.github.io/momst/reference/plot_pareto_front.md)
  : Plot a Pareto Front (2-objective case)
- [`plot_best_tree()`](https://jorgeklz.github.io/momst/reference/plot_best_tree.md)
  : Plot the Best-Compromise Spanning Tree
