# momst <img src="man/figures/logo.png" align="right" height="120" alt="momst logo"/>

<!-- badges: start -->
[![R-CMD-check](https://github.com/jorgeklz/momst/actions/workflows/R-CMD-check.yaml/badge.svg)](https://github.com/jorgeklz/momst/actions/workflows/R-CMD-check.yaml)
[![Lifecycle: stable](https://img.shields.io/badge/lifecycle-stable-brightgreen.svg)](https://lifecycle.r-lib.org/articles/stages.html#stable)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![DOI](https://img.shields.io/badge/DOI-10.1109%2FCEC.2017.7969432-blue.svg)](https://doi.org/10.1109/CEC.2017.7969432)
<!-- badges: end -->

`momst` is the **reference R implementation** of the Multi-Criteria Minimum
Spanning Tree (mc-MST) solver introduced in:

> Parraga-Alava, J., Inostroza-Ponta, M., and Dorn, M. (2017).
> *Using local search strategies to improve the performance of NSGA-II
> for the Multi-Criteria Minimum Spanning Tree problem*.
> In **2017 IEEE Congress on Evolutionary Computation (CEC)**,
> pp. 1818 to 1825. IEEE.
> [doi:10.1109/CEC.2017.7969432](https://doi.org/10.1109/CEC.2017.7969432)

The solver couples **NSGA-II** with three optional Pareto local search
operators and a **Prufer sequence** chromosome representation. By
Cayley's theorem, every random Prufer sequence decodes to a valid
spanning tree, so the genetic operators never need a repair step.

## Variants

| Variant   | Local search                            | Reference algorithm              |
|:----------|:----------------------------------------|:---------------------------------|
| `"base"`  | None (pure NSGA-II)                     | Reference baseline.              |
| `"PR"`    | Path Relinking                          | Section III.C of the CEC paper.  |
| `"PLS"`   | Pareto Local Search                     | Section III.A of the CEC paper.  |
| `"TS"`    | Tabu Search                             | Section III.B of the CEC paper.  |

## Installation

```r
# install.packages("remotes")
remotes::install_github("jorgeklz/momst", build_vignettes = TRUE)
```

## Quick start

```r
library(momst)

# Run NSGA-II on a 10 node graph with two random objectives
res <- run_momst(
  n               = 10,
  num_obj         = 2,
  variant         = "PLS",      # NSGA-II + Pareto Local Search
  iterations      = 3,
  pop_size        = 30,
  max_generations = 40,
  verbose         = FALSE,
  seed            = 2026
)

# Inspect the global Pareto front
head(res$global_pareto[, c("objetivo_1", "objetivo_2")])

# Plot it
plot_pareto_front(res)

# Plot the best-compromise spanning tree (requires the 'igraph' package)
plot_best_tree(res, n = 10)
```

## Vignettes

```r
browseVignettes("momst")
```

The package ships two vignettes:

1. **Getting Started with momst**: minimal workflow, two and three
   objective examples, reproducibility notes.
2. **Comparing the Four MO-MST Variants**: side by side comparison of
   the four solver variants on the same instance, with combined
   Pareto front and runtime analysis.

## Citation

```r
citation("momst")
```

If you use `momst` in academic work, please cite the original CEC 2017
paper indicated above and the R package itself.

## Issues and contributions

Please report bugs and feature requests through the GitHub issue
tracker: <https://github.com/jorgeklz/momst/issues>.

## License

GPL (>= 3). See `LICENSE` for details.
