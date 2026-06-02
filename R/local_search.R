#' Tabu Search on the Current Pareto Front
#'
#' @param instance Edge-list \code{data.frame}.
#' @param pareto_pop Integer matrix \code{[k x (n - 2)]}.
#' @param num_obj Integer.
#' @param n Integer.
#' @param neighbour_frac Numeric.
#' @param pop_size Integer.
#' @param lookup Optional lookup.
#' @param verbose Logical.
#' @return data.frame of non-dominated chromosomes.
#' @export
tabu_search <- function(instance, pareto_pop, num_obj, n,
                        neighbour_frac = 0.05, pop_size,
                        lookup = NULL, verbose = FALSE) {

  genes <- n - 2L
  pareto_pop <- as.matrix(pareto_pop)

  if (nrow(pareto_pop) > pop_size) pareto_pop <- pareto_pop[seq_len(pop_size), seq_len(genes), drop = FALSE]
  else                              pareto_pop <- pareto_pop[, seq_len(genes), drop = FALSE]

  pareto_pop <- unique(pareto_pop)
  if (nrow(pareto_pop) <= 1L) {
    if (verbose) message(" ... Tabu Search skipped: a single solution ...")
    return(as.data.frame(pareto_pop))
  }

  num_neighbours <- max(1L, ceiling(neighbour_frac * n))
  if (num_neighbours > nrow(pareto_pop)) num_neighbours <- nrow(pareto_pop)

  best_neighbours <- list()

  for (s in seq_len(nrow(pareto_pop))) {

    tabu <- matrix(integer(0L), ncol = genes)
    neighbourhood <- vector("list", num_neighbours)
    base <- pareto_pop[s, ]

    for (i in seq_len(num_neighbours)) {
      pos  <- sample.int(genes, 1L)
      newv <- sample.int(n, 1L)
      child <- base
      child[pos] <- newv

      if (!.row_in_matrix(child, tabu)) {
        neighbourhood[[i]] <- child
      }
    }

    neighbourhood <- do.call(rbind, neighbourhood)
    if (is.null(neighbourhood) || nrow(neighbourhood) == 0L) next

    neighbourhood <- rbind(neighbourhood, base)
    neighbourhood <- unique(neighbourhood)

    tabu <- rbind(tabu, neighbourhood)
    if (nrow(tabu) > pop_size) tabu <- tabu[seq_len(pop_size), , drop = FALSE]
    tabu <- unique(tabu)

    if (nrow(neighbourhood) > 1L) {
      ev <- compute_objectives(instance, neighbourhood, num_obj, lookup)
      ev <- non_dominated_crowding(ev, num_obj)
      ev <- ev[ev[, "rankingIndex"] == 1L, , drop = FALSE]
      best_neighbours[[length(best_neighbours) + 1L]] <-
        ev[, seq_len(genes), drop = FALSE]
    } else {
      best_neighbours[[length(best_neighbours) + 1L]] <- neighbourhood
    }
  }

  if (length(best_neighbours) == 0L) return(as.data.frame(pareto_pop))

  best <- do.call(rbind, best_neighbours)
  if (nrow(best) > 1L) {
    ev <- compute_objectives(instance, best, num_obj, lookup)
    ev <- non_dominated_crowding(ev, num_obj)
    ev <- ev[ev[, "rankingIndex"] == 1L, , drop = FALSE]
    out <- unique(ev[, seq_len(genes), drop = FALSE])
    return(as.data.frame(out))
  }
  as.data.frame(pareto_pop)
}


#' Path Relinking on the Current Pareto Front
#'
#' @inheritParams tabu_search
#' @return data.frame of non-dominated chromosomes.
#' @export
path_relinking <- function(instance, pareto_pop, num_obj, n, pop_size,
                           lookup = NULL, verbose = FALSE) {

  genes <- n - 2L
  pareto_pop <- as.matrix(pareto_pop)

  if (nrow(pareto_pop) > pop_size) pareto_pop <- pareto_pop[seq_len(pop_size), seq_len(genes), drop = FALSE]
  else                              pareto_pop <- pareto_pop[, seq_len(genes), drop = FALSE]
  pareto_pop <- unique(pareto_pop)

  if (nrow(pareto_pop) <= 1L) {
    if (verbose) message(" ... Path Relinking skipped: a single solution ...")
    return(as.data.frame(pareto_pop))
  }

  if (nrow(pareto_pop) == 2L) {
    pairs <- rbind(c(1L, 2L), c(2L, 1L))
  } else {
    pn <- t(utils::combn(nrow(pareto_pop), 2L))
    pairs <- rbind(pn, pn[, 2:1])
  }

  path_solutions <- list()
  path_seen <- list()

  for (p in seq_len(nrow(pairs))) {
    s_init  <- as.integer(pareto_pop[pairs[p, 1L], ])
    s_guide <- as.integer(pareto_pop[pairs[p, 2L], ])

    while (!identical(s_init, s_guide)) {
      diff_idx <- which(s_init != s_guide)
      if (length(diff_idx) == 0L) break

      intermediates <- matrix(rep(s_init, length(diff_idx)),
                              nrow = length(diff_idx),
                              byrow = TRUE)
      intermediates[cbind(seq_along(diff_idx), diff_idx)] <- s_guide[diff_idx]
      intermediates <- unique(intermediates)

      if (nrow(intermediates) > 1L) {
        ev <- compute_objectives(instance, intermediates, num_obj, lookup)
        ev <- non_dominated_crowding(ev, num_obj)
        best <- as.integer(ev[1L, seq_len(genes)])

        key <- paste(best, collapse = "_")
        if (!is.null(path_seen[[key]])) break

        path_solutions[[length(path_solutions) + 1L]] <- best
        path_seen[[key]] <- TRUE
        s_init <- best
      } else {
        s_init <- as.integer(intermediates[1L, ])
      }
    }
  }

  if (length(path_solutions) > 0L) {
    paths <- do.call(rbind, path_solutions)
    combined <- rbind(pareto_pop, paths)
  } else {
    combined <- pareto_pop
  }
  combined <- unique(combined)

  ev <- compute_objectives(instance, combined, num_obj, lookup)
  ev <- non_dominated_crowding(ev, num_obj)
  ev <- ev[ev[, "rankingIndex"] == 1L, , drop = FALSE]
  out <- unique(ev[, seq_len(genes), drop = FALSE])
  as.data.frame(out)
}


