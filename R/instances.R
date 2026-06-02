#' Generate a Complete-Graph Instance for MO-MST
#'
#' Produces a complete undirected weighted graph with random multi-objective
#' edge weights. Each edge gets two or three independent uniform weights, one
#' per objective.
#'
#' @param n Integer. Number of nodes of the graph (must be at least 3).
#' @param num_obj Integer in \{2, 3\}. Number of objectives.
#' @param range_a Numeric vector \code{c(min, max)} for weights of objective 1.
#' @param range_b Numeric vector \code{c(min, max)} for weights of objective 2.
#' @param range_c Numeric vector \code{c(min, max)} for weights of objective 3.
#'   Ignored when \code{num_obj == 2}.
#' @param seed Optional integer. If supplied, the RNG seed is fixed before
#'   sampling and restored afterwards, leaving the global RNG untouched.
#'
#' @return A \code{data.frame} with \code{n*(n-1)/2} rows and columns
#'   \code{from}, \code{to}, \code{weight_1}, \code{weight_2} (and
#'   \code{weight_3} when \code{num_obj == 3}).
#'
#' @examples
#' inst <- generate_instance(n = 10, num_obj = 2, seed = 12345)
#' head(inst)
#'
#' @export
generate_instance <- function(n,
                              num_obj,
                              range_a = c(10, 100),
                              range_b = c(10, 50),
                              range_c = c(30, 200),
                              seed = NULL) {

  if (!num_obj %in% c(2L, 3L)) stop("num_obj must be 2 or 3.")
  if (n < 3L) stop("n must be at least 3.")

  if (!is.null(seed)) {
    old_seed <- if (exists(".Random.seed", envir = globalenv()))
      get(".Random.seed", envir = globalenv()) else NULL
    set.seed(seed)
    on.exit({
      if (is.null(old_seed)) {
        if (exists(".Random.seed", envir = globalenv()))
          rm(".Random.seed", envir = globalenv())
      } else {
        assign(".Random.seed", old_seed, envir = globalenv())
      }
    }, add = TRUE)
  }

  edges <- t(utils::combn(n, 2L))
  colnames(edges) <- c("from", "to")
  num_edges <- nrow(edges)

  weight_1 <- stats::runif(num_edges, range_a[1L], range_a[2L])
  weight_2 <- stats::runif(num_edges, range_b[1L], range_b[2L])

  out <- if (num_obj == 2L) {
    cbind(edges, weight_1 = weight_1, weight_2 = weight_2)
  } else {
    weight_3 <- stats::runif(num_edges, range_c[1L], range_c[2L])
    cbind(edges, weight_1 = weight_1, weight_2 = weight_2, weight_3 = weight_3)
  }
  as.data.frame(out)
}
