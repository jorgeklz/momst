# Assign Pareto Rank and Crowding Distance

Assign Pareto Rank and Crowding Distance

## Usage

``` r
non_dominated_crowding(population, num_obj)
```

## Arguments

- population:

  Numeric matrix `[N x (vars + num_obj)]`.

- num_obj:

  Integer.

## Value

Matrix with extra columns `rankingIndex` and `density`.
