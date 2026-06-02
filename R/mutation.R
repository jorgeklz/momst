#' Random Mutation on Prufer Sequences
#'
#' @param population Numeric matrix \code{[pop_size x (n - 2)]}.
#' @param pop_size Integer.
#' @param mut_rate Numeric in \[0, 1\].
#' @return Integer matrix \code{[pop_size x (n - 2)]}.
#' @export
random_mutation <- function(population, pop_size, mut_rate) {

  population <- as.matrix(population)
  storage.mode(population) <- "integer"
  num_genes <- ncol(population)
  n_nodes   <- num_genes + 2L

  mut_mask <- stats::runif(pop_size) < mut_rate
  n_mut <- sum(mut_mask)
  if (n_mut == 0L) return(population)

  mut_rows <- which(mut_mask)
  mut_cols <- sample.int(num_genes, n_mut, replace = TRUE)
  new_vals <- sample.int(n_nodes,  n_mut, replace = TRUE)

  population[cbind(mut_rows, mut_cols)] <- new_vals
  population
}
