# Run the MO-MST NSGA-II Solver

Single entry point that replaces the original `main.R` script.

## Usage

``` r
run_momst(
  instance = NULL,
  instance_file = NULL,
  n = 10L,
  num_obj = 2L,
  variant = c("base", "PR", "PLS", "TS"),
  iterations = 10L,
  pop_size = 50L,
  tour_size = 2L,
  cross_rate = 0.8,
  mut_rate = 0.05,
  max_generations = 100L,
  convergence_window = 10L,
  range_a = c(10, 100),
  range_b = c(10, 50),
  range_c = c(30, 200),
  save_dir = NULL,
  verbose = TRUE,
  seed = NULL
)
```

## Arguments

- instance:

  Optional `data.frame`.

- instance_file:

  Optional path.

- n:

  Integer.

- num_obj:

  Integer in {2, 3}.

- variant:

  One of `"base"`, `"PR"`, `"PLS"`, `"TS"`.

- iterations:

  Integer or two-length integer `c(min_iter, max_iter)`.

- pop_size:

  Integer (must be even).

- tour_size:

  Integer.

- cross_rate:

  Numeric in \\0, 1\\.

- mut_rate:

  Numeric in \\0, 1\\.

- max_generations:

  Integer.

- convergence_window:

  Integer.

- range_a, range_b, range_c:

  Weight ranges for instance generation.

- save_dir:

  Optional directory for per-iteration result files.

- verbose:

  Logical.

- seed:

  Optional integer.

## Value

Invisible list with the solution data.

## References

Parraga-Alava, J., Inostroza-Ponta, M., & Dorn, M. (2017). Using local
search strategies to improve the performance of NSGA-II for the
Multi-Criteria Minimum Spanning Tree problem. In *2017 IEEE Congress on
Evolutionary Computation (CEC)* (pp. 1818-1825). IEEE.
[doi:10.1109/CEC.2017.7969432](https://doi.org/10.1109/CEC.2017.7969432)

## Examples

``` r
if (FALSE) { # \dontrun{
res <- run_momst(n = 10, num_obj = 2, iterations = 3,
                 pop_size = 20, max_generations = 30,
                 variant = "base", seed = 1)
head(res$global_pareto)
} # }
```
