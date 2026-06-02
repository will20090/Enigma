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
     ROTOR TRANSITION — Chaocipher wheel + scroll clip-path wipe
     --------------------------------------------------------- */
  var CHAO_LEFT = "PKWBNDXLCTEMRVGOYSFAQUHZJI";
  var CHAO_RIGHT = "HJYSQOAPTZLMDXCFUVGRKWNIBE";
  var E_FULL_TURNS = 3;
  var TAU = Math.PI * 2;

  function spinTurns(scrollProg, turns) {
    return scrollProg * turns * TAU;
  }

  function drawChaoRing(ctx, cx, cy, radius, letters, rotation, opts) {
    opts = opts || {};
    var count = letters.length;
    var tickLen = opts.tickLen || 10;
    var fontSize = opts.fontSize || 13;
    var alpha = opts.alpha || 0.85;
    var lineAlpha = opts.lineAlpha || 0.22;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255," + lineAlpha + ")";
    ctx.lineWidth = opts.lineWidth || 1.4;
    ctx.stroke();

    if (opts.fill) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = opts.fill;
      ctx.fill();
    }

    ctx.font = "600 " + fontSize + "px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (var i = 0; i < count; i++) {
      var ang = (i / count) * Math.PI * 2 - Math.PI / 2;
      var cos = Math.cos(ang);
      var sin = Math.sin(ang);

      ctx.strokeStyle = "rgba(255,255,255," + (lineAlpha + 0.06) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cos * (radius - tickLen), sin * (radius - tickLen));
      ctx.lineTo(cos * (radius + 4), sin * (radius + 4));
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
      ctx.fillText(letters[i], cos * (radius + fontSize + 8), sin * (radius + fontSize + 8));
    }

    ctx.restore();
  }

  function paintChaocipherWheel(canvas, scrollProg) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.offsetWidth;
    var h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    for (var gx = 0; gx < w; gx += 44) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (var gy = 0; gy < h; gy += 44) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    var cx = w * 0.5;
    var cy = h * 0.5;
    var baseR = Math.min(w, h) * 0.34;
    var hubRot = spinTurns(scrollProg, E_FULL_TURNS);

    drawChaoRing(ctx, cx - baseR * 0.34, cy, baseR * 0.92, CHAO_LEFT, -spinTurns(scrollProg, 2), {
      fontSize: 12,
      alpha: 0.72,
      lineAlpha: 0.18,
      tickLen: 8,
      fill: "rgba(255,255,255,0.025)"
    });
    drawChaoRing(ctx, cx + baseR * 0.34, cy, baseR * 0.92, CHAO_RIGHT, spinTurns(scrollProg, 2), {
      fontSize: 12,
      alpha: 0.72,
      lineAlpha: 0.18,
      tickLen: 8,
      fill: "rgba(255,255,255,0.025)"
    });

    drawChaoRing(ctx, cx, cy, baseR * 1.18, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", spinTurns(scrollProg, 2), {
      fontSize: 15,
      alpha: 0.9,
      lineAlpha: 0.28,
      lineWidth: 1.8,
      tickLen: 12
    });
    drawChaoRing(ctx, cx, cy, baseR * 0.82, CHAO_LEFT, -spinTurns(scrollProg, 3), {
      fontSize: 13,
      alpha: 0.78,
      lineAlpha: 0.2,
      tickLen: 10
    });
    drawChaoRing(ctx, cx, cy, baseR * 0.48, CHAO_RIGHT, spinTurns(scrollProg, 4), {
      fontSize: 11,
      alpha: 0.62,
      lineAlpha: 0.16,
      tickLen: 8
    });

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(hubRot);
    ctx.beginPath();
    ctx.arc(0, 0, baseR * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = "#161616";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, baseR * 0.12, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "700 16px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("E", 0, 0);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - baseR * 1.35, cy);
    ctx.lineTo(cx + baseR * 1.35, cy);
    ctx.stroke();
  }

  function initRotorBand() {
    var band = document.querySelector(".rotor-band");
    if (!band) return;
    var canvas = band.querySelector(".rotor-canvas");
    var capText = band.querySelector(".rotor-caption .rc-text");
    var scrollProg = 0;

    if (!canvas) return;

    var capScr = capText ? new Scrambler(capText) : null;
    var capTarget = capText ? capText.getAttribute("data-decode") : "";
    var capDone = false;
    if (capText && !reduceMotion) {
      var seed = "";
      for (var i = 0; i < capTarget.length; i++) seed += capTarget[i] === " " ? " " : rand(GLYPHS);
      capText.textContent = seed;
    }

    function renderWheel() {
      paintChaocipherWheel(canvas, scrollProg);
    }

    function onScroll() {
      var rect = band.getBoundingClientRect();
      var total = band.offsetHeight - window.innerHeight;
      scrollProg = Math.min(Math.max(-rect.top / total, 0), 1);
      canvas.style.transform = "scale(" + (1.02 + scrollProg * 0.06) + ")";
      renderWheel();
      if (!capDone && capScr && scrollProg > 0.2) {
        capDone = true;
        capScr.setText(capTarget, { seq: true, dur: 28 });
      }
    }

    window.addEventListener("resize", renderWheel);
    if (reduceMotion) {
      if (capText) capText.textContent = capTarget;
      renderWheel();
    } else {
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
     MEMBER CARD HOVER FLICKER + CLICK-TO-FOCUS ZOOM
     --------------------------------------------------------- */
  function initMembers() {
    var membersGrid = document.querySelector(".members");
    if (!membersGrid) return;

    var FLIP_MS = 520;
    var CLOSE_MS = 420;
    var cards = membersGrid.querySelectorAll(".member");
    var activeCard = null;
    var placeholder = null;
    var isClosing = false;
    var backdrop = document.createElement("div");
    backdrop.className = "member-focus-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    document.body.appendChild(backdrop);

    function removePlaceholder() {
      if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
      placeholder = null;
    }

    function resetCard(card) {
      if (!card) return;
      card.classList.remove("is-active", "is-animating", "is-closing");
      card.style.transform = "";
      card.style.opacity = "";
      card.style.transitionDelay = "";
      card.setAttribute("aria-pressed", "false");
    }

    function clearSiblingDelays() {
      cards.forEach(function (c) {
        c.style.transitionDelay = "";
      });
    }

    function finishClose() {
      if (!activeCard) return;
      var card = activeCard;
      card.classList.remove("is-active", "is-animating", "is-closing");
      card.style.transform = "";
      card.style.opacity = "0";
      card.style.transitionDelay = "";
      card.setAttribute("aria-pressed", "false");
      membersGrid.classList.remove("is-focused", "is-closing");
      backdrop.classList.remove("is-visible");
      document.body.classList.remove("member-focus-open");
      removePlaceholder();
      clearSiblingDelays();
      activeCard = null;
      isClosing = false;

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          card.style.transitionDelay = "0.12s";
          card.style.opacity = "";
          window.setTimeout(function () {
            card.style.transitionDelay = "";
          }, 500);
        });
      });
    }

    function closeFocus(instant) {
      if (!activeCard || isClosing) return;
      var card = activeCard;

      if (instant || reduceMotion || !placeholder) {
        finishClose();
        return;
      }

      isClosing = true;
      backdrop.classList.remove("is-visible");
      membersGrid.classList.add("is-closing");
      card.classList.add("is-closing");

      cards.forEach(function (c, i) {
        if (c === card) return;
        c.style.transitionDelay = (0.07 * i) + "s";
      });

      window.setTimeout(finishClose, CLOSE_MS);
    }

    function openFocus(card) {
      var originRect = card.getBoundingClientRect();
      removePlaceholder();
      placeholder = document.createElement("div");
      placeholder.className = "member-placeholder";
      placeholder.style.height = originRect.height + "px";
      card.parentNode.insertBefore(placeholder, card);

      activeCard = card;
      membersGrid.classList.add("is-focused");
      card.classList.add("is-active");
      card.setAttribute("aria-pressed", "true");
      backdrop.classList.add("is-visible");
      document.body.classList.add("member-focus-open");

      if (reduceMotion) return;

      card.classList.add("is-animating");
      card.style.transform = "translate(-50%, -50%)";
      card.offsetHeight;

      var expandedRect = card.getBoundingClientRect();
      var originCx = originRect.left + originRect.width / 2;
      var originCy = originRect.top + originRect.height / 2;
      var expandedCx = expandedRect.left + expandedRect.width / 2;
      var expandedCy = expandedRect.top + expandedRect.height / 2;
      var scale = originRect.width / expandedRect.width;

      card.style.transform =
        "translate(calc(-50% + " + (originCx - expandedCx) + "px), calc(-50% + " + (originCy - expandedCy) + "px)) scale(" + scale + ")";
      card.offsetHeight;

      requestAnimationFrame(function () {
        card.style.transform = "translate(-50%, -50%) scale(1)";
      });

      window.setTimeout(function () {
        if (activeCard !== card) return;
        card.classList.remove("is-animating");
        card.style.transform = "";
      }, FLIP_MS + 40);
    }

    function focusCard(card) {
      if (isClosing) return;
      if (activeCard === card) {
        closeFocus(false);
        return;
      }
      if (activeCard) closeFocus(true);
      openFocus(card);
    }

    cards.forEach(function (card) {
      var nameEl = card.querySelector(".member-name");
      if (nameEl) {
        var target = nameEl.textContent.trim();
        card.addEventListener("mouseenter", function () {
          if (!membersGrid.classList.contains("is-focused")) quickFlicker(nameEl, target);
        });
      }
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.setAttribute("aria-pressed", "false");
      card.addEventListener("click", function (e) {
        e.stopPropagation();
        focusCard(card);
      });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          focusCard(card);
        }
      });
    });

    backdrop.addEventListener("click", function () { closeFocus(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeFocus(false);
    });
    window.addEventListener("resize", function () { closeFocus(true); });
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
     CONTACT FORM
     --------------------------------------------------------- */
  function initForm() {
    var form = document.querySelector(".contact-form");
    if (!form) return;
    var note = form.querySelector(".form-note");
    var submitBtn = form.querySelector('button[type="submit"]');
    var defaultNote = note ? note.textContent : "";
    var apiUrl = form.getAttribute("data-api-url") || "";

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (!apiUrl) {
        if (note) note.textContent = "// Contact API URL is not configured.";
        return;
      }

      var payload = {
        name: form.querySelector('[name="name"]').value.trim(),
        email: form.querySelector('[name="email"]').value.trim(),
        subject: form.querySelector('[name="subject"]').value.trim(),
        message: form.querySelector('[name="message"]').value.trim()
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }
      if (note) {
        note.textContent = "// ENCRYPTING TRANSMISSION...";
        note.classList.remove("ok");
      }

      fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data.ok) {
            throw new Error(data.error || "Failed to send message.");
          }
          if (note) {
            note.textContent = "// TRANSMISSION SENT — WE WILL REPLY SOON";
            note.classList.add("ok");
          }
          form.reset();
        });
      }).catch(function (err) {
        if (note) {
          note.textContent = "// SEND FAILED — EMAIL enigma.codebusters@gmail.com DIRECTLY";
          note.classList.remove("ok");
        }
        console.error("[contact]", err);
      }).finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send Message";
        }
        window.setTimeout(function () {
          if (note && defaultNote) {
            note.textContent = defaultNote;
            note.classList.remove("ok");
          } else if (note) {
            note.textContent = "";
            note.classList.remove("ok");
          }
        }, 5000);
      });
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
