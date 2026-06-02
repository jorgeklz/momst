#' Run the MO-MST NSGA-II Solver
#'
#' Single entry point that replaces the original \code{main.R} script.
#'
#' @param instance Optional \code{data.frame}.
#' @param instance_file Optional path.
#' @param n Integer.
#' @param num_obj Integer in \{2, 3\}.
#' @param variant One of \code{"base"}, \code{"PR"}, \code{"PLS"}, \code{"TS"}.
#' @param iterations Integer or two-length integer \code{c(min_iter, max_iter)}.
#' @param pop_size Integer (must be even).
#' @param tour_size Integer.
#' @param cross_rate Numeric in \[0, 1\].
#' @param mut_rate Numeric in \[0, 1\].
#' @param max_generations Integer.
#' @param convergence_window Integer.
#' @param range_a,range_b,range_c Weight ranges for instance generation.
#' @param save_dir Optional directory for per-iteration result files.
#' @param verbose Logical.
#' @param seed Optional integer.
#' @return Invisible list with the solution data.
#' @references
#' Parraga-Alava, J., Inostroza-Ponta, M., & Dorn, M. (2017).
#' Using local search strategies to improve the performance of NSGA-II for
#' the Multi-Criteria Minimum Spanning Tree problem. In
#' \emph{2017 IEEE Congress on Evolutionary Computation (CEC)}
#' (pp. 1818-1825). IEEE. \doi{10.1109/CEC.2017.7969432}
#' @examples
#' \dontrun{
#' res <- run_momst(n = 10, num_obj = 2, iterations = 3,
#'                  pop_size = 20, max_generations = 30,
#'                  variant = "base", seed = 1)
#' head(res$global_pareto)
#' }
#' @export
run_momst <- function(instance = NULL,
                      instance_file = NULL,
                      n = 10L,
                      num_obj = 2L,
                      variant = c("base", "PR", "PLS", "TS"),
                      iterations = 10L,
                      pop_size = 50L,
                      tour_size = 2L,
                      cross_rate = 0.80,
                      mut_rate = 0.05,
                      max_generations = 100L,
                      convergence_window = 10L,
                      range_a = c(10, 100),
                      range_b = c(10, 50),
                      range_c = c(30, 200),
                      save_dir = NULL,
                      verbose = TRUE,
                      seed = NULL) {

  variant <- match.arg(variant)
  if (pop_size %% 2L != 0L) stop("pop_size must be even.")
  if (!is.null(seed)) set.seed(seed)

  if (length(iterations) == 1L) {
    min_iter <- 1L
    max_iter <- as.integer(iterations)
  } else {
    min_iter <- as.integer(iterations[1L])
    max_iter <- as.integer(iterations[2L])
  }

  if (is.null(instance)) {
    if (!is.null(instance_file) && file.exists(instance_file)) {
      instance <- utils::read.table(instance_file, header = TRUE, sep = " ")
    } else {
      instance <- generate_instance(n, num_obj, range_a, range_b, range_c, seed = 12345L)
      if (!is.null(instance_file)) {
        dir.create(dirname(instance_file), showWarnings = FALSE, recursive = TRUE)
        utils::write.table(instance, file = instance_file, row.names = FALSE)
      }
    }
  }

  lookup <- build_weight_lookup(instance, n, num_obj)

  if (verbose) {
    cat(" ################################# \n")
    cat(" Evaluating mo-MST \n")
    cat(" Algorithm: NSGA-II \n")
    cat(" Local search: ", variant, "\n", sep = "")
    cat(" nodes: ", n, " | weights: ", num_obj, "\n", sep = "")
    cat(" Iterations ", min_iter, " to ", max_iter, "\n", sep = "")
    cat(" ################################# \n")
  }

  t0 <- proc.time()
  pareto_per_iter <- list()
  iter_finals <- list()

  for (iter in min_iter:max_iter) {

    if (verbose) cat(" iteration ", iter, "\n", sep = "")

    pop_P <- generate_prufer_population(n, pop_size)
    convergence <- if (num_obj == 2L)
      data.frame(o1 = numeric(0L), o2 = numeric(0L))
    else
      data.frame(o1 = numeric(0L), o2 = numeric(0L), o3 = numeric(0L))

    g <- 1L
    while (g <= max_generations) {
      if (verbose) cat("  generation: ", g, "\n", sep = "")

      pop_P <- compute_objectives(instance, pop_P, num_obj, lookup)
      pop_P <- non_dominated_crowding(pop_P, num_obj)

      obj_cols <- (n - 1L):((n - 2L) + num_obj)
      pop_S <- tournament_selection(pop_P[, -obj_cols, drop = FALSE], pop_size, tour_size)

      pop_C <- uniform_crossover(pop_S[, 1L:(ncol(pop_S) - 2L), drop = FALSE], pop_size, cross_rate)
      pop_M <- random_mutation(pop_C, pop_size, mut_rate)

      pop_R <- rbind(pop_P[, 1L:(n - 2L), drop = FALSE], pop_M)
      pop_R <- compute_objectives(instance, pop_R, num_obj, lookup)
      pop_R <- non_dominated_crowding(pop_R, num_obj)

      pareto <- pop_R[pop_R[, "rankingIndex"] == 1L, 1L:(n - 2L), drop = FALSE]
      pop_R  <- apply_local_search(instance, pareto, num_obj, n, variant, pop_size, lookup, verbose)
      pop_R  <- as.data.frame(pop_R)
      pop_R  <- pop_R[stats::complete.cases(pop_R), , drop = FALSE]

      if (nrow(pop_R) > 1L) {
        ev <- compute_objectives(instance, as.matrix(pop_R[, 1L:(n - 2L), drop = FALSE]), num_obj, lookup)
        ev <- non_dominated_crowding(ev, num_obj)
        row <- if (num_obj == 2L)
          data.frame(o1 = min(ev[, "objective_1"]), o2 = min(ev[, "objective_2"]))
        else
          data.frame(o1 = min(ev[, "objective_1"]), o2 = min(ev[, "objective_2"]), o3 = min(ev[, "objective_3"]))
        convergence <- rbind(convergence, row)
        tab <- as.data.frame(table(convergence))
        tab <- tab[tab$Freq > 0L, ]
        if (max(tab$Freq) >= convergence_window) {
          if (verbose) cat("   ... convergence ... \n")
          g <- max_generations
        }
      }

      if (nrow(pop_R) < pop_size) {
        extra <- generate_prufer_population(n, pop_size)
        n_keep <- nrow(pop_R)
        kept_chr <- as.matrix(pop_R[, 1L:(n - 2L), drop = FALSE])
        pop_R <- rbind(kept_chr, extra[(n_keep + 1L):pop_size, , drop = FALSE])
        pop_R <- as.data.frame(pop_R)
      }

      pop_P <- as.matrix(pop_R[seq_len(pop_size), 1L:(n - 2L), drop = FALSE])
      g <- g + 1L
    }

    iter_finals[[iter]] <- as.data.frame(pop_R[seq_len(pop_size), , drop = FALSE])
  }

  for (iter in min_iter:max_iter) {
    chr <- as.matrix(iter_finals[[iter]][, 1L:(n - 2L), drop = FALSE])
    ev <- compute_objectives(instance, chr, num_obj, lookup)
    ev <- non_dominated_crowding(ev, num_obj)
    pareto <- ev[ev[, "rankingIndex"] == 1L, , drop = FALSE]
    if (nrow(pareto) > 1L) {
      pareto <- pareto[!duplicated(pareto[, 1L:(n - 2L)]), , drop = FALSE]
    }
    pareto_per_iter[[iter]] <- as.data.frame(pareto)
  }

  all_pareto <- do.call(rbind, pareto_per_iter)
  if (!is.null(all_pareto) && nrow(all_pareto) > 1L) {
    chr <- as.matrix(all_pareto[, 1L:(n - 2L), drop = FALSE])
    ev <- compute_objectives(instance, chr, num_obj, lookup)
    ev <- non_dominated_crowding(ev, num_obj)
    global <- ev[ev[, "rankingIndex"] == 1L, , drop = FALSE]
    global <- as.data.frame(global)
    global <- global[!duplicated(global[, 1L:(n - 2L)]), , drop = FALSE]
  } else {
    global <- as.data.frame(all_pareto)
  }

  if (!is.null(save_dir)) {
    dir.create(save_dir, showWarnings = FALSE, recursive = TRUE)
    for (iter in min_iter:max_iter) {
      utils::write.table(
        pareto_per_iter[[iter]],
        file = file.path(save_dir,
                         sprintf("results_nodes_%d_objectives_%d_iteration_%d_%s.txt",
                                 n, num_obj, iter, variant)),
        row.names = FALSE
      )
    }
  }

  elapsed <- (proc.time() - t0)[3L]
  if (verbose) cat("Total time: ", round(elapsed, 2), " seconds\n", sep = "")

  invisible(list(
    instance        = instance,
    lookup          = lookup,
    iterations      = iter_finals,
    pareto_per_iter = pareto_per_iter,
    global_pareto   = global,
    elapsed         = as.numeric(elapsed)
  ))
}
