/* Runs the momst solver off the main thread so the page stays responsive. */
importScripts("momst.js");

self.onmessage = function (event) {
  var job = event.data;
  try {
    job.variants.forEach(function (variant, index) {
      var lines = [];
      var lastPost = 0;
      var res = self.momst.runMomst(job.instance, Object.assign({}, job.params, {
        variant: variant,
        log: function (line) { lines.push(line); },
        onProgress: function (info) {
          var now = Date.now();
          if (now - lastPost < 80) return;
          lastPost = now;
          self.postMessage({ type: "progress", variant: variant, index: index, iteration: info.iteration, generation: info.generation });
        }
      }));
      self.postMessage({
        type: "result",
        variant: variant,
        index: index,
        result: { globalPareto: res.globalPareto, elapsed: res.elapsed },
        log: lines
      });
    });
    self.postMessage({ type: "done" });
  } catch (err) {
    self.postMessage({ type: "error", message: String(err && err.message || err) });
  }
};
