# momst 0.1.1

* **Breaking change**: all output column names are now in English to match the
  rest of the documentation and vignettes. If you were using version 0.1.0,
  update your code as follows:
  * `objetivo_1`, `objetivo_2`, `objetivo_3` are now `objective_1`,
    `objective_2`, `objective_3` in `result$global_pareto` and in the matrices
    returned by `compute_objectives()`.
  * `pesos_1`, `pesos_2`, `pesos_3` are now `weight_1`, `weight_2`, `weight_3`
    in the data frames returned by `generate_instance()`.
  * `densidad` is now `density` in the matrix returned by
    `non_dominated_crowding()`.
* Default axis labels of `plot_pareto_front()` are now "Objective 1" and
  "Objective 2" (previously in Spanish).

# momst 0.1.0

* Initial public release of the package.
* Reference implementation of Parraga-Alava, Inostroza-Ponta and Dorn
  (2017), "Using local search strategies to improve the performance of
  NSGA-II for the Multi-Criteria Minimum Spanning Tree problem"
  (doi:10.1109/CEC.2017.7969432).
* Four solver variants exposed through `run_momst()`:
  `"base"`, `"PR"`, `"PLS"`, and `"TS"`.
* Support for 2 and 3 objective formulations.
* Two vignettes: *Getting Started with momst* and
  *Comparing the Four MO-MST Variants*.
* Plotting helpers `plot_pareto_front()` and `plot_best_tree()`.
