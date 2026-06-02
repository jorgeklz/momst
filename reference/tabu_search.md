# Tabu Search on the Current Pareto Front

Tabu Search on the Current Pareto Front

## Usage

``` r
tabu_search(
  instance,
  pareto_pop,
  num_obj,
  n,
  neighbour_frac = 0.05,
  pop_size,
  lookup = NULL,
  verbose = FALSE
)
```

## Arguments

- instance:

  Edge-list `data.frame`.

- pareto_pop:

  Integer matrix `[k x (n - 2)]`.

- num_obj:

  Integer.

- n:

  Integer.

- neighbour_frac:

  Numeric.

- pop_size:

  Integer.

- lookup:

  Optional lookup.

- verbose:

  Logical.

## Value

data.frame of non-dominated chromosomes.
