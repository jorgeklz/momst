#' Pre-build Edge-Weight Lookup Matrices
#'
#' Constructs one \code{n x n} matrix per objective so that the weight of any
#' edge \code{(i, j)} can be queried in O(1) via standard matrix indexing.
#'
#' @param instance \code{data.frame} returned by \code{\link{generate_instance}}
#'   or one with columns \code{from}, \code{to}, \code{weight_1}, \code{weight_2}
#'   (and optionally \code{weight_3}).
#' @param n Integer. Number of nodes.
#' @param num_obj Integer. Number of objectives (2 or 3).
#'
#' @return A list of length \code{num_obj}; element \code{k} is the symmetric
#'   \code{n x n} weight matrix of objective \code{k}.
#'
#' @examples
#' inst <- generate_instance(10, 2, seed = 1)
#' L <- build_weight_lookup(inst, 10, 2)
#' L[[1]][1, 2]
#'
#' @export
build_weight_lookup <- function(instance, n, num_obj) {

  i <- instance$from
  j <- instance$to

  lookup <- vector("list", num_obj)
  for (k in seq_len(num_obj)) {
    w <- instance[[paste0("weight_", k)]]
    L <- matrix(0, nrow = n, ncol = n)
    L[cbind(i, j)] <- w
    L[cbind(j, i)] <- w
    lookup[[k]] <- L
  }
  lookup
}
