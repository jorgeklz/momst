#' Compute Multi-Objective Costs for a Population
#'
#' @param instance Edge-list \code{data.frame} (only used when
#'   \code{lookup = NULL}).
#' @param chromosomes Numeric matrix \code{[pop_size x (n - 2)]}.
#' @param num_obj Integer.
#' @param lookup Optional list returned by \code{\link{build_weight_lookup}}.
#'
#' @return Numeric matrix \code{[pop_size x (n - 2 + num_obj)]}.
#'
#' @examples
#' inst <- generate_instance(10, 2, seed = 1)
#' lk   <- build_weight_lookup(inst, 10, 2)
#' pop  <- generate_prufer_population(10, 5)
#' compute_objectives(inst, pop, 2, lk)
#'
#' @export
compute_objectives <- function(instance, chromosomes, num_obj, lookup = NULL) {

  chromosomes <- as.matrix(chromosomes)
  n_genes  <- ncol(chromosomes)
  n_nodes  <- n_genes + 2L
  pop_size <- nrow(chromosomes)

  if (is.null(lookup)) lookup <- build_weight_lookup(instance, n_nodes, num_obj)

  objectives <- matrix(0, nrow = pop_size, ncol = num_obj)

  for (p in seq_len(pop_size)) {
    edges <- decode_prufer(as.integer(chromosomes[p, ]), n_nodes)
    idx <- edges[, 1L] + (edges[, 2L] - 1L) * n_nodes
    for (k in seq_len(num_obj)) {
      objectives[p, k] <- sum(lookup[[k]][idx])
    }
  }

  colnames(objectives) <- paste0("objective_", seq_len(num_obj))
  cbind(chromosomes, objectives)
}
