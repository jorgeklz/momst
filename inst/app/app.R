# momst interactive explorer
#
# Shiny front end for the momst package. It runs in two settings:
#   * locally, through momst::run_app(), using the installed package;
#   * in the browser (shinylive / webR), where the package sources are
#     bundled next to this file in the "momst_src" folder.

library(shiny)
library(bslib)

pkg_name <- "momst"
if (requireNamespace(pkg_name, quietly = TRUE)) {
  if (!paste0("package:", pkg_name) %in% search()) attachNamespace(pkg_name)
} else {
  src_dir <- if (dir.exists("momst_src")) "momst_src" else file.path("..", "..", "R")
  for (f in sort(list.files(src_dir, pattern = "\\.R$", full.names = TRUE))) {
    source(f, local = globalenv())
  }
}

variant_labels <- c(
  "NSGA-II (base)"            = "base",
  "NSGA-II + Path Relinking"  = "PR",
  "NSGA-II + Pareto LS"       = "PLS",
  "NSGA-II + Tabu Search"     = "TS"
)
# UTM green and gold lead the categorical order; the four hues pass the
# colour-vision checks, and each variant also has its own marker shape.
variant_colors <- c(base = "#2e8a1f", PR = "#c99a06", PLS = "#3a6fc4", TS = "#9b4f96")
variant_pch    <- c(base = 19, PR = 17, PLS = 15, TS = 18)

ink <- list(text = "#17220f", text2 = "#55604a", text3 = "#98a18d",
            border = "#e1e5db", surface2 = "#f0f2ec", g1 = "#1e6b14", g6 = "#e2f2da")

chart_par <- function(mar = c(4.2, 4.6, 1, 1)) {
  graphics::par(mar = mar, family = "sans", col.axis = ink$text2, col.lab = ink$text2,
                fg = ink$text3, cex.axis = 0.85, cex.lab = 0.95, las = 1, tcl = -0.25,
                mgp = c(2.8, 0.6, 0))
}

# ---------------------------------------------------------------- helpers ---

read_instance_file <- function(path) {
  first <- readLines(path, n = 1L, warn = FALSE)
  sep <- if (grepl(",", first)) "," else if (grepl(";", first)) ";" else ""
  inst <- utils::read.table(path, header = TRUE, sep = sep,
                            stringsAsFactors = FALSE, strip.white = TRUE)
  names(inst) <- tolower(trimws(names(inst)))
  w_cols <- grep("^weight_[0-9]+$", names(inst), value = TRUE)
  if (!all(c("from", "to") %in% names(inst)) || length(w_cols) < 2L) {
    stop("The file needs the columns 'from', 'to', 'weight_1', 'weight_2' ",
         "(and optionally 'weight_3').")
  }
  num_obj <- min(length(w_cols), 3L)
  inst <- inst[, c("from", "to", paste0("weight_", seq_len(num_obj)))]
  inst$from <- as.integer(inst$from)
  inst$to <- as.integer(inst$to)
  n <- max(c(inst$from, inst$to))
  if (min(c(inst$from, inst$to)) < 1L) stop("Node labels must start at 1.")
  if (nrow(inst) != n * (n - 1L) / 2L) {
    stop(sprintf("A complete graph with %d nodes needs %d edges, the file has %d.",
                 n, n * (n - 1L) / 2L, nrow(inst)))
  }
  list(instance = inst, n = n, num_obj = num_obj)
}

front_objectives <- function(front) {
  front[, grep("^objective_", names(front)), drop = FALSE]
}

# Area dominated by a two objective front (minimisation) up to `ref`.
hypervolume_2d <- function(obj, ref) {
  obj <- as.matrix(obj)
  obj <- obj[obj[, 1L] < ref[1L] & obj[, 2L] < ref[2L], , drop = FALSE]
  if (nrow(obj) == 0L) return(0)
  obj <- obj[order(obj[, 1L], obj[, 2L]), , drop = FALSE]
  hv <- 0
  best_y <- ref[2L]
  for (i in seq_len(nrow(obj))) {
    if (obj[i, 2L] < best_y) {
      hv <- hv + (ref[1L] - obj[i, 1L]) * (best_y - obj[i, 2L])
      best_y <- obj[i, 2L]
    }
  }
  hv
}

