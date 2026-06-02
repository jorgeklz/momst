# Decode a Prufer Sequence to its Spanning Tree (Linear Time)

Returns the edge list of the spanning tree encoded by a Prufer sequence
of length `n - 2`. Uses Wang's pointer-based linear-time algorithm,
replacing the classic O(n^2) "search smallest leaf each step" approach.

## Usage

``` r
decode_prufer(seq_prufer, n)
```

## Arguments

- seq_prufer:

  Integer vector of length `n - 2` with values in {1, ..., n}.

- n:

  Integer. Number of nodes of the underlying graph.

## Value

Integer matrix of dimensions `(n - 1) x 2`; each row is an undirected
edge `(from, to)`.

## Examples

``` r
decode_prufer(c(3, 1, 5), n = 5)
#>      edges_from edges_to
#> [1,]          2        3
#> [2,]          3        1
#> [3,]          1        5
#> [4,]          4        5
```
