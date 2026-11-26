/* Lumen & Loft: scroll-scrubbed video walkthrough.
   130 pre-extracted WebP frames drawn on a canvas, driven by scroll position.
   Frames load progressively (coarse pass first) once the section is near the viewport. */
(function () {
  var sec = document.getElementById('walk');
  if (!sec) return;
  var cv = sec.querySelector('canvas'), ctx = cv.getContext('2d');
  var caps = [].slice.call(sec.querySelectorAll('.cap'));
  var bar = sec.querySelector('.walk-bar i');
  var N = 130;
  var small = matchMedia('(max-width:759px)').matches;
  var dir = '/s/demo-lumen-loft/assets/frames/' + (small ? 'm' : 'd') + '/';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var c = navigator.connection || {}, lite = !!c.saveData || /(^|-)2g$|^3g$/.test(c.effectiveType || '');
  var imgs = new Array(N), ready = 0, started = false;
  var cur = 0, target = 0, W = 0, H = 0, dpr = 1, raf = 0, lastDrawn = -1;

  function url(i) { return dir + 'f' + String(i + 1).padStart(3, '0') + '.webp'; }

  function load(i, done) {
    if (imgs[i]) return done && done();
    var im = new Image(); im.decoding = 'async';
    im.onload = function () { imgs[i] = im; ready++; if (i === 0 || Math.abs(i - Math.round(cur)) < 6) lastDrawn = -1; kick(); done && done(); };
    im.onerror = function () { done && done(); };
    im.src = url(i);
  }
  function start() {
    if (started) return; started = true;
    var order = [], i;
    for (i = 0; i < N; i += 6) order.push(i);            // coarse pass
    if (lite) order.push(N - 1);                         // data saver: coarse frames only
    else {
      for (i = 0; i < N; i += 2) if (i % 6) order.push(i); // then every 2nd
      for (i = 1; i < N; i += 2) if (i % 6) order.push(i); // then the rest
    }
    var p = 0, active = 0, MAX = 6;
    (function pump() {
      while (active < MAX && p < order.length) {
        active++; load(order[p++], function () { active--; pump(); });
      }
    })();
  }

  function size() {
    var r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, small ? 2 : 1.5);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    lastDrawn = -1; kick();
  }

  function nearest(f) {
    var i = Math.round(f); if (i < 0) i = 0; if (i > N - 1) i = N - 1;
    if (imgs[i]) return imgs[i];
    for (var d = 1; d < N; d++) {
      if (imgs[i - d]) return imgs[i - d];
      if (imgs[i + d]) return imgs[i + d];
    }
    return null;
  }
  function draw() {
    var im = nearest(cur); if (!im) return;
    var key = Math.round(cur) + ':' + ready + ':' + W;
    if (key === lastDrawn) return; lastDrawn = key;
    var s = Math.max(W / im.naturalWidth, H / im.naturalHeight);
    var w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  }

  function progress() {
    var r = sec.getBoundingClientRect();
    var span = sec.offsetHeight - innerHeight;
    var p = span > 0 ? -r.top / span : 0;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }
  function caption(p) {
    // each caption fades in/out around its centre
    var c = [0.12, 0.66, 0.9];
    caps.forEach(function (el, i) {
      var d = Math.abs(p - c[i]), o = d < 0.12 ? 1 : d < 0.2 ? 1 - (d - 0.12) / 0.08 : 0;
      el.style.opacity = o; el.style.transform = 'translateY(' + ((1 - o) * 14) + 'px)';
    });
  }
  function tick() {
    raf = 0;
    var p = progress();
    target = p * (N - 1);
    cur += (target - cur) * (reduce ? 1 : 0.14);
    if (Math.abs(target - cur) < 0.02) cur = target;
    draw(); caption(p); document.body.classList.toggle('in-walk', p > 0 && p < 1); if (bar) bar.style.transform = 'scaleX(' + p + ')';
    if (cur !== target) raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { if (e[0].isIntersecting) { start(); } }, { rootMargin: '1500px 0px' }).observe(sec);
  } else start();
  load(0, kick);
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', size);
  size(); kick();
})();