# Layered layout of a tree: depth on the y axis, leaves spread on the x axis.
tree_layout <- function(edges, n) {
  adj <- vector("list", n)
  for (e in seq_len(nrow(edges))) {
    a <- edges[e, 1L]; b <- edges[e, 2L]
    adj[[a]] <- c(adj[[a]], b)
    adj[[b]] <- c(adj[[b]], a)
  }
  root <- which.max(lengths(adj))
  x <- rep(NA_real_, n); y <- rep(NA_real_, n)
  next_leaf <- 0
  place <- function(v, parent, depth) {
    y[v] <<- -depth
    kids <- setdiff(adj[[v]], parent)
    if (length(kids) == 0L) {
      x[v] <<- next_leaf
      next_leaf <<- next_leaf + 1
    } else {
      for (k in kids) place(k, v, depth + 1L)
      x[v] <<- mean(x[kids])
    }
  }
  place(root, 0L, 0L)
  cbind(x = x, y = y)
}

plot_tree <- function(chr, n, lookup, show_weights = TRUE) {
  edges <- decode_prufer(as.integer(chr), n)
  xy <- tree_layout(edges, n)
  op <- graphics::par(mar = c(0.5, 0.5, 0.5, 0.5), family = "sans")
  on.exit(graphics::par(op))
  plot(xy, type = "n", axes = FALSE, xlab = "", ylab = "",
       xlim = range(xy[, 1L]) + c(-0.6, 0.6),
       ylim = range(xy[, 2L]) + c(-0.5, 0.5))
  graphics::segments(xy[edges[, 1L], 1L], xy[edges[, 1L], 2L],
                     xy[edges[, 2L], 1L], xy[edges[, 2L], 2L],
                     col = ink$text3, lwd = 2)
  if (show_weights) {
    lab <- vapply(seq_len(nrow(edges)), function(e) {
      paste(vapply(lookup, function(L) format(round(L[edges[e, 1L], edges[e, 2L]], 1L)),
                   character(1L)), collapse = ", ")
    }, character(1L))
    # Labels sit closer to the child node, where sibling edges are further apart.
    up <- ifelse(xy[edges[, 1L], 2L] > xy[edges[, 2L], 2L], edges[, 1L], edges[, 2L])
    dn <- ifelse(up == edges[, 1L], edges[, 2L], edges[, 1L])
    mx <- xy[up, 1L] + 0.62 * (xy[dn, 1L] - xy[up, 1L])
    my <- xy[up, 2L] + 0.62 * (xy[dn, 2L] - xy[up, 2L])
    lab <- paste0("(", lab, ")")
    lcex <- if (length(lookup) > 2L) 0.65 else 0.75
    w <- graphics::strwidth(lab, cex = lcex) * 0.55
    h <- graphics::strheight(lab, cex = lcex) * 0.8
    graphics::rect(mx - w, my - h, mx + w, my + h, col = "white", border = NA)
    graphics::text(mx, my, lab, cex = lcex, col = ink$text2)
  }
  cex <- if (n <= 20L) 3.2 else if (n <= 40L) 2.4 else 1.8
  graphics::points(xy, pch = 21, bg = ink$g6, col = ink$g1, cex = cex, lwd = 1.6)
  graphics::text(xy, labels = seq_len(n), cex = if (n <= 40L) 0.8 else 0.6, col = ink$text, font = 2)
  invisible(edges)
}

