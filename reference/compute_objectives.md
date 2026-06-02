# Compute Multi-Objective Costs for a Population

Compute Multi-Objective Costs for a Population

## Usage

``` r
compute_objectives(instance, chromosomes, num_obj, lookup = NULL)
```

## Arguments

- instance:

  Edge-list `data.frame` (only used when `lookup = NULL`).

- chromosomes:

  Numeric matrix `[pop_size x (n - 2)]`.

- num_obj:

  Integer.

- lookup:

  Optional list returned by
  [`build_weight_lookup`](https://jorgeklz.github.io/momst/reference/build_weight_lookup.md).

## Value

Numeric matrix `[pop_size x (n - 2 + num_obj)]`.

## Examples

``` r
inst <- generate_instance(10, 2, seed = 1)
lk   <- build_weight_lookup(inst, 10, 2)
pop  <- generate_prufer_population(10, 5)
compute_objectives(inst, pop, 2, lk)
#>                       objective_1 objective_2
#> [1,] 7 9 7 4 7 10 8 3    464.6565    283.1581
#> [2,] 5 5 5 2 5  5 6 1    422.3082    306.0882
#> [3,] 6 5 5 3 6  2 1 9    520.1775    268.6424
#> [4,] 4 8 2 9 9  1 6 2    577.9666    225.5789
#> [5,] 6 2 6 6 6  4 2 5    398.7123    251.0403
```
