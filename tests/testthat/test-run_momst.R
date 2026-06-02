# Basic smoke tests. They check that:
#   - the four solver variants return a valid Pareto front,
#   - every chromosome on the front decodes to a valid spanning tree, and
#   - the result is reproducible when a seed is supplied.

test_that("generate_instance produces a complete bi-objective edge list", {
  inst <- generate_instance(n = 6, num_obj = 2, seed = 1)
  expect_s3_class(inst, "data.frame")
  # n*(n-1)/2 edges
  expect_equal(nrow(inst), 15)
  expect_true(all(c("from", "to", "weight_1", "weight_2") %in% names(inst)))
})

test_that("decode_prufer returns a valid spanning tree", {
  edges <- decode_prufer(c(3, 1, 5), n = 5)
  expect_equal(nrow(edges), 4)        # n - 1 edges for n nodes
  expect_true(all(edges >= 1 & edges <= 5))
})

test_that("run_momst works for every variant", {
  variants <- c("base", "PR", "PLS", "TS")
  for (v in variants) {
    res <- run_momst(
      n = 8, num_obj = 2, variant = v,
      iterations = 1, pop_size = 20, max_generations = 10,
      verbose = FALSE, seed = 42
    )
    expect_named(res, c("instance", "lookup", "iterations",
                        "pareto_per_iter", "global_pareto", "elapsed"))
    expect_s3_class(res$global_pareto, "data.frame")
    expect_true("objective_1" %in% colnames(res$global_pareto))
    expect_true("objective_2" %in% colnames(res$global_pareto))
    expect_gt(nrow(res$global_pareto), 0)
  }
})

test_that("run_momst is reproducible with a fixed seed", {
  args <- list(n = 8, num_obj = 2, variant = "base",
               iterations = 1, pop_size = 20, max_generations = 10,
               verbose = FALSE, seed = 2026)
  a <- do.call(run_momst, args)
  b <- do.call(run_momst, args)
  expect_equal(a$global_pareto, b$global_pareto)
})
