/* ============================================================
   ENIGMA — interaction + animation engine
   Vanilla JS. No dependencies.
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>=?*+".split("");

  function rand(arr) { return arr[(Math.random() * arr.length) | 0]; }

  /* ---------------------------------------------------------
     TEXT SCRAMBLE
     setText resolves each character from a random glyph storm
     into the target. `seq` makes resolution sweep left→right.
     --------------------------------------------------------- */
  function Scrambler(el) {
    this.el = el;
    this.frameReq = 0;
    this.update = this.update.bind(this);
  }
  Scrambler.prototype.setText = function (newText, opts) {
    opts = opts || {};
    var seq = opts.seq;            // left-to-right sweep
    var dur = opts.dur || 36;      // scramble window length in frames
    var self = this;
    var oldText = this.el.textContent;
    var len = Math.max(oldText.length, newText.length);
    var done = new Promise(function (res) { self.resolve = res; });

    if (reduceMotion) { this.el.textContent = newText; this.resolve = function(){}; return Promise.resolve(); }

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

  /* ---------------------------------------------------------
     HERO TITLE — left→right decrypt on load
     --------------------------------------------------------- */
  function initHero() {
    var t = document.querySelector(".hero-title");
    if (!t) return;
    var target = t.getAttribute("data-text") || t.textContent.trim();
    var s = new Scrambler(t);
    setTimeout(function () { s.setText(target, { seq: true, dur: 46 }); }, 260);
  }

  /* ---------------------------------------------------------
     DECODE-ON-SCROLL HEADERS + SECTION REVEALS
     --------------------------------------------------------- */
  function initReveals() {
    var reveals = document.querySelectorAll(".reveal");
    var revObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); revObs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { revObs.observe(el); });

    var decoders = document.querySelectorAll("[data-decode]");
    decoders.forEach(function (el) {
      var target = el.getAttribute("data-decode");
      if (!reduceMotion) {
        // seed with scrambled glyphs so it reads as ciphertext before reveal
        var seed = "";
        for (var i = 0; i < target.length; i++) seed += target[i] === " " ? " " : rand(GLYPHS);
        el.textContent = seed;
      }
    });
    var decObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var target = el.getAttribute("data-decode");
        new Scrambler(el).setText(target, { seq: true, dur: 30 });
        decObs.unobserve(el);
      });
    }, { threshold: 0.4 });
    decoders.forEach(function (el) { decObs.observe(el); });
  }

  /* ---------------------------------------------------------
     STAT COUNTERS — count up on view
     --------------------------------------------------------- */
  function initCounters() {
    var nums = document.querySelectorAll("[data-count]");
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var target = parseInt(el.getAttribute("data-count"), 10);
        var suffix = el.getAttribute("data-suffix") || "";
        if (reduceMotion) { el.innerHTML = target + suffix; obs.unobserve(el); return; }
        var dur = 1500, t0 = null;
        function step(ts) {
          if (!t0) t0 = ts;
          var p = Math.min((ts - t0) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.innerHTML = Math.round(eased * target) + suffix;
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        obs.unobserve(el);
      });
    }, { threshold: 0.6 });
    nums.forEach(function (el) { obs.observe(el); });
  }

  /* ---------------------------------------------------------
     CIPHER RAIN — extremely faint matrix layer behind hero
     --------------------------------------------------------- */
  function initCipherRain() {
    var canvas = document.querySelector(".cipher-rain");
    if (!canvas || reduceMotion) return;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cols, drops, fontSize = 16;

    function resize() {
      var w = canvas.offsetWidth, h = canvas.offsetHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / fontSize);
      drops = [];
      for (var i = 0; i < cols; i++) drops[i] = Math.random() * -50;
    }
    resize();
    window.addEventListener("resize", resize);

    var last = 0;
    function draw(ts) {
      if (ts - last > 70) {           // throttle for slow, whispering fall
        last = ts;
        var w = canvas.offsetWidth, h = canvas.offsetHeight;
        ctx.fillStyle = "rgba(239,239,239,0.16)";
        ctx.fillRect(0, 0, w, h);
        ctx.font = fontSize + "px JetBrains Mono, monospace";
        for (var i = 0; i < cols; i++) {
          var ch = rand(GLYPHS);
          var x = i * fontSize, y = drops[i] * fontSize;
          ctx.fillStyle = "rgba(28,28,28,0.05)";
          ctx.fillText(ch, x, y);
          if (y > h && Math.random() > 0.985) drops[i] = Math.random() * -20;
          drops[i] += 0.5;
        }
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  /* ---------------------------------------------------------
     ROTOR TRANSITION — canvas texture + scroll clip-path wipe
     --------------------------------------------------------- */
  function drawRotor(canvas) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    function paint() {
      var w = canvas.offsetWidth, h = canvas.offsetHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // dark base + faint grid
      ctx.fillStyle = "#161616";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.lineWidth = 1;
      for (var gx = 0; gx < w; gx += 44) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
      for (var gy = 0; gy < h; gy += 44) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

      var cx = w * 0.5, cy = h * 0.5;
      var maxR = Math.min(w, h) * 0.42;
      var rings = 4;
      // concentric rotor rings with lettered ticks
      for (var r = 0; r < rings; r++) {
        var radius = maxR * (0.42 + r * 0.2);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255," + (0.10 - r * 0.012) + ")";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        var ticks = 26;
        ctx.font = (12 - r) + "px JetBrains Mono, monospace";
        for (var t = 0; t < ticks; t++) {
          var ang = (t / ticks) * Math.PI * 2 + r * 0.12;
          var lx = cx + Math.cos(ang) * radius;
          var ly = cy + Math.sin(ang) * radius;
          ctx.fillStyle = "rgba(255,255,255," + (0.16 - r * 0.02) + ")";
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(ang + Math.PI / 2);
          ctx.fillText(GLYPHS[(t + r * 5) % 26], -4, 0);
          ctx.restore();
        }
      }
      // center hub
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 0.16, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "700 18px JetBrains Mono, monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("E", cx, cy);
      ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
    }
    paint();
    window.addEventListener("resize", paint);
  }

  function initRotorBand() {
    var band = document.querySelector(".rotor-band");
    if (!band) return;
    var photo = band.querySelector(".rotor-photo");
    var cover = band.querySelector(".rotor-cover");
    var capText = band.querySelector(".rotor-caption .rc-text");

    var capScr = capText ? new Scrambler(capText) : null;
    var capTarget = capText ? capText.getAttribute("data-decode") : "";
    var capDone = false;
    if (capText && !reduceMotion) {
      var seed = "";
      for (var i = 0; i < capTarget.length; i++) seed += capTarget[i] === " " ? " " : rand(GLYPHS);
      capText.textContent = seed;
    }

    function onScroll() {
      var rect = band.getBoundingClientRect();
      var total = band.offsetHeight - window.innerHeight;
      var prog = Math.min(Math.max(-rect.top / total, 0), 1);
      // wipe the cover open across the middle of the scroll range
      var wipe = Math.min(Math.max((prog - 0.08) / 0.5, 0), 1);
      if (cover) cover.style.clipPath = "inset(0 0 0 " + (wipe * 100) + "%)";
      // subtle parallax drift on the photo
      if (photo) photo.style.transform = "translateY(" + (prog - 0.5) * 40 + "px) scale(1.08)";
      // decode the caption once revealed
      if (!capDone && capScr && prog > 0.4) { capDone = true; capScr.setText(capTarget, { seq: true, dur: 28 }); }
    }
    if (reduceMotion) { if (cover) cover.style.display = "none"; if (capText) capText.textContent = capTarget; }
    else {
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
  }

  /* ---------------------------------------------------------
     SUBTLE SECTION PARALLAX
     --------------------------------------------------------- */
  function initParallax() {
    if (reduceMotion) return;
    var els = document.querySelectorAll("[data-parallax]");
    if (!els.length) return;
    function onScroll() {
      var vh = window.innerHeight;
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var center = r.top + r.height / 2;
        var off = (center - vh / 2) / vh;
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.06;
        el.style.transform = "translateY(" + (off * speed * -100) + "px)";
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------
     MEMBER CARD HOVER FLICKER
     --------------------------------------------------------- */
  function initMembers() {
    document.querySelectorAll(".member").forEach(function (card) {
      var nameEl = card.querySelector(".member-name");
      if (!nameEl) return;
      var target = nameEl.textContent.trim();
      card.addEventListener("mouseenter", function () { quickFlicker(nameEl, target); });
    });
  }

  /* ---------------------------------------------------------
     NAV — mobile toggle, smooth scroll, wordmark flicker
     --------------------------------------------------------- */
  function initNav() {
    var nav = document.querySelector(".nav");
    var toggle = nav.querySelector(".nav-toggle");
    toggle.addEventListener("click", function () { nav.classList.toggle("open"); });
    nav.querySelectorAll(".nav-mobile a").forEach(function (a) {
      a.addEventListener("click", function () { nav.classList.remove("open"); });
    });
    var wm = document.querySelector(".wordmark");
    var wmText = wm ? wm.querySelector("span") : null;
    if (wm && wmText) {
      var t = wmText.textContent.trim();
      wm.addEventListener("mouseenter", function () { quickFlicker(wmText, t); });
    }
    // shadow on scroll
    window.addEventListener("scroll", function () {
      nav.style.boxShadow = window.scrollY > 20 ? "0 10px 30px -18px rgba(0,0,0,0.6)" : "none";
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     CONTACT FORM (front-end only)
     --------------------------------------------------------- */
  function initForm() {
    var form = document.querySelector(".contact-form");
    if (!form) return;
    var note = form.querySelector(".form-note");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      note.textContent = "// TRANSMISSION ENCRYPTED — MESSAGE QUEUED";
      note.classList.add("ok");
      form.reset();
      setTimeout(function () { note.textContent = "// Front-end demo — no message is actually sent."; note.classList.remove("ok"); }, 4000);
    });
  }

  /* --------------------------------------------------------- */
  function boot() {
    initNav();
    initHero();
    initReveals();
    initCounters();
    initCipherRain();
    initRotorBand();
    initParallax();
    initMembers();
    initForm();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
