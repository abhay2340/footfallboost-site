// Lumen & Loft demo: a 3D home that builds itself on load and gives a camera
// tour as the page scrolls. Three.js r160. Furniture, textures and the light
// probe are CC0 assets from Poly Haven (polyhaven.com), compressed for the web.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '/assets/vendor/three/RoundedBoxGeometry.js';
import { RoomEnvironment } from '/assets/vendor/three/RoomEnvironment.js';
import { GLTFLoader } from '/assets/vendor/three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from '/assets/vendor/three/addons/loaders/RGBELoader.js';
import { MeshoptDecoder } from '/assets/vendor/three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from '/assets/vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '/assets/vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '/assets/vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '/assets/vendor/three/addons/postprocessing/OutputPass.js';
import { BokehPass } from '/assets/vendor/three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from '/assets/vendor/three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from '/assets/vendor/three/addons/postprocessing/GTAOPass.js';
const ASSETS = '/s/demo-lumen-loft/assets/';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SMALL = Math.min(innerWidth, innerHeight) < 700;
const canvas = document.getElementById('scene');

// Data saver or a very slow connection: skip the 3D scene and keep the photo backdrop.
const conn = navigator.connection || {};
const SLOW = !!conn.saveData || /(^|-)2g$|^3g$/.test(conn.effectiveType || '');
// Heavy files (models, light probe) wait until the first frames are on screen.
const afterFirstPaint = new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120))));

