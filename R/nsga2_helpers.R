fast_non_dominated_sort <- function(obj_matrix) {

  obj_matrix <- as.matrix(obj_matrix)
  N <- nrow(obj_matrix)
  if (N == 0L) return(list())
  if (N == 1L) return(list(1L))

  dominated_count <- integer(N)
  dominates       <- vector("list", N)
  for (i in seq_len(N)) dominates[[i]] <- integer(0L)

  for (i in seq_len(N - 1L)) {
    oi <- obj_matrix[i, ]
    for (j in (i + 1L):N) {
      oj <- obj_matrix[j, ]
      diff <- oi - oj
      le_ij <- !any(diff > 0)
      lt_ij <- any(diff < 0)
      le_ji <- !any(diff < 0)
      lt_ji <- any(diff > 0)

      if (le_ij && lt_ij) {
        dominates[[i]] <- c(dominates[[i]], j)
        dominated_count[j] <- dominated_count[j] + 1L
      } else if (le_ji && lt_ji) {
        dominates[[j]] <- c(dominates[[j]], i)
        dominated_count[i] <- dominated_count[i] + 1L
      }
    }
  }

  fronts <- list()
  k <- 1L
  current <- which(dominated_count == 0L)
  while (length(current) > 0L) {
    fronts[[k]] <- current
    next_front <- integer(0L)
    for (i in current) {
      for (j in dominates[[i]]) {
        dominated_count[j] <- dominated_count[j] - 1L
        if (dominated_count[j] == 0L) next_front <- c(next_front, j)
      }
    }
    current <- next_front
    k <- k + 1L
  }
  fronts
}


crowding_distance_per_front <- function(obj_matrix, fronts, ranges) {

  N <- nrow(obj_matrix)
  M <- ncol(obj_matrix)
  cd <- matrix(0, nrow = N, ncol = M)

  for (front in fronts) {
    lf <- length(front)
    if (lf == 0L) next
    if (lf <= 2L) {
      cd[front, ] <- Inf
      next
    }
    for (m in seq_len(M)) {
      ord <- front[order(obj_matrix[front, m])]
      cd[ord[1L], m] <- Inf
      cd[ord[lf], m] <- Inf
      r <- ranges[m]
      if (is.finite(r) && r > 0) {
        inner <- 2L:(lf - 1L)
        cd[ord[inner], m] <-
          (obj_matrix[ord[inner + 1L], m] - obj_matrix[ord[inner - 1L], m]) / r
      }
    }
  }
  cd
}


#' Assign Pareto Rank and Crowding Distance
#'
#' @param population Numeric matrix \code{[N x (vars + num_obj)]}.
#' @param num_obj Integer.
#' @return Matrix with extra columns \code{rankingIndex} and \code{density}.
#' @export
non_dominated_crowding <- function(population, num_obj) {

  population <- as.matrix(population)
  pop_size <- nrow(population)
  total_cols <- ncol(population)
  var_no <- total_cols - num_obj

  obj_cols <- (var_no + 1L):total_cols
  obj <- population[, obj_cols, drop = FALSE]

  fronts <- fast_non_dominated_sort(obj)

  ranking_index <- integer(pop_size)
  for (i in seq_along(fronts)) ranking_index[fronts[[i]]] <- i

  ranges <- apply(obj, 2L, function(x) max(x) - min(x))
  cd <- crowding_distance_per_front(obj, fronts, ranges)
  density <- rowSums(cd)

  result <- cbind(population, rankingIndex = ranking_index, density = density)
  ord <- order(ranking_index, -density)
  result[ord, , drop = FALSE]
}


#' Tournament Selection
#'
#' @param population Matrix with last two columns being \code{rankingIndex}
#'   and \code{density}.
#' @param pop_size Integer.
#' @param tour_size Integer.
#' @return Selected subpopulation matrix.
#' @export
tournament_selection <- function(population, pop_size, tour_size) {

  population <- as.matrix(population)
  nc <- ncol(population)
  N <- nrow(population)
  rank_col <- nc - 1L
  dens_col <- nc

  ranks <- population[, rank_col]
  dens  <- population[, dens_col]

  tournaments <- matrix(sample.int(N, pop_size * tour_size, replace = TRUE),
                        nrow = pop_size, ncol = tour_size)
  winners <- apply(tournaments, 1L, function(idx) {
    o <- order(ranks[idx], -dens[idx])
    idx[o[1L]]
  })
  population[winners, , drop = FALSE]
}
