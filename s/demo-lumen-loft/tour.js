// Lumen & Loft demo: a procedural 3D home that builds itself on load and
// gives a camera tour as the page scrolls. Three.js r160, no external models.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '/assets/vendor/three/RoundedBoxGeometry.js';
import { RoomEnvironment } from '/assets/vendor/three/RoomEnvironment.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SMALL = Math.min(innerWidth, innerHeight) < 700;
const canvas = document.getElementById('scene');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
}
if (renderer) start();

function start() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, SMALL ? 1.5 : 1.75));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !SMALL;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const BG = new THREE.Color('#15120e');
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 30, 70);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(SMALL ? 58 : 42, innerWidth / innerHeight, 0.1, 200);

  // ---------- textures ----------
  const aniso = renderer.capabilities.getMaxAnisotropy();
  function canvasTex(w, h, draw, rx = 1, ry = 1) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry); t.anisotropy = aniso;
    return t;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const woodTex = canvasTex(1024, 1024, (g, W, H) => {
    const rows = 7, ph = H / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd(0, 400);
      while (x < W) {
        const w = rnd(300, 560), l = rnd(222, 246) | 0;
        g.fillStyle = `rgb(${l},${l - 6},${l - 14})`; g.fillRect(x, r * ph, w, ph);
        for (let i = 0; i < 16; i++) {
          g.strokeStyle = `rgba(110,82,56,${rnd(.03, .09)})`; g.lineWidth = rnd(.8, 2.2);
          const y = r * ph + rnd(2, ph - 2);
          g.beginPath(); g.moveTo(x, y);
          g.bezierCurveTo(x + w * .3, y + rnd(-6, 6), x + w * .66, y + rnd(-6, 6), x + w, y + rnd(-4, 4)); g.stroke();
        }
        g.fillStyle = 'rgba(55,40,28,.35)'; g.fillRect(x, r * ph, 2, ph);
        x += w;
      }
      g.fillStyle = 'rgba(55,40,28,.32)'; g.fillRect(0, r * ph, W, 2);
    }
  }, 3, 2);
  const limeTex = canvasTex(512, 512, (g, W, H) => {
    g.fillStyle = '#f1eee9'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) {
      const x = rnd(0, W), y = rnd(0, H), r = rnd(20, 110), dark = Math.random() < .5;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, dark ? 'rgba(120,110,95,.05)' : 'rgba(255,255,255,.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }, 3, 1);
  const rugTex = canvasTex(512, 384, (g, W, H) => {
    g.fillStyle = '#e4dbcd'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#8b6b4f'; g.lineWidth = 10; g.strokeRect(22, 22, W - 44, H - 44);
    g.lineWidth = 3; g.strokeRect(44, 44, W - 88, H - 88);
    g.fillStyle = 'rgba(139,107,79,.55)';
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
      const cx = 90 + i * 66, cy = 92 + j * 66;
      g.beginPath(); g.moveTo(cx, cy - 16); g.lineTo(cx + 16, cy); g.lineTo(cx, cy + 16); g.lineTo(cx - 16, cy); g.closePath(); g.fill();
    }
    for (let i = 0; i < 2200; i++) { g.fillStyle = `rgba(80,60,40,${rnd(0, .05)})`; g.fillRect(rnd(0, W), rnd(0, H), 2, 2); }
  });
  function artTex(seed) {
    return canvasTex(256, 320, (g, W, H) => {
      g.fillStyle = '#efe7da'; g.fillRect(0, 0, W, H);
      const cols = ['#b5643f', '#7e8a6a', '#2c2620', '#d6a961', '#a9765a'];
      if (seed === 0) {
        g.fillStyle = cols[0]; g.beginPath(); g.arc(W * .5, H * .62, W * .34, Math.PI, 0); g.fill();
        g.fillStyle = cols[2]; g.fillRect(W * .16, H * .62, W * .68, 6);
        g.fillStyle = cols[3]; g.beginPath(); g.arc(W * .7, H * .3, 22, 0, 7); g.fill();
      } else if (seed === 1) {
        g.strokeStyle = cols[2]; g.lineWidth = 5;
        for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(W * .5, H * .5, 22 + i * 18, -.6, 2.4); g.stroke(); }
        g.fillStyle = cols[1]; g.fillRect(W * .2, H * .72, W * .6, H * .1);
      } else {
        g.fillStyle = cols[1]; g.beginPath(); g.ellipse(W * .42, H * .48, 60, 92, -.4, 0, 7); g.fill();
        g.fillStyle = cols[4]; g.beginPath(); g.ellipse(W * .6, H * .56, 44, 70, .5, 0, 7); g.fill();
      }
    });
  }

  // ---------- materials (style-driven colours) ----------
  const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .8, metalness: 0, envMapIntensity: .45 }, o));
  const M = {
    wall: std('#e9e2d6', { map: limeTex, roughness: .95 }),
    floor: std('#b98e62', { map: woodTex, roughness: .62, envMapIntensity: .6 }),
    sofa: std('#d8d0c3', { roughness: 1 }),
    accent: std('#6f7d5c', { roughness: .95 }),
    wood: std('#5b4636', { roughness: .55 }),
    metal: std('#1f1d1b', { roughness: .35, metalness: .85, envMapIntensity: 1 }),
    fluted: std('#c9a27a', { roughness: .6 }),
    cabinet: std('#cdb89a', { roughness: .55 }),
    bedding: std('#cfc4b4', { roughness: 1 }),
  };
  const FIX = {
    stone: std('#ece7df', { roughness: .3, envMapIntensity: .8 }),
    stoneDark: std('#d9d2c7', { roughness: .4 }),
    linen: std('#f3efe8', { roughness: 1 }),
    plinth: std('#211c16', { roughness: .9 }),
    ground: std('#120f0c', { roughness: 1 }),
    leaf: std('#5d7150', { roughness: .9, flatShading: true }),
    pot: std('#b4876a', { roughness: .9 }),
    black: std('#151311', { roughness: .5 }),
    rug: std('#ffffff', { map: rugTex, roughness: 1 }),
    glass: new THREE.MeshBasicMaterial({ color: '#f6e7cc', side: THREE.DoubleSide }),
  };
  const STYLES = {
    japandi: { wall: '#e9e2d6', floor: '#b98e62', sofa: '#d8d0c3', accent: '#6f7d5c', wood: '#5b4636', metal: '#1f1d1b', fluted: '#c9a27a', cabinet: '#cdb89a', bedding: '#cfc4b4' },
    luxe:    { wall: '#d6d2cb', floor: '#6b4a35', sofa: '#2e3d3c', accent: '#b08d57', wood: '#3b2a20', metal: '#c9a46a', fluted: '#3b2a20', cabinet: '#2e3d3c', bedding: '#8f7c68' },
    earthy:  { wall: '#e7cdb4', floor: '#8c5a3c', sofa: '#b5523b', accent: '#2f5d50', wood: '#6a3e26', metal: '#b8860b', fluted: '#8c5a3c', cabinet: '#2f5d50', bedding: '#c9773e' },
  };
  const target = {}; for (const k in M) target[k] = M[k].color.clone();
  function setStyle(name) {
    const s = STYLES[name]; if (!s) return;
    for (const k in s) target[k].set(s[k]);
    if (REDUCED) for (const k in s) M[k].color.copy(target[k]);
    document.querySelectorAll('[data-style]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.style === name)));
    const sel = document.getElementById('f-style'); if (sel) sel.value = name;
  }
  document.querySelectorAll('[data-style]').forEach(b => b.addEventListener('click', () => setStyle(b.dataset.style)));

  // ---------- builders ----------
  const home = new THREE.Group(); scene.add(home);
  const walls = new THREE.Group(); home.add(walls);
  const items = [];
  function mesh(geo, mat, x, y, z, parent) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  const rbox = (w, h, d, mat, x, y, z, p, r = .05) => mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), mat, x, y, z, p);
  const box = (w, h, d, mat, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
  const cyl = (rt, rb, h, mat, x, y, z, p, seg = 28) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, p);
  function piece(room, x, z, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; home.add(g);
    items.push({ g, room, i: items.length }); return g;
  }

  // walls with openings; a wall along X at z, or along Z at x
  const H = 3, T = .18;
  function wall(axis, a0, a1, at, holes = []) {
    const segs = []; let cur = a0;
    holes.sort((p, q) => p.a0 - q.a0).forEach(h => {
      if (h.a0 > cur) segs.push([cur, h.a0, 0, H]);
      if (h.y0 > 0) segs.push([h.a0, h.a1, 0, h.y0]);
      if (h.y1 < H) segs.push([h.a0, h.a1, h.y1, H]);
      cur = h.a1;
    });
    if (cur < a1) segs.push([cur, a1, 0, H]);
    segs.forEach(([s0, s1, y0, y1]) => {
      const len = s1 - s0, mid = (s0 + s1) / 2, hh = y1 - y0;
      const m = axis === 'x' ? box(len, hh, T, M.wall, mid, y0 + hh / 2, at, walls) : box(T, hh, len, M.wall, at, y0 + hh / 2, mid, walls);
      m.castShadow = true;
    });
    holes.forEach(h => {
      const w = h.a1 - h.a0, hh = h.y1 - h.y0, mid = (h.a0 + h.a1) / 2, cy = (h.y0 + h.y1) / 2;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), FIX.glass);
      if (axis === 'x') pane.position.set(mid, cy, at - .02); else { pane.position.set(at + (at < 0 ? -.02 : .02), cy, mid); pane.rotation.y = Math.PI / 2; }
      walls.add(pane);
      const fr = axis === 'x' ? [w + .12, .06, T + .04] : [T + .04, .06, w + .12];
      box(...fr, FIX.black, axis === 'x' ? mid : at, h.y0, axis === 'x' ? at : mid, walls);
      box(...fr, FIX.black, axis === 'x' ? mid : at, h.y1, axis === 'x' ? at : mid, walls);
      const mul = axis === 'x' ? [.05, hh, T + .04] : [T + .04, hh, .05];
      box(...mul, FIX.black, axis === 'x' ? mid : at, cy, axis === 'x' ? at : mid, walls);
    });
  }

  // ---------- the home ----------
  box(19.4, .5, 12.4, FIX.plinth, 0, -.25, 0, home).castShadow = false;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18.2, 11.2), M.floor);
  floor.rotation.x = -Math.PI / 2; floor.position.y = .005; floor.receiveShadow = true; home.add(floor);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 64), FIX.ground);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.5; ground.receiveShadow = true; scene.add(ground);

  wall('x', -9.1, 9.1, -5.5);
  wall('z', -5.5, 2.6, -9.1, [{ a0: -4.2, a1: -.6, y0: .55, y1: 2.65 }]);
  wall('z', -5.5, 2.6, 9.1, [{ a0: -3.6, a1: -1.2, y0: .9, y1: 2.45 }]);
  wall('z', -5.5, -1.4, -2.5);
  wall('z', -5.5, -.4, 3.5);
  // skirting line on the back wall
  box(18.2, .08, .04, M.wood, 0, .04, -5.39, walls);

  // LIVING (x -9 .. -2.5)
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2), FIX.rug);
  rug.rotation.x = -Math.PI / 2; rug.position.set(-5.8, .012, -2.7); rug.receiveShadow = true; home.add(rug);
  items.push({ g: rug, room: 1, i: items.length, flat: true });
  let p = piece(1, -5.8, -4.55);
  rbox(3.1, .4, 1.0, M.sofa, 0, .26, 0, p, .08);
  for (let i = -1; i <= 1; i++) rbox(.98, .18, .82, M.sofa, i * 1.0, .55, .06, p, .07);
  rbox(2.95, .6, .26, M.sofa, 0, .78, -.38, p, .1);
  rbox(.22, .6, 1.0, M.sofa, -1.62, .36, 0, p, .08); rbox(.22, .6, 1.0, M.sofa, 1.62, .36, 0, p, .08);
  rbox(.42, .34, .14, M.accent, -1.05, .82, -.18, p, .06); rbox(.42, .34, .14, FIX.linen, 1.0, .82, -.18, p, .06);
  [[-1.45, -.4], [1.45, -.4], [-1.45, .4], [1.45, .4]].forEach(([x, z]) => cyl(.03, .02, .1, M.wood, x, .05, z, p, 10));
  p = piece(1, -5.8, -2.75);
  cyl(.62, .62, .06, M.wood, 0, .42, 0, p); cyl(.22, .3, .4, M.wood, 0, .2, 0, p);
  cyl(.07, .1, .26, FIX.pot, .18, .58, -.1, p); rbox(.34, .05, .24, M.accent, -.2, .47, .1, p, .02);
  p = piece(1, -3.6, -2.6, -1.0);
  rbox(.9, .36, .85, M.accent, 0, .3, 0, p, .1); rbox(.9, .55, .2, M.accent, 0, .68, -.34, p, .08);
  rbox(.16, .45, .85, M.accent, -.4, .45, 0, p, .06); rbox(.16, .45, .85, M.accent, .4, .45, 0, p, .06);
  p = piece(1, -8.2, -4.8);
  cyl(.2, .22, .04, M.metal, 0, .02, 0, p); cyl(.018, .018, 1.6, M.metal, 0, .82, 0, p, 10);
  const shade1 = cyl(.16, .28, .34, std('#efe4cf', { emissive: '#ffcf8a', emissiveIntensity: .0, roughness: 1, side: THREE.DoubleSide }), 0, 1.68, 0, p);
  p = piece(1, -8.35, -.4);
  cyl(.26, .2, .5, FIX.pot, 0, .25, 0, p);
  for (let i = 0; i < 7; i++) {
    const l = mesh(new THREE.IcosahedronGeometry(rnd(.22, .34), 0), FIX.leaf, rnd(-.25, .25), rnd(.75, 1.5), rnd(-.25, .25), p);
    l.scale.set(1, rnd(1.2, 1.8), 1);
  }
  const art = [artTex(0), artTex(1)];
  p = piece(1, -6.4, -5.36);
  box(.94, 1.16, .04, FIX.black, 0, 1.85, 0, p); mesh(new THREE.PlaneGeometry(.84, 1.06), std('#fff', { map: art[0], roughness: 1 }), 0, 1.85, .025, p);
  p = piece(1, -5.0, -5.36);
  box(.74, .94, .04, FIX.black, 0, 1.74, 0, p); mesh(new THREE.PlaneGeometry(.64, .84), std('#fff', { map: art[1], roughness: 1 }), 0, 1.74, .025, p);
  // shelves on the partition, living side
  p = piece(1, -2.66, -3.6);
  const bookCols = ['#7d4b33', '#c9b08a', '#2e3b3a', '#9aa58c', '#d3c4ab', '#5a4636', '#b06a46'];
  [1.05, 1.6, 2.15].forEach((y, r) => {
    box(.26, .04, 2.0, M.wood, 0, y, 0, p);
    let z = -.9;
    while (z < .8) {
      const w = rnd(.04, .08), h = rnd(.22, .32);
      if (Math.random() < .15) { cyl(.06, .05, .2, FIX.pot, -.02, y + .12, z + .06, p, 16); z += .2; continue; }
      box(.18, h, w, std(bookCols[(Math.random() * bookCols.length) | 0]), -.02, y + .02 + h / 2, z, p); z += w + .01;
    }
  });

  // KITCHEN (x -2.5 .. 3.5)
  p = piece(2, 0, -5.08);
  rbox(4.8, .86, .62, M.cabinet, .1, .45, 0, p, .02);
  box(4.86, .05, .68, FIX.stone, .1, .9, .02, p);
  box(4.8, .62, .02, FIX.stoneDark, .1, 1.24, -.3, p);
  rbox(3.0, .72, .36, M.cabinet, -.8, 2.15, -.12, p, .02);
  for (let i = 0; i < 4; i++) box(.02, .3, .02, M.metal, -2.0 + i * 0.78 + .35, 1.95, .07, p);
  for (let i = 0; i < 6; i++) box(.02, .02, .3, M.metal, -2.05 + i * .8 + .38, .74, .32, p);
  box(1.4, .03, .3, M.wood, 1.65, 1.85, -.14, p); box(1.4, .03, .3, M.wood, 1.65, 2.3, -.14, p);
  for (let i = 0; i < 4; i++) cyl(.06, .06, .16, i % 2 ? FIX.pot : FIX.stoneDark, 1.15 + i * .32, 1.95, -.14, p, 14);
  box(.5, .03, .36, FIX.black, .9, .93, .02, p);
  cyl(.015, .015, .32, M.metal, .9, 1.08, -.2, p, 10); box(.02, .02, .18, M.metal, .9, 1.23, -.12, p);
  p = piece(2, 3.05, -5.08);
  rbox(.74, 2.7, .64, M.cabinet, 0, 1.36, 0, p, .02); box(.02, .9, .02, M.metal, -.3, 1.4, .33, p);
  p = piece(2, .3, -2.4);
  rbox(2.7, .88, 1.0, M.wood, 0, .45, 0, p, .03);
  box(2.86, .06, 1.14, FIX.stone, 0, .92, 0, p);
  cyl(.12, .09, .1, FIX.pot, -.7, 1.0, 0, p); rbox(.36, .04, .26, M.wood, .5, .97, .05, p, .02);
  for (let i = -1; i <= 1; i++) {
    const s = piece(2, .3 + i * .85, -1.45);
    cyl(.2, .2, .06, M.accent, 0, .7, 0, s); cyl(.02, .02, .66, M.metal, 0, .35, 0, s, 8);
    cyl(.18, .18, .02, M.metal, 0, .25, 0, s, 20);
  }
  const pendants = [];
  for (let i = -1; i <= 1; i++) {
    const pp = piece(2, .3 + i * .8, -2.4);
    cyl(.006, .006, .7, FIX.black, 0, 2.65, 0, pp, 6);
    const bulb = mesh(new THREE.SphereGeometry(.15, 24, 16), std('#f4e6cc', { emissive: '#ffc77a', emissiveIntensity: 0, roughness: .3 }), 0, 2.28, 0, pp);
    bulb.castShadow = false;
    const L = new THREE.PointLight('#ffc37a', 0, 5, 1.6); L.position.set(0, 2.1, 0); pp.add(L);
    pendants.push({ bulb, L });
  }

  // BEDROOM (x 3.5 .. 9)
  const slats = [];
  const flutedGroup = new THREE.Group(); home.add(flutedGroup);
  for (let i = 0; i < 24; i++) {
    const s = rbox(.085, 2.5, .07, M.fluted, 4.95 + i * .118, 0, -5.37, flutedGroup, .03);
    s.geometry.translate(0, 1.25, 0); s.scale.y = .001; slats.push(s);
  }
  p = piece(3, 6.3, -4.1);
  rbox(2.3, .3, 2.5, M.wood, 0, .17, 0, p, .04);
  rbox(2.14, .26, 2.3, FIX.linen, 0, .45, -.02, p, .1);
  rbox(2.2, .1, 1.55, M.bedding, 0, .6, .42, p, .05);
  rbox(2.22, .04, .45, M.accent, 0, .66, .85, p, .02);
  rbox(.62, .17, .4, FIX.linen, -.48, .65, -.86, p, .08); rbox(.62, .17, .4, FIX.linen, .48, .65, -.86, p, .08);
  rbox(2.5, 1.05, .14, M.sofa, 0, .98, -1.22, p, .06);
  const bedside = [];
  [-1.55, 1.55].forEach(x => {
    const n = piece(3, 6.3 + x, -5.0);
    rbox(.52, .48, .42, M.wood, 0, .26, 0, n, .03);
    cyl(.07, .09, .28, FIX.pot, 0, .64, 0, n, 16);
    const sh = cyl(.12, .17, .2, std('#efe4cf', { emissive: '#ffcf8a', emissiveIntensity: 0, roughness: 1 }), 0, .86, 0, n);
    const L = new THREE.PointLight('#ffc98a', 0, 4, 1.8); L.position.set(0, .9, .25); n.add(L);
    bedside.push({ sh, L });
  });
  p = piece(3, 6.3, -2.35);
  rbox(1.6, .14, .44, M.sofa, 0, .42, 0, p, .06);
  [-.7, .7].forEach(x => box(.04, .36, .4, M.metal, x, .18, 0, p));
  p = piece(3, 8.45, -.3);
  cyl(.2, .16, .42, FIX.pot, 0, .21, 0, p);
  for (let i = 0; i < 5; i++) { const l = mesh(new THREE.IcosahedronGeometry(rnd(.18, .26), 0), FIX.leaf, rnd(-.18, .18), rnd(.6, 1.15), rnd(-.18, .18), p); l.scale.y = rnd(1.3, 1.9); }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight('#fff3e0', '#2a2118', .55); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe9cf', 2.4);
  sun.position.set(-16, 13, 6); sun.target.position.set(0, 0, -2); scene.add(sun, sun.target);
  sun.castShadow = !SMALL;
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 10, bottom: -10, near: 1, far: 50 });
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  const lamp = new THREE.PointLight('#ffc78a', 0, 6, 1.6); lamp.position.set(-8.2, 1.55, -4.8); home.add(lamp);
  const fill = new THREE.PointLight('#ffd9a8', 0, 9, 1.4); fill.position.set(6.3, 2.6, -2.5); home.add(fill);

  // dust in the living-room light
  let dust = null;
  if (!SMALL && !REDUCED) {
    const n = 220, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = rnd(-8.8, -4); pos[i * 3 + 1] = rnd(.2, 2.6); pos[i * 3 + 2] = rnd(-4.2, -.4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffe8c4', size: .025, transparent: true, opacity: .55, depthWrite: false }));
    home.add(dust);
  }

  // ---------- camera keyframes (one per story anchor) ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const K = [
    { pos: V(-2.5, 15, 19), look: V(-6.2, -.5, -1.5) },  // 0 hero: aerial dollhouse, house sits right of the headline
    { pos: V(-4.1, 2.1, 3.5), look: V(-7.7, 1.0, -3.6) },  // 1 living
    { pos: V(.1, 2.35, 3.5), look: V(2.1, .95, -3.7) },    // 2 kitchen
    { pos: V(4.6, 2.0, 2.6), look: V(6.6, .85, -3.4) },    // 3 bedroom
    { pos: V(-11, 14, 19.5), look: V(-4.6, -.6, -1.5) },  // 4 styles overview, house left of the panel
    { pos: V(9, 12, 16), look: V(0, 0, -1) },              // 5 end, dusk
  ];
  if (SMALL) { K[0].pos.set(0, 21, 23); K[0].look.set(0, -6.5, -1.5); K[4].look.set(0, -.4, -1.5); K[2].look.set(1.2, .95, -3.7); K[4].pos.set(-8, 13, 18); K[5].pos.set(10, 16, 21); K[1].pos.set(-3.4, 2.1, 3.9); K[2].pos.set(2.2, 2.3, 3.6); K[3].pos.set(4.4, 2.1, 3.4); }
  const anchors = [...document.querySelectorAll('[data-k]')];
  let centers = [];
  const measure = () => { centers = anchors.map(el => { const r = el.getBoundingClientRect(); return r.top + scrollY + (el.dataset.k === '0' ? 0 : r.height / 2); }); };
  measure();
  function storyS() {
    const c = scrollY + innerHeight * .5;
    if (c <= centers[0] + innerHeight * .5) return 0;
    for (let i = 0; i < centers.length - 1; i++) {
      const a = i === 0 ? centers[0] + innerHeight * .5 : centers[i], b = centers[i + 1];
      if (c < b) return i + Math.max(0, (c - a) / (b - a));
    }
    return centers.length - 1;
  }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const outBack = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const tmpP = V(), tmpL = V(), camP = K[0].pos.clone(), camL = K[0].look.clone();
  function keyAt(s, outP, outL) {
    const i = Math.min(K.length - 2, Math.floor(s)), f = ease(clamp(s - i));
    outP.lerpVectors(K[i].pos, K[i + 1].pos, f); outL.lerpVectors(K[i].look, K[i + 1].look, f);
    // lift the camera over walls between rooms so it never clips through a partition
    if (i >= 1 && i <= 2) outP.y += Math.sin(f * Math.PI) * .35;
  }

  // pointer parallax
  let mx = 0, my = 0;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });

  // rail highlight
  const rail = [...document.querySelectorAll('[data-rail]')];

  // ---------- loop ----------
  const t0 = performance.now();
  let last = t0, orbit = 0, sSmooth = storyS();
  const cSun = new THREE.Color(), cDay = new THREE.Color('#ffe9cf'), cDusk = new THREE.Color('#ff9f5a');
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const age = (now - t0) / 1000;
    const sRaw = storyS();
    sSmooth = REDUCED ? sRaw : lerp(sSmooth, sRaw, 1 - Math.exp(-dt * 6));
    const s = sSmooth;

    // build: walls rise, then furniture drops in room by room
    const build = REDUCED ? 1 : clamp((age - .25) / 1.7);
    walls.scale.y = .02 + .98 * ease(build);
    for (const it of items) {
      const start = REDUCED ? -1 : 1.3 + (it.room - 1) * .55 + (it.i % 14) * .045;
      const k = clamp((age - start) / .7);
      const sc = k <= 0 ? .0001 : outBack(k);
      if (it.flat) it.g.scale.set(Math.max(.0001, ease(k)), 1, Math.max(.0001, ease(k)));
      else { it.g.scale.setScalar(sc); it.g.position.y = (1 - ease(k)) * .9; }
    }
    // fluted wall rises slat by slat as you reach the bedroom
    const fl = REDUCED ? clamp((s - 2.2) * 10) : clamp((s - 2.15) / .75);
    slats.forEach((sl, i) => { sl.scale.y = Math.max(.001, ease(clamp(fl * 1.6 - i / slats.length * .6))); });

    // lighting: lamps come on room by room; day turns to dusk near the end
    const dusk = clamp((s - 3.4) / 1.4);
    cSun.copy(cDay).lerp(cDusk, dusk); sun.color.copy(cSun); sun.intensity = lerp(2.4, .9, dusk);
    hemi.intensity = lerp(.55, .28, dusk);
    const lampOn = REDUCED ? 1 : clamp((age - 2.2) / 1.2);
    lamp.intensity = lampOn * lerp(5, 9, dusk); shade1.material.emissiveIntensity = lampOn * lerp(.6, 1.4, dusk);
    const kOn = clamp((s - 1.25) / .6);
    pendants.forEach((p, i) => { const v = clamp(kOn * 1.5 - i * .25); p.L.intensity = v * lerp(3, 6, dusk); p.bulb.material.emissiveIntensity = v * 1.6; });
    const bOn = clamp((s - 2.35) / .5);
    bedside.forEach(b => { b.L.intensity = bOn * lerp(2.5, 5, dusk); b.sh.material.emissiveIntensity = bOn * 1.3; });
    fill.intensity = dusk * 6;

    // style colours ease towards their target
    const kc = 1 - Math.exp(-dt * 5);
    for (const k in M) M[k].color.lerp(target[k], kc);

    // camera
    keyAt(s, tmpP, tmpL);
    if (s >= K.length - 1.001 && !REDUCED) {
      orbit += dt * .06;
      const r = Math.hypot(tmpP.x, tmpP.z), a = Math.atan2(tmpP.z, tmpP.x) + orbit;
      tmpP.set(Math.cos(a) * r, tmpP.y, Math.sin(a) * r);
    } else orbit = lerp(orbit, 0, kc);
    if (!REDUCED) { tmpP.x += mx * .7; tmpP.y -= my * .4; if (s < .3 && age > 2) tmpP.x += Math.sin(age * .25) * .6; }
    const kcam = REDUCED ? 1 : 1 - Math.exp(-dt * 3.2);
    camP.lerp(tmpP, kcam); camL.lerp(tmpL, kcam);
    camera.position.copy(camP); camera.lookAt(camL);

    if (dust) { const a = dust.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * .04; if (y > 2.7) y = .2; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(age + i) * dt * .01); } a.needsUpdate = true; }

    const ri = Math.min(4, Math.round(s));
    rail.forEach((a, i) => a.classList.toggle('on', i === ri));

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false); measure();
  });
  addEventListener('load', measure);
  new ResizeObserver(measure).observe(document.body);
  requestAnimationFrame(frame);
  window.__tour = { setStyle, storyS };
}
