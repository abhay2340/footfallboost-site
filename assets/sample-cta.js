/* Footfall Boost: owner call-to-action shown on every free sample site.
   One file for all samples, so the wording can change in one place.
   Shows a small card once the visitor has scrolled a bit (or after 8s),
   sits above the sample's own bottom bar, and can be closed. */
(function () {
  var WA = '919335694034';
  var d = document, b = d.body;
  if (!b || d.getElementById('ffb-cta')) return;

  var m = location.pathname.match(/^\/(?:s|v)\/([^\/?#]+)/);
  var slug = (b.dataset && b.dataset.slug) || (m ? m[1] : 'unknown');
  var name = b.dataset && b.dataset.name;
  if (!name) {
    var s = d.querySelector('.sample');
    var t = s && s.textContent.match(/made for (.+?) by Footfall Boost/);
    name = t ? t[1] : 'my business';
  }

  try { if (sessionStorage.getItem('ffb-cta-closed')) return; } catch (e) {}

  var css = '#ffb-cta{position:fixed;left:12px;right:12px;bottom:12px;z-index:50;max-width:440px;margin:0 auto;' +
    'background:#111;color:#fff;border-radius:16px;padding:14px 44px 14px 16px;box-shadow:0 12px 32px rgba(0,0,0,.35);' +
    'font:15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;transform:translateY(140%);transition:transform .35s ease}' +
    '#ffb-cta.on{transform:none}' +
    '#ffb-cta p{margin:0 0 10px;font-weight:600}' +
    '#ffb-cta small{display:block;font-weight:400;opacity:.75;margin-top:2px;font-size:13px}' +
    '#ffb-cta a{display:block;text-align:center;background:#25D366;color:#06351b;font-weight:800;text-decoration:none;' +
    'padding:12px 14px;border-radius:999px;font-size:15px}' +
    '#ffb-cta button{position:absolute;top:8px;right:8px;width:32px;height:32px;border:0;border-radius:50%;' +
    'background:rgba(255,255,255,.12);color:#fff;font-size:18px;line-height:1;cursor:pointer}' +
    '@media (prefers-reduced-motion:reduce){#ffb-cta{transition:none}}';
  var st = d.createElement('style'); st.textContent = css; d.head.appendChild(st);

  var text = encodeURIComponent('Hi Abhay, I saw the sample website for ' + name + '. I would like to make it live.');
  var el = d.createElement('div');
  el.id = 'ffb-cta';
  el.setAttribute('role', 'complementary');
  el.innerHTML = '<p></p><a target="_blank" rel="noopener" data-umami-event="Sample make-live" data-umami-event-place="card"></a>' +
    '<button type="button" aria-label="Close">×</button>';
  el.querySelector('p').innerHTML = 'Like this website for <span></span>?<small>Made by Footfall Boost. We customise it and make it live for you, just message Abhay on WhatsApp.</small>';
  el.querySelector('p span').textContent = name;
  var a = el.querySelector('a');
  a.href = 'https://wa.me/' + WA + '?text=' + text;
  a.setAttribute('data-umami-event-location', slug);
  a.textContent = 'Make this my website →';
  b.appendChild(el);

  // keep the sample's own bottom bar / WhatsApp bubble visible above the card
  function lift() {
    var dock = d.querySelector('.dock');
    var dh = dock && getComputedStyle(dock).display !== 'none' ? dock.offsetHeight : 0;
    el.style.bottom = (dh + 12) + 'px';
    var fab = d.querySelector('.fab');
    if (fab) fab.style.bottom = (el.classList.contains('on') ? el.offsetHeight + dh + 24 : 16) + 'px';
  }
  function show() {
    if (el.classList.contains('on')) return;
    el.classList.add('on'); lift();
    removeEventListener('scroll', onScroll);
  }
  function onScroll() { if (scrollY > innerHeight * 0.6) show(); }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', lift);
  setTimeout(show, 8000);
  lift();

  el.querySelector('button').addEventListener('click', function () {
    el.classList.remove('on');
    el.style.display = 'none';
    var fab = d.querySelector('.fab'); if (fab) fab.style.bottom = '16px';
    try { sessionStorage.setItem('ffb-cta-closed', '1'); } catch (e) {}
  });
})();
