# Apply the Configured Local-Search Variant

Apply the Configured Local-Search Variant

## Usage

``` r
apply_local_search(
  instance,
  pareto_pop,
  num_obj,
  n,
  variant,
  pop_size,
  lookup = NULL,
  verbose = FALSE
)
```

## Arguments

- instance:

  Edge-list `data.frame`.

- pareto_pop:

  Integer matrix.

- num_obj:

  Integer.

- n:

  Integer.

- variant:

  One of `"base"`, `"PR"`, `"PLS"`, `"TS"`.

- pop_size:

  Integer.

- lookup:

  Optional lookup.

- verbose:

  Logical.

## Value

data.frame.