let renderer;
try {
  if (SLOW) throw new Error('lite');
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
  // swap in a real interior light probe once the first frames are drawn (small 512 px file)
  afterFirstPaint.then(() => new RGBELoader().load(ASSETS + 'tex/lythwood_room_1k.hdr', hdr => {
    const env = pmrem.fromEquirectangular(hdr).texture; hdr.dispose(); scene.environment = env;
  }));

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

  const tl = new THREE.TextureLoader();
  function pbr(name, rx, ry, rot = 0) {
    const set = {};
    [['map', 'diffuse', true], ['normalMap', 'nor_gl', false], ['roughnessMap', 'rough', false]].forEach(([k, f, srgb]) => {
      const t = tl.load(ASSETS + 'tex/' + name + '_' + f + '.webp');
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.rotation = rot; t.anisotropy = aniso;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      set[k] = t;
    });
    return set;
  }
  // ---------- materials (style-driven colours) ----------
  const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .8, metalness: 0, envMapIntensity: .45 }, o));
  const M = {
    wall: std('#f4efe6', Object.assign(pbr('plastered_wall_04', 3, 1.2), { roughness: 1, normalScale: new THREE.Vector2(.6, .6) })),
    // satin-lacquered floor: a clear coat gives the soft window reflections real wood has
    floor: Object.assign(new THREE.MeshPhysicalMaterial(Object.assign({ color: '#e6dccf', roughness: .62, metalness: 0, envMapIntensity: .9, clearcoat: .45, clearcoatRoughness: .32 }, pbr('wood_floor', 7, 4.3))), {}),
    trim: std('#efe9de', { roughness: .5 }),
    sofa: std('#d9d1c4', (({ normalMap, roughnessMap }) => ({ normalMap, roughnessMap, roughness: 1, normalScale: new THREE.Vector2(1.4, 1.4) }))(pbr('wool_boucle', 3, 3))),
    accent: std('#6f7d5c', { roughness: .95 }),
    wood: std('#5b4636', (({ map, roughnessMap }) => ({ map, roughnessMap, roughness: .9 }))(pbr('wood_floor', 1, 1))),
    metal: std('#1f1d1b', { roughness: .35, metalness: .85, envMapIntensity: 1 }),
    fluted: std('#c9a27a', { roughness: .6 }),
    cabinet: std('#cdb89a', { roughness: .55 }),
    bedding: std('#ddd3c4', Object.assign(pbr('rough_linen', 2, 2), { roughness: 1 })),
  };
  const FIX = {
    stone: std('#eeeae3', { roughness: .28, envMapIntensity: 1 }),
    stoneDark: std('#d9d2c7', { roughness: .4 }),
    linen: std('#f6f2ec', Object.assign(pbr('rough_linen', 1.5, 1.5), { roughness: 1 })),
    plinth: std('#211c16', { roughness: .9 }),
    ground: std('#120f0c', { roughness: 1 }),
    leaf: std('#5d7150', { roughness: .9, flatShading: true }),
    pot: std('#b4876a', { roughness: .9 }),
    black: std('#151311', { roughness: .5 }),
    rug: std('#ffffff', Object.assign(pbr('poly_wool_herringbone', 3, 2.2), { roughness: 1 })),
    glass: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, map: canvasTex(256, 256, (g, W, H) => {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#9fc0dc'); gr.addColorStop(.62, '#e9eef0'); gr.addColorStop(.7, '#f7e6cc'); gr.addColorStop(1, '#d9c6a8');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(120,130,140,.35)'; for (let x = 0; x < W; x += 18) { const h = 20 + Math.random() * 50; g.fillRect(x, H * .7 - h, 14, h); }
      const sg = g.createRadialGradient(W * .7, H * .3, 0, W * .7, H * .3, 70); sg.addColorStop(0, 'rgba(255,250,235,.9)'); sg.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = sg; g.fillRect(0, 0, W, H);
    }) }),
  };
  const STYLES = {
    japandi: { wall: '#f4efe6', floor: '#e6dccf', sofa: '#d9d1c4', accent: '#6f7d5c', wood: '#5b4636', metal: '#1f1d1b', fluted: '#c9a27a', cabinet: '#cdb89a', bedding: '#ddd3c4', trim: '#efe9de' },
    luxe:    { wall: '#e2dfda', floor: '#7d5a44', sofa: '#2e3d3c', accent: '#b08d57', wood: '#3b2a20', metal: '#c9a46a', fluted: '#3b2a20', cabinet: '#2e3d3c', bedding: '#9c8a76', trim: '#cfcac2' },
    earthy:  { wall: '#f2d3b8', floor: '#b8805c', sofa: '#b5523b', accent: '#2f5d50', wood: '#6a3e26', metal: '#b8860b', fluted: '#8c5a3c', cabinet: '#2f5d50', bedding: '#d08452', trim: '#f6e6d4' },
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

  // real furniture: load each glTF once, place clones; items stay hidden until loaded
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const cache = {};
  const getModel = name => cache[name] || (cache[name] = afterFirstPaint.then(() => gltf.loadAsync(ASSETS + 'models/' + name + '.glb')).then(g => {
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.envMapIntensity = .9; } });
    return g.scene;
  }));
  function model(room, name, { x = 0, y = 0, z = 0, ry = 0, s = 1, top = null, parent = null, onload = null } = {}) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; (parent || home).add(g);
    const it = parent ? null : { g, room, i: items.length, loadedAt: Infinity };
    if (it) items.push(it);
    getModel(name).then(src => {
      const m = src.clone(true); m.scale.setScalar(s);
      const b = new THREE.Box3().setFromObject(m);
      m.position.y = top !== null ? top - b.max.y : y - b.min.y;
      g.add(m); if (it) it.loadedAt = (performance.now() - t0) / 1000; if (onload) onload(m);
    }).catch(() => {});
    return g;
  }
  // soft contact shadow under furniture
  const csTex = canvasTex(128, 128, (g, W, H) => {
    const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.55, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  });
  csTex.wrapS = csTex.wrapT = THREE.ClampToEdgeWrapping;
  const csMat = new THREE.MeshBasicMaterial({ map: csTex, transparent: true, depthWrite: false, toneMapped: false });
  function contact(w, d, x, z, ry = 0, o = 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), o === 1 ? csMat : csMat.clone());
    if (o !== 1) m.material.opacity = o;
    m.rotation.x = -Math.PI / 2; m.rotation.z = ry; m.position.set(x, .016, z); m.renderOrder = 1; home.add(m);
    items.push({ g: m, room: 0, i: items.length, flat: true });
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
  // --- easy realism wins: curtains, false ceiling with cove LED, soft corner shading ---
  const sheer = std('#f6f1e8', { transparent: true, opacity: .62, side: THREE.DoubleSide, roughness: 1, depthWrite: false });
  function curtain(axis, at, a, w) {
    const g = new THREE.PlaneGeometry(w, 2.8, 48, 1), pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) / w * 26) * .045);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, sheer); m.position.y = 1.45; m.castShadow = false;
    if (axis === 'z') { m.rotation.y = Math.PI / 2; m.position.x = at; m.position.z = a; } else { m.position.z = at; m.position.x = a; }
    walls.add(m);
  }
  curtain('z', -8.92, -4.35, .75); curtain('z', -8.92, -.45, .75);
  curtain('z', 8.92, -3.75, .65); curtain('z', 8.92, -1.05, .65);
  const glowTex = canvasTex(8, 128, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(1, 'rgba(255,214,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
  glowTex.wrapS = glowTex.wrapT = THREE.ClampToEdgeWrapping;
  const coveGlow = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const led = new THREE.MeshBasicMaterial({ color: '#ffe2b0', toneMapped: false });
  const aoTex = canvasTex(8, 128, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
  aoTex.wrapS = aoTex.wrapT = THREE.ClampToEdgeWrapping;
  const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: .32, depthWrite: false, color: '#000', side: THREE.DoubleSide });
  // runs along a wall face: axis x => wall along X at z (face normal nz), axis z => along Z at x (normal nx)
  function cove(axis, at, a0, a1, n) {
    const len = a1 - a0, mid = (a0 + a1) / 2;
    const ledge = axis === 'x' ? box(len, .12, .42, M.wall, mid, 2.86, at + n * .21, walls) : box(.42, .12, len, M.wall, at + n * .21, 2.86, mid, walls);
    ledge.castShadow = false;
    axis === 'x' ? box(len, .015, .02, led, mid, 2.795, at + n * .4, walls) : box(.02, .015, len, led, at + n * .4, 2.795, mid, walls);
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(len, .7), coveGlow); wash.position.y = 2.45; wash.renderOrder = 2;
    const wall2 = new THREE.Mesh(new THREE.PlaneGeometry(len, .55), aoMat); wall2.position.y = .275; wall2.rotation.x = Math.PI; wall2.renderOrder = 1;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(len, .5), aoMat); fl.renderOrder = 1;
    if (axis === 'x') { wash.position.z = wall2.position.z = at + n * .005; if (n < 0) wash.rotation.y = wall2.rotation.y = Math.PI; fl.rotation.x = -Math.PI / 2; fl.rotation.z = n > 0 ? Math.PI : 0; fl.position.set(mid, .018, at + n * .25); wash.position.x = wall2.position.x = mid; }
    else { wash.position.x = wall2.position.x = at + n * .005; wash.rotation.y = wall2.rotation.y = n > 0 ? Math.PI / 2 : -Math.PI / 2; fl.rotation.x = -Math.PI / 2; fl.rotation.z = n > 0 ? -Math.PI / 2 : Math.PI / 2; fl.position.set(at + n * .25, .018, mid); wash.position.z = wall2.position.z = mid; }
    walls.add(wash, wall2); home.add(fl);
  }
  cove('x', -5.41, -9.0, 9.0, 1);
  cove('z', -9.01, -5.4, 2.6, 1);
  cove('z', 9.01, -5.4, 2.6, -1);
  // corner shading on both faces of the partitions
  [[-2.5, -5.4, -1.4], [3.5, -5.4, -.4]].forEach(([x, z0, z1]) => [-1, 1].forEach(n => {
    const len = z1 - z0, mid = (z0 + z1) / 2;
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(len, .55), aoMat); w2.rotation.set(Math.PI, n > 0 ? Math.PI / 2 : -Math.PI / 2, 0); w2.position.set(x + n * .095, .275, mid); walls.add(w2);
    const f2 = new THREE.Mesh(new THREE.PlaneGeometry(len, .4), aoMat); f2.rotation.x = -Math.PI / 2; f2.rotation.z = n > 0 ? -Math.PI / 2 : Math.PI / 2; f2.position.set(x + n * .29, .018, mid); home.add(f2);
  }));

  // skirting boards on every wall face: the edge detail that makes a room read as built
  const skirt = (w, d, x, z) => { const b = box(w, .12, d, M.trim, x, .06, z, walls); b.castShadow = false; };
  skirt(18.0, .035, 0, -5.395);
  skirt(.035, 8.0, -8.995, -1.4); skirt(.035, 8.0, 8.995, -1.4);
  [-1, 1].forEach(n => { skirt(.035, 4.0, -2.5 + n * .105, -3.4); skirt(.035, 5.0, 3.5 + n * .105, -2.9); });

  // sun shafts through the windows: soft additive ribbons that follow the sun direction and fade at dusk
  const shaftTex = canvasTex(4, 128, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,236,200,.95)'); gr.addColorStop(.55, 'rgba(255,230,190,.25)'); gr.addColorStop(1, 'rgba(255,230,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
  shaftTex.wrapS = shaftTex.wrapT = THREE.ClampToEdgeWrapping;
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const shafts = [];
  function shaft(x, z0, z1, y0, y1, dx, dz) {
    // parallelogram: top edge at the window, bottom edge dropped to the floor along the sun direction
    const v = new Float32Array([x, y1, z0, x, y1, z1, x + dx, 0.03, z1 + dz, x + dx, 0.03, z0 + dz]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.Mesh(g, shaftMat); m.renderOrder = 3; m.frustumCulled = false; walls.add(m); shafts.push(m); return m;
  }
  shaft(-9.0, -4.1, -2.5, .6, 2.6, 3.0, -1.5); shaft(-9.0, -2.4, -.7, .6, 2.6, 3.0, -1.5);

  // a second rug under the bed, and a floating shelf with books in the living room
  const rug2 = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.7), FIX.rug);
  rug2.rotation.x = -Math.PI / 2; rug2.position.set(6.3, .011, -3.3); rug2.receiveShadow = true; home.add(rug2);
  items.push({ g: rug2, room: 3, i: items.length, flat: true });
  const bookCols = ['#b5643f', '#2c2620', '#7e8a6a', '#d6a961', '#efe7da', '#4a5a6a', '#a9765a'];
  function books(p, n, x0, y, z, seed) {
    let x = x0;
    for (let i = 0; i < n; i++) {
      const w = .03 + ((seed * 7 + i * 13) % 5) * .008, h = .2 + ((seed * 5 + i * 11) % 6) * .02;
      box(w, h, .2, std(bookCols[(seed + i * 3) % bookCols.length], { roughness: .8 }), x + w / 2, y + h / 2, z, p); x += w + .004;
    }
    return x;
  }
  const shelf = piece(1, -8.35, -5.3);
  box(1.3, .04, .26, M.wood, 0, 1.45, .03, shelf); box(1.3, .04, .26, M.wood, 0, 1.95, .03, shelf);
  books(shelf, 7, -.6, 1.47, .03, 1); books(shelf, 5, -.5, 1.97, .03, 4);
  cyl(.05, .06, .13, FIX.pot, .48, 2.04, .03, shelf, 14);

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
  contact(3.7, 1.6, -5.8, -4.5);
  model(1, 'coffee_table_round_01', { x: -5.8, z: -2.75, s: .95 });
  contact(1.7, 1.7, -5.8, -2.75, 0, .85);
  model(1, 'brass_vase_03', { x: -5.55, z: -2.9, y: .47, s: 1.5 });
  model(1, 'modern_arm_chair_01', { x: -3.6, z: -2.45, ry: -1.0 });
  contact(1.3, 1.3, -3.6, -2.45, 0, .85);
  model(1, 'side_table_tall_01', { x: -7.8, z: -4.5 });
  model(1, 'potted_plant_04', { x: -7.8, z: -4.5, y: .76 });
  contact(.6, .6, -7.8, -4.5, 0, .7);
  p = piece(1, -3.75, -4.85);
  cyl(.2, .22, .04, M.metal, 0, .02, 0, p); cyl(.018, .018, 1.6, M.metal, 0, .82, 0, p, 10);
  const shade1 = cyl(.16, .28, .34, std('#f3ead9', Object.assign(pbr('rough_linen', 1, 1), { emissive: '#ffcf8a', emissiveIntensity: 0, roughness: 1, side: THREE.DoubleSide })), 0, 1.68, 0, p);
  model(1, 'potted_plant_01', { x: -8.4, z: -.3, s: 1.3 });
  contact(1, 1, -8.4, -.3, 0, .75);
  model(1, 'potted_plant_02', { x: -3.0, z: -.75, s: 1.05 });
  contact(.9, .9, -3.0, -.75, 0, .75);
  const art = [artTex(0), artTex(1), artTex(2)];
  p = piece(1, -6.4, -5.36);
  box(.94, 1.16, .04, M.wood, 0, 1.85, 0, p); mesh(new THREE.PlaneGeometry(.84, 1.06), std('#fff', { map: art[0], roughness: 1 }), 0, 1.85, .025, p);
  p = piece(1, -5.0, -5.36);
  box(.74, .94, .04, M.wood, 0, 1.74, 0, p); mesh(new THREE.PlaneGeometry(.64, .84), std('#fff', { map: art[1], roughness: 1 }), 0, 1.74, .025, p);
  // fluted console against the partition, with a few objects on it
  model(1, 'modern_wooden_cabinet', { x: -2.86, z: -3.6, ry: -Math.PI / 2 });
  contact(2.8, 1.0, -2.86, -3.6, Math.PI / 2, .8);
  model(1, 'ceramic_vase_01', { x: -2.86, z: -4.45, y: .68, s: 1.2 });
  model(1, 'ceramic_vase_03', { x: -2.86, z: -4.15, y: .68 });
  model(1, 'brass_diya_lantern', { x: -2.86, z: -2.75, y: .68, s: 1.3 });
  p = piece(1, -2.63, -3.6, -Math.PI / 2);
  box(.84, 1.04, .04, M.wood, 0, 1.75, 0, p); mesh(new THREE.PlaneGeometry(.74, .94), std('#fff', { map: art[2], roughness: 1 }), 0, 1.75, .025, p);

  // KITCHEN (x -2.5 .. 3.5)
  p = piece(2, 0, -5.08);
  rbox(4.8, .86, .62, M.cabinet, .1, .45, 0, p, .02);
  for (let i = 1; i < 8; i++) box(.008, .8, .01, FIX.black, -2.3 + i * .6, .45, .315, p);
  box(4.86, .05, .68, FIX.stone, .1, .9, .02, p);
  box(4.8, .62, .02, FIX.stoneDark, .1, 1.24, -.3, p);
  rbox(3.0, .72, .36, M.cabinet, -.8, 2.15, -.12, p, .02);
  for (let i = 1; i < 4; i++) box(.008, .66, .01, FIX.black, -2.3 + i * .75, 2.15, .065, p);
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
  rbox(.36, .04, .26, M.wood, .5, .97, .05, p, .02);
  model(2, 'ceramic_vase_03', { x: -.4, z: -2.4, y: .95, s: .9 });
  model(2, 'jug_01', { x: -1.5, z: -5.0, y: .93, s: 1.2 });
  contact(3.3, 1.6, .3, -2.4);
  contact(5.4, 1.0, .1, -5.05);
  for (let i = -1; i <= 1; i++) {
    const s = piece(2, .3 + i * .85, -1.45);
    cyl(.2, .2, .06, M.accent, 0, .7, 0, s); cyl(.02, .02, .66, M.metal, 0, .35, 0, s, 8);
    cyl(.18, .18, .02, M.metal, 0, .25, 0, s, 20);
  }
  const pendants = [];
  for (let i = -1; i <= 1; i++) {
    const pp = piece(2, .3 + i * .8, -2.4);
    const L = new THREE.PointLight('#ffc37a', 0, 5, 1.6); L.position.set(0, 1.9, 0); pp.add(L);
    const rec = { L, mats: [] };
    model(2, 'modern_ceiling_lamp_01', { parent: pp, top: 3.0, onload: m => m.traverse(o => {
      if (o.isMesh && /globe/i.test(o.material.name)) {
        o.material = o.material.clone(); o.material.emissive = new THREE.Color('#ffc77a'); o.material.emissiveIntensity = 0;
        o.castShadow = false; rec.mats.push(o.material);
      }
    }) });
    pendants.push(rec);
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
    model(3, 'side_table_01', { parent: n, s: .9 });
    cyl(.07, .09, .28, FIX.pot, 0, .64, 0, n, 16);
    const sh = cyl(.12, .17, .2, std('#f3ead9', Object.assign(pbr('rough_linen', 1, 1), { emissive: '#ffcf8a', emissiveIntensity: 0, roughness: 1 })), 0, .86, 0, n);
    contact(.8, .7, 6.3 + x, -5.0, 0, .7);
    const L = new THREE.PointLight('#ffc98a', 0, 4, 1.8); L.position.set(0, .9, .25); n.add(L);
    bedside.push({ sh, L });
  });
  contact(2.9, 3.1, 6.3, -4.1, 0, .9);
  model(3, 'Ottoman_01', { x: 6.3, z: -2.3 });
  contact(1.2, .9, 6.3, -2.3, 0, .8);
  model(3, 'mid_century_lounge_chair', { x: 8.05, z: -1.5, ry: -.8 });
  contact(1.3, 1.3, 8.05, -1.5, 0, .85);
  model(3, 'potted_plant_02', { x: 4.05, z: -.9, s: 1.05 });
  contact(.9, .9, 4.05, -.9, 0, .75);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight('#fff3e0', '#2a2118', .55); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe9cf', 2.4);
  sun.position.set(-16, 13, 6); sun.target.position.set(0, 0, -2); scene.add(sun, sun.target);
  sun.castShadow = !SMALL;
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 10, bottom: -10, near: 1, far: 50 });
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 8, bottom: -8 });
  sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0003; sun.shadow.normalBias = .025; sun.shadow.radius = 4;
  const lamp = new THREE.PointLight('#ffc78a', 0, 6, 1.6); lamp.position.set(-3.75, 1.55, -4.85); home.add(lamp);
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
    { pos: V(-9.5, 11.5, 15.5), look: V(-4.2, -.5, -1.5) },  // 4 styles overview, house left of the panel
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

  // soft glow on lamps and windows (desktop only)
  let composer = null, bokeh = null, film = null, gtao = null, bloom = null;
  if (!SMALL) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // ambient occlusion: soft darkening in corners, under furniture and where walls meet the floor.
    // Transparent decoration (glow, shafts, curtains, leaf cards) is hidden for this pass only.
    gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    gtao.updateGtaoMaterial({ radius: .55, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 14, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1, rings: 2, samples: 16 });
    gtao.blendIntensity = .85;
    const aoRender = gtao.render.bind(gtao);
    let aoHide = [], aoAge = -1;
    gtao.render = function (...a) {
      if (aoAge < 0 || performance.now() - aoAge > 2500) {
        aoHide = []; aoAge = performance.now();
        scene.traverse(o => { const m = o.material; if (o.isMesh && m && !Array.isArray(m) && ((m.transparent && m.depthWrite === false) || m.alphaTest > 0 || m.blending === THREE.AdditiveBlending)) aoHide.push(o); });
      }
      aoHide.forEach(o => { o.userData._v = o.visible; o.visible = false; });
      aoRender(...a);
      aoHide.forEach(o => { o.visible = o.userData._v; });
    };
    composer.addPass(gtao);
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .32, .55, .92);
    composer.addPass(bloom);
    // lens blur that fades in when the camera settles in a room
    bokeh = new BokehPass(scene, camera, { focus: 6, aperture: 0, maxblur: .006 });
    composer.addPass(bokeh);
    composer.addPass(new OutputPass());
    // soft vignette and fine film grain, after tone mapping
    film = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D tDiffuse;uniform float uTime;varying vec2 vUv;' +
        'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}' +
        'void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 d=vUv-.5;float v=smoothstep(.85,.25,length(d*vec2(1.05,1.2)));' +
        // gentle S-curve for contrast, warm highlights and cooler shadows, then vignette and fine grain
        'float l=dot(c.rgb,vec3(.299,.587,.114));c.rgb=mix(c.rgb,c.rgb*c.rgb*(3.-2.*c.rgb),.28);' +
        'c.rgb*=mix(vec3(.97,.99,1.03),vec3(1.035,1.,.95),smoothstep(.15,.85,l));' +
        'c.rgb*=mix(.72,1.,v);c.rgb+=(h(vUv*vec2(1920.,1080.)+uTime)-.5)*.026;gl_FragColor=c;}'
    });
    composer.addPass(film);
  }

  // ---------- loop ----------
  const t0 = performance.now();
  let last = t0, orbit = 0, sSmooth = storyS();
  sun.shadow.camera.updateProjectionMatrix();
  // quality governor: if the first seconds run slowly, drop the costly effects step by step
  let gov = { n: 0, sum: 0, level: 0, wait: 0 };
  function degrade() {
    gov.level++;
    if (gov.level === 1) { if (gtao) { gtao.enabled = false; } }
    else if (gov.level === 2) { if (bokeh) bokeh.enabled = false; renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight, false); if (composer) composer.setPixelRatio(1); }
    else if (gov.level === 3) { if (bloom) bloom.enabled = false; renderer.shadowMap.enabled = false; sun.castShadow = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
    else if (gov.level === 4) { composer = null; }
  }
  let tick = 0;
  const cSun = new THREE.Color(), cDay = new THREE.Color('#ffe9cf'), cDusk = new THREE.Color('#ff9f5a');
  function frame(now) {
    // nothing to see: tab hidden, or the full-screen video walkthrough is covering the canvas
    if (document.hidden || document.body.classList.contains('in-walk')) { last = now; requestAnimationFrame(frame); return; }
    const raw = now - last;
    const dt = Math.min(.05, raw / 1000); last = now;
    const age = (now - t0) / 1000;
    // governor: measure real frame time between 3 s and 6 s, once everything has loaded
    if (age > 3 && gov.level < 4 && raw < 400) {
      gov.n++; gov.sum += raw;
      if (gov.n >= 45) { if (gov.sum / gov.n > 30) degrade(); gov.n = 0; gov.sum = 0; }
    }
    const sRaw = storyS();
    sSmooth = REDUCED ? sRaw : lerp(sSmooth, sRaw, 1 - Math.exp(-dt * 6));
    const s = sSmooth;

    // build: walls rise, then furniture drops in room by room
    const build = REDUCED ? 1 : clamp((age - .25) / 1.7);
    walls.scale.y = .02 + .98 * ease(build);
    for (const it of items) {
      let start = REDUCED ? -1 : 1.3 + (it.room - 1) * .55 + (it.i % 14) * .045;
      if (it.loadedAt !== undefined) start = Math.max(start, it.loadedAt + (REDUCED ? -1 : 0));
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
    pendants.forEach((p, i) => { const v = clamp(kOn * 1.5 - i * .25); p.L.intensity = v * lerp(3, 6, dusk); p.mats.forEach(m => m.emissiveIntensity = v * 2.2); });
    const bOn = clamp((s - 2.35) / .5);
    bedside.forEach(b => { b.L.intensity = bOn * lerp(2.5, 5, dusk); b.sh.material.emissiveIntensity = bOn * 1.3; });
    fill.intensity = dusk * 6; coveGlow.opacity = lerp(.3, .75, dusk);
    shaftMat.opacity = lerp(.2, 0, clamp(dusk * 1.6)) * clamp((age - 1.5) / 1.5);

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
    if (!REDUCED && !SMALL) {
      tmpP.x += Math.sin(age * .61) * .035 + Math.sin(age * 1.37) * .012;
      tmpP.y += Math.sin(age * .83 + 1.3) * .025;
      tmpL.x += Math.sin(age * .47 + .4) * .03; tmpL.y += Math.sin(age * .71 + 2.1) * .02;
    }
    const kcam = REDUCED ? 1 : 1 - Math.exp(-dt * 3.2);
    camP.lerp(tmpP, kcam); camL.lerp(tmpL, kcam);
    camera.position.copy(camP); camera.lookAt(camL);

    if (dust) { const a = dust.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * .04; if (y > 2.7) y = .2; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(age + i) * dt * .01); } a.needsUpdate = true; }

    const ri = Math.min(4, Math.round(s));
    rail.forEach((a, i) => a.classList.toggle('on', i === ri));

    if (bokeh) {
      const r = Math.round(s), settle = (r >= 1 && r <= 3) ? clamp(1 - Math.abs(s - r) * 5) : 0;
      bokeh.uniforms.focus.value = camera.position.distanceTo(camL);
      bokeh.uniforms.aperture.value = lerp(bokeh.uniforms.aperture.value, settle * .0022, 1 - Math.exp(-dt * 3));
    }
    if (film) film.uniforms.uTime.value = (age * 60) % 1000;
    // once the page has moved on to the plain business sections, the scene sits blurred behind them: draw it at half rate
    tick++;
    const passive = scrollY > centers[centers.length - 1];
    if (!(passive && tick % 2)) { if (composer) composer.render(); else renderer.render(scene, camera); }
    requestAnimationFrame(frame);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false); if (composer) composer.setSize(innerWidth, innerHeight); measure();
  });
  addEventListener('load', measure);
  new ResizeObserver(measure).observe(document.body);
  requestAnimationFrame(frame);
  window.__tour = { setStyle, storyS };
}
