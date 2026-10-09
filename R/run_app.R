#' Launch the Interactive momst Explorer
#'
#' Opens a Shiny application that wraps \code{\link{run_momst}}. From the
#' browser you can generate a random instance or upload an edge list, run one
#' or several solver variants, inspect and download the Pareto front, compare
#' variants and draw any spanning tree of the front.
#'
#' The same application is published as a static web page (it runs R in the
#' browser through webR) at \url{https://jorgeklz.github.io/momst/app/}.
#'
#' @param ... Arguments passed to \code{\link[shiny]{runApp}}, such as
#'   \code{port} or \code{launch.browser}.
#' @return Called for its side effect; returns the value of
#'   \code{\link[shiny]{runApp}} invisibly.
#' @examples
#' if (interactive()) {
#'   run_app()
#' }
#' @export
run_app <- function(...) {
  for (pkg in c("shiny", "bslib")) {
    if (!requireNamespace(pkg, quietly = TRUE)) {
      stop("Package '", pkg, "' is required for run_app(). ",
           "Install it with install.packages('", pkg, "').", call. = FALSE)
    }
  }
  app_dir <- system.file("app", package = "momst")
  if (app_dir == "") stop("Could not find the app directory. Try reinstalling momst.", call. = FALSE)
  invisible(shiny::runApp(app_dir, ...))
}
