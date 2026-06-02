#' Uniform Crossover for Prufer Sequences
#'
#' @param pool Numeric matrix \code{[pop_size x (n - 2)]}.
#' @param pop_size Integer (must be even).
#' @param cross_rate Numeric in \[0, 1\].
#' @return Integer matrix \code{[pop_size x (n - 2)]}.
#' @export
uniform_crossover <- function(pool, pop_size, cross_rate) {

  pool <- as.matrix(pool)
  num_genes <- ncol(pool)
  storage.mode(pool) <- "integer"

  offspring <- matrix(0L, nrow = pop_size, ncol = num_genes)

  n_pairs <- pop_size %/% 2L
  parents <- matrix(sample.int(pop_size, 2L * n_pairs, replace = TRUE),
                    nrow = n_pairs, ncol = 2L)
  do_cross <- stats::runif(n_pairs) < cross_rate

  for (k in seq_len(n_pairs)) {
    i <- 2L * k - 1L
    p1 <- pool[parents[k, 1L], ]
    p2 <- pool[parents[k, 2L], ]

    if (do_cross[k]) {
      mask <- stats::runif(num_genes) <= 0.5
      offspring[i,     ] <- ifelse(mask, p1, p2)
      offspring[i + 1L, ] <- ifelse(mask, p2, p1)
    } else {
      offspring[i,     ] <- p1
      offspring[i + 1L, ] <- p2
    }
  }
  offspring
}
