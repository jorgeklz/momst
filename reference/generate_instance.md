# Generate a Complete-Graph Instance for MO-MST

Produces a complete undirected weighted graph with random
multi-objective edge weights. Each edge gets two or three independent
uniform weights, one per objective.

## Usage

``` r
generate_instance(
  n,
  num_obj,
  range_a = c(10, 100),
  range_b = c(10, 50),
  range_c = c(30, 200),
  seed = NULL
)
```

## Arguments

- n:

  Integer. Number of nodes of the graph (must be at least 3).

- num_obj:

  Integer in {2, 3}. Number of objectives.

- range_a:

  Numeric vector `c(min, max)` for weights of objective 1.

- range_b:

  Numeric vector `c(min, max)` for weights of objective 2.

- range_c:

  Numeric vector `c(min, max)` for weights of objective 3. Ignored when
  `num_obj == 2`.

- seed:

  Optional integer. If supplied, the RNG seed is fixed before sampling
  and restored afterwards, leaving the global RNG untouched.

## Value

A `data.frame` with `n*(n-1)/2` rows and columns `from`, `to`,
`weight_1`, `weight_2` (and `weight_3` when `num_obj == 3`).

## Examples

``` r
inst <- generate_instance(n = 10, num_obj = 2, seed = 12345)
head(inst)
#>   from to weight_1 weight_2
#> 1    1  2 74.88135 22.84899
#> 2    1  3 88.81959 12.40781
#> 3    1  4 78.48841 11.73826
#> 4    1  5 89.75121 12.20215
#> 5    1  6 51.08329 35.02171
#> 6    1  7 24.97346 48.57881
```