plot_fronts <- function(runs, num_obj) {
  fronts <- lapply(runs, function(r) front_objectives(r$global_pareto))
  all_obj <- do.call(rbind, fronts)
  v <- names(fronts)
  if (num_obj == 2L) {
    op <- chart_par(); on.exit(graphics::par(op))
    plot(all_obj[, 1L], all_obj[, 2L], type = "n", bty = "n",
         xlab = "Objective 1", ylab = "Objective 2")
    graphics::abline(h = pretty(all_obj[, 2L]), v = pretty(all_obj[, 1L]), col = ink$surface2)
    graphics::box(bty = "l", col = ink$border)
    for (k in v) {
      f <- fronts[[k]][order(fronts[[k]][, 1L]), , drop = FALSE]
      graphics::lines(f[, 1L], f[, 2L], type = "s", col = variant_colors[[k]], lwd = 1.5)
      graphics::points(f[, 1L], f[, 2L], pch = variant_pch[[k]], col = "white", cex = 1.55)
      graphics::points(f[, 1L], f[, 2L], pch = variant_pch[[k]], col = variant_colors[[k]], cex = 1.1)
    }
    graphics::legend("topright", legend = v, col = variant_colors[v], pch = variant_pch[v],
                     lwd = 1.5, bty = "n", text.col = ink$text2, cex = 0.9, inset = 0.01)
  } else {
    grp <- rep(v, vapply(fronts, nrow, integer(1L)))
    op <- graphics::par(family = "sans", col.axis = ink$text2, fg = ink$text3)
    on.exit(graphics::par(op))
    graphics::pairs(all_obj, labels = paste("Objective", 1:3), pch = variant_pch[grp],
                    col = variant_colors[grp], cex = 0.9, gap = 0.6, cex.labels = 1.2,
                    oma = c(3, 3, 2, 11))
    graphics::par(xpd = NA)
    graphics::legend("right", legend = v, col = variant_colors[v], pch = variant_pch[v],
                     bty = "n", text.col = ink$text2)
  }
}

kpi <- function(label, value, unit = NULL, note = NULL, color = NULL, class = NULL) {
  div(class = paste("tarjeta", class),
      div(class = "kpi-valor", value, if (!is.null(unit)) tags$small(unit)),
      div(class = "kpi-etiqueta",
          if (!is.null(color)) span(class = "punto", style = paste0("background:", color)),
          label),
      if (!is.null(note)) div(class = "kpi-nota", note))
}

empty_state <- function(title, text) div(class = "vacio", tags$strong(title), text)

# --------------------------------------------------------------------- UI ---

