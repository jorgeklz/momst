# Pre-build Edge-Weight Lookup Matrices

Constructs one `n x n` matrix per objective so that the weight of any
edge `(i, j)` can be queried in O(1) via standard matrix indexing.

## Usage

``` r
build_weight_lookup(instance, n, num_obj)
```

## Arguments

- instance:

  `data.frame` returned by
  [`generate_instance`](https://jorgeklz.github.io/momst/reference/generate_instance.md)
  or one with columns `from`, `to`, `weight_1`, `weight_2` (and
  optionally `weight_3`).

- n:

  Integer. Number of nodes.

- num_obj:

  Integer. Number of objectives (2 or 3).

## Value

A list of length `num_obj`; element `k` is the symmetric `n x n` weight
matrix of objective `k`.

## Examples

``` r
inst <- generate_instance(10, 2, seed = 1)
L <- build_weight_lookup(inst, 10, 2)
L[[1]][1, 2]
#> [1] 33.89578
```