#' Pareto Local Search
#'
#' @inheritParams tabu_search
#' @return data.frame of chromosomes.
#' @export
pareto_local_search <- function(instance, pareto_pop, num_obj, n,
                                neighbour_frac = 0.10, pop_size,
                                lookup = NULL, verbose = FALSE) {

  genes <- n - 2L
  pareto_pop <- as.matrix(pareto_pop)

  if (nrow(pareto_pop) > pop_size) pareto_pop <- pareto_pop[seq_len(pop_size), seq_len(genes), drop = FALSE]
  else                              pareto_pop <- pareto_pop[, seq_len(genes), drop = FALSE]
  archive_chr <- unique(pareto_pop)

  if (nrow(archive_chr) <= 1L) {
    if (verbose) message(" ... PLS skipped: a single solution ...")
    return(as.data.frame(archive_chr))
  }

  key_of <- function(r) paste(as.integer(r), collapse = "_")
  explored_set <- new.env(hash = TRUE, parent = emptyenv())

  num_neighbours <- max(1L, ceiling(neighbour_frac * n))
  if (num_neighbours > nrow(archive_chr)) num_neighbours <- nrow(archive_chr)

  max_outer <- 5L * nrow(archive_chr) + 50L
  outer_iter <- 0L

  repeat {
    outer_iter <- outer_iter + 1L
    if (outer_iter > max_outer) break

    archive_keys <- apply(archive_chr, 1L, key_of)
    unexplored <- which(vapply(archive_keys,
                               function(k) is.null(explored_set[[k]]),
                               logical(1L)))
    if (length(unexplored) == 0L) break

    s_idx <- unexplored[sample.int(length(unexplored), 1L)]
    s_row <- archive_chr[s_idx, ]
    s_key <- archive_keys[s_idx]
    pos <- sample.int(genes, 1L)

    for (i in seq_len(num_neighbours)) {
      newv <- sample.int(n, 1L)
      sprime <- s_row
      sprime[pos] <- newv

      combined <- unique(rbind(sprime, archive_chr))
      if (nrow(combined) <= 1L) next

      ev <- compute_objectives(instance, combined, num_obj, lookup)
      ev <- non_dominated_crowding(ev, num_obj)
      nd_chr <- ev[ev[, "rankingIndex"] == 1L, seq_len(genes), drop = FALSE]
      nd_chr <- unique(nd_chr)
      if (.row_in_matrix(sprime, nd_chr)) {
        archive_chr <- nd_chr
      }
    }

    explored_set[[s_key]] <- TRUE
  }

  as.data.frame(archive_chr)
}


#' Apply the Configured Local-Search Variant
#'
#' @param instance Edge-list \code{data.frame}.
#' @param pareto_pop Integer matrix.
#' @param num_obj Integer.
#' @param n Integer.
#' @param variant One of \code{"base"}, \code{"PR"}, \code{"PLS"}, \code{"TS"}.
#' @param pop_size Integer.
#' @param lookup Optional lookup.
#' @param verbose Logical.
#' @return data.frame.
#' @export
apply_local_search <- function(instance, pareto_pop, num_obj, n, variant,
                               pop_size, lookup = NULL, verbose = FALSE) {

  variant <- match.arg(variant, c("base", "PR", "PLS", "TS"))
  switch(variant,
    base = as.data.frame(pareto_pop),
    PR   = path_relinking(instance, pareto_pop, num_obj, n, pop_size, lookup, verbose),
    PLS  = pareto_local_search(instance, pareto_pop, num_obj, n, 0.10, pop_size, lookup, verbose),
    TS   = tabu_search(instance, pareto_pop, num_obj, n, 0.05, pop_size, lookup, verbose)
  )
}


.row_in_matrix <- function(r, m) {
  if (is.null(m) || nrow(m) == 0L) return(FALSE)
  any(rowSums(abs(sweep(m, 2L, r, FUN = "-"))) == 0)
}
