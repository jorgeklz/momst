# Generate an Initial Prufer-Encoded Population

Generate an Initial Prufer-Encoded Population

## Usage

``` r
generate_prufer_population(n, pop_size)
```

## Arguments

- n:

  Integer. Number of nodes.

- pop_size:

  Integer. Number of individuals to generate.

## Value

Integer matrix of dimensions `pop_size x (n - 2)`.

## Examples

``` r
generate_prufer_population(n = 6, pop_size = 4)
#>      [,1] [,2] [,3] [,4]
#> [1,]    1    4    2    4
#> [2,]    4    3    2    2
#> [3,]    3    2    3    1
#> [4,]    4    3    6    6
```
