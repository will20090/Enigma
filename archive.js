(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>=?*+".split("");

  function rand(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function Scrambler(el) {
    this.el = el;
    this.frameReq = 0;
    this.update = this.update.bind(this);
  }
  Scrambler.prototype.setText = function (newText, opts) {
    opts = opts || {};
    var seq = opts.seq;
    var dur = opts.dur || 36;
    var self = this;
    var oldText = this.el.textContent;
    var len = Math.max(oldText.length, newText.length);
    var done = new Promise(function (res) { self.resolve = res; });

    if (reduceMotion) {
      this.el.textContent = newText;
      this.resolve = function () {};
      return Promise.resolve();
    }

    this.queue = [];
    for (var i = 0; i < len; i++) {
      var to = newText[i] || "";
      var start, end;
      if (seq) {
        start = Math.round((i / len) * dur * 0.9) + ((Math.random() * 6) | 0);
        end = start + dur + ((Math.random() * dur) | 0);
      } else {
        start = (Math.random() * dur) | 0;
        end = start + ((Math.random() * dur) | 0) + dur;
      }
      this.queue.push({ to: to, start: start, end: end, char: null });
    }
    cancelAnimationFrame(this.frameReq);
    this.frame = 0;
    this.update();
    return done;
  };
  Scrambler.prototype.update = function () {
    var out = "", complete = 0, q = this.queue;
    for (var i = 0; i < q.length; i++) {
      var item = q[i];
      if (this.frame >= item.end) {
        complete++; out += item.to;
      } else if (this.frame >= item.start) {
        if (item.char === null || Math.random() < 0.3) item.char = rand(GLYPHS);
        out += '<span class="scramble-char">' + item.char + "</span>";
      } else {
        out += item.to ? '<span class="scramble-char">&nbsp;</span>' : "";
      }
    }
    this.el.innerHTML = out;
    if (complete === q.length) { if (this.resolve) this.resolve(); }
    else { this.frame++; this.frameReq = requestAnimationFrame(this.update); }
  };

  function quickFlicker(el, finalText) {
    if (reduceMotion) return;
    if (el._scr) { el._scr.setText(finalText, { dur: 14 }); return; }
    el._scr = new Scrambler(el);
    el._scr.setText(finalText, { dur: 14 });
  }

  function createArchiveItem(entry) {
    var article = document.createElement("article");
    article.className = "archive-item";

    article.innerHTML =
      '<div class="archive-item-main">' +
        '<h3 class="archive-item-title">' + entry.name + "</h3>" +
        '<div class="archive-writers">' +
          '<span class="archive-writers-label">Written by</span>' +
          '<span class="archive-writers-names">' + entry.writers + "</span>" +
        "</div>" +
      "</div>" +
      '<div class="archive-actions">' +
        '<a class="btn btn-primary archive-btn" href="' + entry.testUrl + '" target="_blank" rel="noopener">Test</a>' +
        '<a class="btn btn-secondary archive-btn" href="' + entry.keyUrl + '" target="_blank" rel="noopener">Key</a>' +
      "</div>";

    return article;
  }

  function renderDivision(container, entries) {
    if (!container) return;
    container.innerHTML = "";
    if (!entries.length) {
      container.innerHTML = '<p class="archive-empty">No tests listed yet.</p>';
      return;
    }
    entries.forEach(function (entry) {
      container.appendChild(createArchiveItem(entry));
    });
  }

  function initArchiveTitle() {
    var title = document.querySelector(".archive-title");
    if (!title) return;
    var target = title.getAttribute("data-text") || title.textContent.trim();
    var scrambler = new Scrambler(title);
    window.setTimeout(function () {
      scrambler.setText(target, { seq: true, dur: 46 });
    }, 260);
  }

  function initNav() {
    var nav = document.querySelector(".nav");
    if (!nav) return;
    var wm = document.querySelector(".wordmark");
    var wmText = wm ? wm.querySelector("span") : null;
    if (wm && wmText) {
      var text = wmText.textContent.trim();
      wm.addEventListener("mouseenter", function () { quickFlicker(wmText, text); });
    }
    window.addEventListener("scroll", function () {
      nav.style.boxShadow = window.scrollY > 20 ? "0 10px 30px -18px rgba(0,0,0,0.6)" : "none";
    }, { passive: true });
  }

  function boot() {
    initArchiveTitle();
    initNav();
    var data = window.ARCHIVE_TESTS;
    if (!data) return;
    renderDivision(document.getElementById("archive-division-b"), data.divisionB || []);
    renderDivision(document.getElementById("archive-division-c"), data.divisionC || []);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
