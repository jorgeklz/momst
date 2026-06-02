# Path Relinking on the Current Pareto Front

Path Relinking on the Current Pareto Front

## Usage

``` r
path_relinking(
  instance,
  pareto_pop,
  num_obj,
  n,
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

- pop_size:

  Integer.

- lookup:

  Optional lookup.

- verbose:

  Logical.

## Value

data.frame of non-dominated chromosomes.
