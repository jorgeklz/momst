#' Plot a Pareto Front (2-objective case)
#'
#' @param result List returned by \code{\link{run_momst}}.
#' @param show_dominated Logical.
#' @return Invisible NULL.
#' @export
plot_pareto_front <- function(result, show_dominated = FALSE) {

  front <- result$global_pareto
  if (!"objective_1" %in% colnames(front)) {
    stop("global_pareto does not contain objective columns.")
  }
  front <- front[order(front$objective_1), ]

  col <- if (show_dominated) "red" else "steelblue"
  plot(front$objective_1, front$objective_2, pch = 19, col = col,
       xlab = "Objective 1", ylab = "Objective 2",
       main = "Pareto Front (MO-MST)")
  graphics::lines(front$objective_1, front$objective_2,
                  col = col, lty = 2, lwd = 1.2)
  invisible(NULL)
}


#' Plot the Best-Compromise Spanning Tree
#'
#' @param result List returned by \code{\link{run_momst}}.
#' @param n Integer.
#' @return Invisible NULL.
#' @export
plot_best_tree <- function(result, n) {

  if (!requireNamespace("igraph", quietly = TRUE)) {
    stop("Package 'igraph' is required for plot_best_tree(). ",
         "Install it with install.packages('igraph').")
  }

  front <- result$global_pareto
  obj_cols <- grep("^objective_", colnames(front), value = TRUE)
  totals <- rowSums(front[, obj_cols, drop = FALSE])
  best_idx <- which.min(totals)
  best <- front[best_idx, ]

  chr <- as.integer(unlist(best[1L:(n - 2L)]))
  edges <- decode_prufer(chr, n)

  g <- igraph::graph_from_edgelist(edges, directed = FALSE)

  labels <- vapply(seq_len(nrow(edges)), function(e) {
    parts <- vapply(seq_along(result$lookup), function(k) {
      round(result$lookup[[k]][edges[e, 1L], edges[e, 2L]], 1L)
    }, numeric(1L))
    paste0("(", paste(parts, collapse = ", "), ")")
  }, character(1L))

  plot(g, vertex.color = "lightblue", vertex.size = 25,
       vertex.label.color = "black", vertex.label.cex = 0.9,
       edge.label = labels, edge.label.cex = 0.7,
       edge.color = "gray40", edge.width = 2,
       main = paste0("Best compromise MST  (",
                     paste0("obj", seq_along(obj_cols), "=", round(unlist(best[obj_cols]), 1L),
                            collapse = " | "),
                     ")"))
  invisible(NULL)
}
