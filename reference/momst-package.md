# momst: Multi-Objective Minimum Spanning Tree via NSGA-II with Local Search

The momst package implements the Multi-Criteria Minimum Spanning Tree
(mc-MST) algorithm using the NSGA-II (Non-dominated Sorting Genetic
Algorithm II). Four variants are supported depending on the local search
operator applied after each generation:

- `"base"`:

  Pure NSGA-II without local search.

- `"PR"`:

  NSGA-II plus Path Relinking.

- `"PLS"`:

  NSGA-II plus Pareto Local Search.

- `"TS"`:

  NSGA-II plus Tabu Search.

## Details

Chromosomes are encoded as Prufer sequences, taking advantage of
Cayley's theorem (every sequence of length n-2 with values in {1,...,n}
decodes to a unique spanning tree of n nodes). This bijection makes
every random chromosome a valid solution, avoiding repair operators.

The main entry point is
[`run_momst`](https://jorgeklz.github.io/momst/reference/run_momst.md).

## Reference

This package is the reference implementation of the method described in:

Parraga-Alava, J., Inostroza-Ponta, M., & Dorn, M. (2017). Using local
search strategies to improve the performance of NSGA-II for the
Multi-Criteria Minimum Spanning Tree problem. In *2017 IEEE Congress on
Evolutionary Computation (CEC)* (pp. 1818-1825). IEEE.
[doi:10.1109/CEC.2017.7969432](https://doi.org/10.1109/CEC.2017.7969432)

## Author

Jorge A. Parraga-Alava <jorge.parraga@utm.edu.ec>
