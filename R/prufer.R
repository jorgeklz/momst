#' Decode a Prufer Sequence to its Spanning Tree (Linear Time)
#'
#' Returns the edge list of the spanning tree encoded by a Prufer sequence
#' of length \code{n - 2}. Uses Wang's pointer-based linear-time algorithm,
#' replacing the classic O(n^2) "search smallest leaf each step" approach.
#'
#' @param seq_prufer Integer vector of length \code{n - 2} with values in
#'   \{1, ..., n\}.
#' @param n Integer. Number of nodes of the underlying graph.
#'
#' @return Integer matrix of dimensions \code{(n - 1) x 2}; each row is an
#'   undirected edge \code{(from, to)}.
#'
#' @examples
#' decode_prufer(c(3, 1, 5), n = 5)
#'
#' @export
decode_prufer <- function(seq_prufer, n) {

  n <- as.integer(n)
  seq_prufer <- as.integer(seq_prufer)
  len <- length(seq_prufer)

  degree <- tabulate(seq_prufer, nbins = n) + 1L

  edges_from <- integer(n - 1L)
  edges_to   <- integer(n - 1L)

  ptr <- 1L
  while (degree[ptr] != 1L) ptr <- ptr + 1L
  leaf <- ptr

  for (i in seq_len(len)) {
    v <- seq_prufer[i]
    edges_from[i] <- leaf
    edges_to[i]   <- v
    degree[leaf]  <- degree[leaf] - 1L
    degree[v]     <- degree[v] - 1L

    if (degree[v] == 1L && v < ptr) {
      leaf <- v
    } else {
      ptr <- ptr + 1L
      while (ptr <= n && degree[ptr] != 1L) ptr <- ptr + 1L
      leaf <- ptr
    }
  }

  remaining <- which(degree == 1L)
  edges_from[n - 1L] <- remaining[1L]
  edges_to[n - 1L]   <- remaining[2L]

  cbind(edges_from, edges_to)
}


#' Generate an Initial Prufer-Encoded Population
#'
#' @param n Integer. Number of nodes.
#' @param pop_size Integer. Number of individuals to generate.
#'
#' @return Integer matrix of dimensions \code{pop_size x (n - 2)}.
#'
#' @examples
#' generate_prufer_population(n = 6, pop_size = 4)
#'
#' @export
generate_prufer_population <- function(n, pop_size) {
  matrix(sample.int(n, pop_size * (n - 2L), replace = TRUE),
         nrow = pop_size, ncol = n - 2L)
}
