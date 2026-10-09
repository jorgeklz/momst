# Launch the Interactive momst Explorer

Opens a Shiny application that wraps
[`run_momst`](https://jorgeklz.github.io/momst/reference/run_momst.md).
From the browser you can generate a random instance or upload an edge
list, run one or several solver variants, inspect and download the
Pareto front, compare variants and draw any spanning tree of the front.

## Usage

``` r
run_app(...)
```

## Arguments

- ...:

  Arguments passed to
  [`runApp`](https://rdrr.io/pkg/shiny/man/runApp.html), such as `port`
  or `launch.browser`.

## Value

Called for its side effect; returns the value of
[`runApp`](https://rdrr.io/pkg/shiny/man/runApp.html) invisibly.

## Details

The same application is published as a static web page (it runs R in the
browser through webR) at <https://jorgeklz.github.io/momst/app/>.

## Examples

``` r
if (interactive()) {
  run_app()
}
```