ui <- page_sidebar(
  window_title = "momst explorer",
  fillable = FALSE,
  theme = bs_theme(
    version = 5,
    bg = "#f7f8f5", fg = "#17220f",
    primary = "#1e6b14", secondary = "#55604a", success = "#2e8a1f",
    info = "#2e8a1f", warning = "#d4a80a", danger = "#b3261e",
    base_font = "'Inter', system-ui, sans-serif",
    heading_font = "'Inter', system-ui, sans-serif",
    "font-size-base" = "0.875rem", "border-radius" = "8px"
  ),
  sidebar = sidebar(
    width = 300, bg = "#ffffff", fg = "#17220f",
    div(class = "sidebar-logo",
        tags$img(src = "utm-logo.png", alt = "Technical University of Manabi logo"),
        tags$h1("momst explorer"),
        tags$p("Multi-objective minimum spanning tree")),
    div(class = "seccion-nav", "Parameters"),
    accordion(
      open = c("Instance", "Solver"),
      accordion_panel(
        "Instance",
        radioButtons("inst_src", NULL, inline = TRUE,
                     c("Random" = "random", "Upload file" = "upload")),
        conditionalPanel(
          "input.inst_src == 'random'",
          numericInput("n", "Nodes (n)", 10, min = 3, max = 60, step = 1),
          radioButtons("num_obj", "Objectives", c("2" = 2, "3" = 3), inline = TRUE),
          sliderInput("range_a", "Weight range, objective 1", 0, 300, c(10, 100)),
          sliderInput("range_b", "Weight range, objective 2", 0, 300, c(10, 50)),
          conditionalPanel("input.num_obj == 3",
            sliderInput("range_c", "Weight range, objective 3", 0, 300, c(30, 200))),
          numericInput("inst_seed", "Instance seed", 12345, step = 1)
        ),
        conditionalPanel(
          "input.inst_src == 'upload'",
          fileInput("inst_file", "Edge list (.csv or .txt)", accept = c(".csv", ".txt")),
          helpText("Columns: from, to, weight_1, weight_2 and optionally weight_3.",
                   "One row per edge of a complete graph with nodes 1..n.")
        )
      ),
      accordion_panel(
        "Solver",
        checkboxGroupInput("variants", "Variants", variant_labels, selected = "base"),
        numericInput("iterations", "Independent runs", 2, min = 1, max = 30, step = 1),
        numericInput("pop_size", "Population size (even)", 30, min = 4, max = 200, step = 2),
        numericInput("max_generations", "Max generations", 30, min = 1, max = 500, step = 1),
        numericInput("seed", "Solver seed", 2026, step = 1)
      ),
      accordion_panel(
        "NSGA-II",
        sliderInput("cross_rate", "Crossover rate", 0, 1, 0.80, step = 0.05),
        sliderInput("mut_rate", "Mutation rate", 0, 1, 0.05, step = 0.01),
        numericInput("tour_size", "Tournament size", 2, min = 2, max = 10, step = 1),
        numericInput("convergence_window", "Convergence window", 10, min = 2, max = 100, step = 1)
      )
    ),
    div(class = "sidebar-acciones",
        actionButton("run", "Run solver", icon = icon("play"), class = "btn-primary w-100"),
        div(class = "aviso",
            "Larger graphs and the local search variants take longer,",
            "especially when the app runs inside the browser.")),
    div(class = "sidebar-pie",
        "Jorge Parraga-Alava, Ph.D",
        tags$br(),
        tags$a(href = "https://doi.org/10.1109/CEC.2017.7969432", target = "_blank",
               "doi:10.1109/CEC.2017.7969432"))
  ),
  tags$head(
    tags$link(rel = "preconnect", href = "https://fonts.googleapis.com"),
    tags$link(rel = "preconnect", href = "https://fonts.gstatic.com", crossorigin = NA),
    tags$link(rel = "stylesheet",
              href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap"),
    tags$link(rel = "stylesheet", href = "utm.css"),
    tags$link(rel = "icon", href = "utm-logo.png")
  ),
  div(class = "franja-utm"),
  div(class = "encabezado",
      tags$h2(class = "titulo-pagina", "Multi-Objective Minimum Spanning Tree"),
      tags$p(class = "subtitulo-pagina",
             "NSGA-II with Prufer encoding and optional Pareto local search on complete",
             "weighted graphs. Every run calls ", tags$code("momst::run_momst()"), ".")),
  uiOutput("kpis"),
  navset_card_underline(
    id = "tabs",
    nav_panel(
      "Pareto front",
      div(class = "titulo-tarjeta", "Global Pareto front by variant"),
      uiOutput("front_empty"),
      plotOutput("front_plot", height = "460px")
    ),
    nav_panel(
      "Spanning tree",
      layout_columns(
        col_widths = breakpoints(sm = 12, lg = c(4, 8)),
        div(
          div(class = "titulo-tarjeta", "Solution"),
          selectInput("tree_variant", "Variant", choices = NULL),
          radioButtons("tree_pick", NULL,
                       c("Best compromise (min. sum)" = "sum",
                         "Best compromise (min. normalised sum)" = "norm",
                         "Choose by row" = "row")),
          conditionalPanel("input.tree_pick == 'row'",
                           numericInput("tree_row", "Row of the Pareto table", 1, min = 1, step = 1)),
          checkboxInput("show_weights", "Show edge weights on the plot", TRUE),
          div(class = "titulo-tarjeta mt-3", "Edges"),
          div(class = "tabla-envoltura", tableOutput("tree_edges"))
        ),
        div(
          uiOutput("tree_title"),
          plotOutput("tree_plot", height = "560px")
        )
      )
    ),
    nav_panel(
      "Pareto solutions",
      div(class = "barra-acciones",
          selectInput("table_variant", "Variant", choices = NULL),
          downloadButton("dl_front", "Download CSV", class = "btn-default")),
      div(class = "tabla-envoltura", tableOutput("front_table"))
    ),
    nav_panel(
      "Variant comparison",
      div(class = "titulo-tarjeta", "Summary"),
      div(class = "tabla-envoltura", tableOutput("compare_table")),
      helpText("Hypervolume (2 objectives only) uses a common reference point set 10% beyond",
               "the worst value observed across all variants. Higher is better."),
      div(class = "titulo-tarjeta mt-4", "Runtime per variant (seconds)"),
      plotOutput("time_plot", height = "260px")
    ),
    nav_panel(
      "Instance",
      div(class = "barra-acciones",
          downloadButton("dl_inst", "Download instance", class = "btn-default")),
      div(class = "tabla-envoltura", tableOutput("inst_table"))
    ),
    nav_panel(
      "Log",
      div(class = "registro", verbatimTextOutput("log"))
    ),
    nav_panel(
      "About",
      div(class = "acerca", markdown("
### What it does

**momst** solves the Multi-Criteria Minimum Spanning Tree problem on complete
weighted graphs with NSGA-II, optionally combined with one of three Pareto
local search operators. Chromosomes are Prufer sequences, so every individual
decodes to a valid spanning tree.

| Variant | Local search |
|:--|:--|
| `base` | None (pure NSGA-II) |
| `PR`   | Path Relinking |
| `PLS`  | Pareto Local Search |
| `TS`   | Tabu Search |

### The same analysis in R

```r
library(momst)
inst <- generate_instance(n = 10, num_obj = 2, seed = 12345)
res  <- run_momst(instance = inst, n = 10, num_obj = 2, variant = \"PLS\",
                  iterations = 2, pop_size = 30, max_generations = 30,
                  seed = 2026, verbose = FALSE)
plot_pareto_front(res)
```

### Reference

Parraga-Alava, J., Inostroza-Ponta, M. and Dorn, M. (2017).
*Using local search strategies to improve the performance of NSGA-II for the
Multi-Criteria Minimum Spanning Tree problem.* IEEE CEC 2017, pp. 1818 to 1825.
[doi:10.1109/CEC.2017.7969432](https://doi.org/10.1109/CEC.2017.7969432)

Source code: <https://github.com/jorgeklz/momst>
"))
    )
  )
)

# ----------------------------------------------------------------- server ---

server <- function(input, output, session) {

  instance <- reactive({
    if (input$inst_src == "upload") {
      req(input$inst_file)
      tryCatch(read_instance_file(input$inst_file$datapath),
               error = function(e) validate(need(FALSE, conditionMessage(e))))
    } else {
      n <- as.integer(input$n)
      validate(need(!is.na(n) && n >= 3L && n <= 60L, "Nodes must be between 3 and 60."))
      num_obj <- as.integer(input$num_obj)
      list(instance = generate_instance(n, num_obj, input$range_a, input$range_b,
                                        if (is.null(input$range_c)) c(30, 200) else input$range_c,
                                        seed = as.integer(input$inst_seed)),
           n = n, num_obj = num_obj)
    }
  })

  runs <- reactiveVal(NULL)
  log_text <- reactiveVal("Press 'Run solver' to start.")

  observeEvent(input$run, {
    inst <- instance()
    variants <- input$variants
    if (length(variants) == 0L) {
      showNotification("Select at least one variant.", type = "warning")
      return()
    }
    pop_size <- as.integer(input$pop_size)
    if (is.na(pop_size) || pop_size < 4L || pop_size %% 2L != 0L) {
      showNotification("Population size must be an even number of at least 4.", type = "error")
      return()
    }
    out <- list()
    logs <- character(0L)
    withProgress(message = "Running momst", value = 0, {
      for (i in seq_along(variants)) {
        v <- variants[i]
        incProgress(0, detail = sprintf("variant %s (%d of %d)", v, i, length(variants)))
        res <- NULL
        txt <- utils::capture.output(
          res <- tryCatch(
            run_momst(
              instance           = inst$instance,
              n                  = inst$n,
              num_obj            = inst$num_obj,
              variant            = v,
              iterations         = as.integer(input$iterations),
              pop_size           = pop_size,
              tour_size          = as.integer(input$tour_size),
              cross_rate         = input$cross_rate,
              mut_rate           = input$mut_rate,
              max_generations    = as.integer(input$max_generations),
              convergence_window = as.integer(input$convergence_window),
              verbose            = TRUE,
              seed               = as.integer(input$seed)
            ),
            error = function(e) e
          )
        )
        logs <- c(logs, txt)
        if (inherits(res, "error")) {
          showNotification(paste0("Variant ", v, " failed: ", conditionMessage(res)),
                           type = "error", duration = NULL)
        } else {
          out[[v]] <- res
        }
        incProgress(1 / length(variants))
      }
    })
    if (length(out) == 0L) return()
    attr(out, "n") <- inst$n
    attr(out, "num_obj") <- inst$num_obj
    runs(out)
    log_text(paste(logs, collapse = "\n"))
    for (id in c("tree_variant", "table_variant")) {
      updateSelectInput(session, id, choices = names(out), selected = names(out)[1L])
    }
  })

  front_of <- function(v) {
    r <- runs(); req(r, v %in% names(r))
    f <- r[[v]]$global_pareto
    f[order(f$objective_1), , drop = FALSE]
  }

  output$kpis <- renderUI({
    inst <- instance()
    r <- runs()
    boxes <- list(
      kpi("Nodes", inst$n, class = "kpi-instancia",
          note = sprintf("%d edges, complete graph", nrow(inst$instance))),
      kpi("Objectives", inst$num_obj, class = "kpi-instancia",
          note = if (input$inst_src == "upload") "uploaded instance" else "random instance")
    )
    if (!is.null(r)) {
      boxes <- c(boxes, lapply(names(r), function(v) {
        kpi(names(variant_labels)[variant_labels == v], nrow(r[[v]]$global_pareto),
            unit = "solutions", note = sprintf("%.2f s", r[[v]]$elapsed),
            color = variant_colors[[v]])
      }))
    }
    div(class = "cuadricula kpis", boxes)
  })

  output$front_empty <- renderUI({
    if (is.null(runs())) {
      empty_state("No results yet",
                  "Configure the instance and the solver on the left, then press Run solver.")
    }
  })

  output$front_plot <- renderPlot({
    r <- runs()
    req(r)
    plot_fronts(r, attr(r, "num_obj"))
  }, res = 96)

  selected_solution <- reactive({
    v <- input$tree_variant; req(v)
    f <- front_of(v)
    obj <- as.matrix(front_objectives(f))
    idx <- switch(input$tree_pick,
      sum  = which.min(rowSums(obj)),
      norm = {
        rng <- apply(obj, 2L, function(x) diff(range(x)))
        rng[rng == 0] <- 1
        which.min(rowSums(sweep(sweep(obj, 2L, apply(obj, 2L, min)), 2L, rng, "/")))
      },
      row  = {
        i <- as.integer(input$tree_row)
        validate(need(!is.na(i) && i >= 1L && i <= nrow(f),
                      sprintf("Row must be between 1 and %d.", nrow(f))))
        i
      })
    list(variant = v, row = idx, solution = f[idx, , drop = FALSE])
  })

  output$tree_plot <- renderPlot({
    r <- runs()
    validate(need(r, "Run the solver first."))
    s <- selected_solution()
    n <- attr(r, "n")
    plot_tree(unlist(s$solution[1L:(n - 2L)]), n, r[[s$variant]]$lookup,
              show_weights = isTRUE(input$show_weights))
  }, res = 96)

  output$tree_title <- renderUI({
    req(runs())
    s <- selected_solution()
    obj <- unlist(front_objectives(s$solution))
    div(class = "titulo-grafico",
        span(class = "punto", style = paste0("background:", variant_colors[[s$variant]], ";margin-right:6px")),
        sprintf("%s, row %d", s$variant, s$row),
        span(style = "color: var(--texto2); font-weight: 500; margin-left: 10px",
             paste0("objective ", seq_along(obj), " = ", format(round(obj, 2), nsmall = 2),
                    collapse = "  ·  ")))
  })

  output$tree_edges <- renderTable({
    r <- runs(); req(r)
    s <- selected_solution()
    n <- attr(r, "n")
    e <- decode_prufer(as.integer(unlist(s$solution[1L:(n - 2L)])), n)
    lk <- r[[s$variant]]$lookup
    tab <- data.frame(from = e[, 1L], to = e[, 2L])
    for (k in seq_along(lk)) tab[[paste0("w", k)]] <- lk[[k]][e]
    tab
  }, digits = 2, striped = FALSE, spacing = "xs")

  front_table_data <- reactive({
    r <- runs(); req(r)
    v <- input$table_variant; req(v)
    n <- attr(r, "n")
    f <- front_of(v)
    chr <- apply(f[, 1L:(n - 2L), drop = FALSE], 1L, paste, collapse = "-")
    data.frame(row = seq_len(nrow(f)), front_objectives(f), prufer = chr,
               row.names = NULL, check.names = FALSE)
  })

  output$front_table <- renderTable(front_table_data(), digits = 3, striped = FALSE,
                                    hover = TRUE, spacing = "s")

  output$dl_front <- downloadHandler(
    filename = function() sprintf("momst_pareto_%s.csv", input$table_variant),
    content = function(file) utils::write.csv(front_table_data(), file, row.names = FALSE)
  )

  output$compare_table <- renderTable({
    r <- runs()
    validate(need(r, "Run the solver with one or more variants to compare them."))
    num_obj <- attr(r, "num_obj")
    fronts <- lapply(r, function(x) as.matrix(front_objectives(x$global_pareto)))
    tab <- data.frame(
      variant   = names(r),
      solutions = vapply(fronts, nrow, integer(1L)),
      seconds   = vapply(r, function(x) x$elapsed, numeric(1L))
    )
    for (k in seq_len(num_obj)) {
      tab[[paste0("min objective ", k)]] <- vapply(fronts, function(f) min(f[, k]), numeric(1L))
    }
    if (num_obj == 2L) {
      all_obj <- do.call(rbind, fronts)
      ref <- apply(all_obj, 2L, max) * 1.1
      tab$hypervolume <- vapply(fronts, hypervolume_2d, numeric(1L), ref = ref)
    }
    tab
  }, digits = 2, striped = FALSE)

  output$time_plot <- renderPlot({
    r <- runs(); req(r)
    t <- vapply(r, function(x) x$elapsed, numeric(1L))
    op <- chart_par(mar = c(3.5, 4.5, 0.5, 1)); on.exit(graphics::par(op))
    graphics::barplot(t, horiz = TRUE, col = variant_colors[names(t)], border = NA,
                      xlab = "Seconds", space = 0.45, axes = FALSE)
    graphics::axis(1, col = ink$border, col.ticks = ink$border)
  }, res = 96)

  output$inst_table <- renderTable(instance()$instance, digits = 2, striped = FALSE, spacing = "xs")

  output$dl_inst <- downloadHandler(
    filename = function() sprintf("momst_instance_n%d_obj%d.csv",
                                  instance()$n, instance()$num_obj),
    content = function(file) utils::write.csv(instance()$instance, file, row.names = FALSE)
  )

  output$log <- renderText(log_text())
}

shinyApp(ui, server)
