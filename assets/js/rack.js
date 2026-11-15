// Anas Tanveer · portfolio: the 3D rack in the hero.
// Drawn with three.js (vendored, MIT). Every device is built from boxes in code,
// so there are no models or textures to download.
import * as THREE from './vendor/three.module.min.js';

const root = document.getElementById('rack');
const canvas = document.getElementById('rack-canvas');
const labelsEl = document.getElementById('rack-labels');
const leadersEl = document.getElementById('rack-leaders');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = getComputedStyle(document.documentElement);
const cssColor = (name, fallback) => css.getPropertyValue(name).trim() || fallback;

const C = {
  paper: cssColor('--paper', '#f2efe8'),
  ink: cssColor('--ink', '#15171a'),
  accent: cssColor('--accent', '#e8490f'),
  frame: '#d6d1c5', metal: '#e8e4db', metal2: '#d3cec1', bay: '#ddd8cd', white: '#fbf9f4',
  dark: '#2b2e33', dark2: '#3b3f45', port: '#0f1012', sfp: '#5c6169', screen: '#121416', lcd: '#9fd8b4',
  led: '#22b35f', amber: '#f2a20c', off: '#5d615b', blue: '#3466d6', term: '#2f8f5b', key: '#cbc6ba',
};
const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// ---- rack dimensions (1 unit is about 100 mm) ----
const U = 0.46;
const UNITS = 16;
const BODY_W = 4.45;
const EAR_W = 4.83;
const RACK_D = 4.2;
const BASE_Y = 0.42;
const FRONT_Z = RACK_D / 2 - 0.14;
const RACK_H = BASE_Y + UNITS * U + 0.1;

// u = lowest rack unit the device sits in. `step` links a device to a block of text on the page.
const LAYOUT = [
  { id: 'network', u: 15, units: 2, name: 'PP-01 / SW-01', desc: 'Patch panel, access switch', step: 'network', pull: 1.25 },
  { id: 'brush', u: 14, units: 1 },
  { id: 'firewall', u: 13, units: 1, name: 'FW-01', desc: 'Next-generation firewall', step: 'firewall', pull: 1.5 },
  { id: 'console', u: 12, units: 1, name: 'KVM-01', desc: 'Console drawer', step: 'console', pull: 3.4 },
  { id: 'server', u: 10, units: 2, name: 'SRV-01', desc: 'AD, DNS, DHCP, files', step: 'server', pull: 1.6 },
  { id: 'hypervisor', u: 8, units: 2, name: 'HV-01', desc: 'Virtualization host', step: 'hypervisor', pull: 1.6 },
  { id: 'vent', u: 7, units: 1 },
  { id: 'pbx', u: 6, units: 1, name: 'PBX-01', desc: 'IP PBX', step: 'voip', pull: 1.45 },
  { id: 'monitor', u: 5, units: 1, name: 'MON-01', desc: 'Monitoring unit', step: 'voip', pull: 1.45 },
  { id: 'blank', u: 4, units: 1 },
  { id: 'ups', u: 2, units: 2, name: 'UPS-01', desc: 'Power' },
  { id: 'vent2', u: 1, units: 1 },
];

// ---- geometry batching: many boxes, one draw call ----
class Batch {
  constructor() {
    this.p = []; this.n = []; this.c = []; this.i = []; this.e = [];
    this.oy = 0;
  }

  // Box by centre. Returns the index of its first vertex, for recolouring later.
  box(cx, cy, cz, w, h, d, color, edges = true) {
    cy += this.oy;
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const col = rgb(color);
    const faces = [
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]],
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]],
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]],
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
    ];
    const start = this.p.length / 3;
    for (const f of faces) {
      const base = this.p.length / 3;
      for (let k = 0; k < 4; k++) { this.p.push(...f[k]); this.n.push(...f[4]); this.c.push(...col); }
      this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    if (edges) {
      const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      const pairs = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      for (const [a, b] of pairs) this.e.push(...v[a], ...v[b]);
    }
    return start;
  }

  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    this.colors = g.getAttribute('aColor');
    return new THREE.Mesh(g, material);
  }

  lines(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.e, 3));
    return new THREE.LineSegments(g, material);
  }

  recolor(start, col) {
    const a = this.colors.array;
    for (let k = 0; k < 24; k++) { a[(start + k) * 3] = col[0]; a[(start + k) * 3 + 1] = col[1]; a[(start + k) * 3 + 2] = col[2]; }
    this.colors.needsUpdate = true;
  }
}

// LEDs live in their own batch so they can change colour without touching the rest.
class Leds extends Batch {
  constructor() { super(); this.list = []; }
  add(x, y, color, mode = 'steady', w = 0.045, h = 0.03) {
    const on = rgb(color), off = rgb(C.off);
    const lit = mode !== 'off';
    const start = this.box(x, y, 0.012, w, h, 0.012, lit ? color : C.off, false);
    if (mode !== 'steady' && mode !== 'off') this.list.push({ start, on, off, mode, lit: true, next: Math.random() * 2 });
  }
  update(t) {
    for (const l of this.list) {
      if (t < l.next) continue;
      l.lit = !l.lit;
      if (l.mode === 'activity') l.next = t + (l.lit ? 0.05 + Math.random() * 0.25 : 0.04 + Math.random() * 0.9);
      else if (l.mode === 'disk') l.next = t + (l.lit ? 0.4 + Math.random() * 2.4 : 0.05 + Math.random() * 0.1);
      else l.next = t + 0.55;
      this.recolor(l.start, l.lit ? l.on : l.off);
    }
  }
}

// Flat fills with a little shading per face, and a "dim" control that fades a device towards the paper.
const LIGHT = new THREE.Vector3(-0.35, 0.85, 0.4).normalize();
const PAPER = new THREE.Vector3(...rgb(C.paper));
const fillMaterial = () => new THREE.ShaderMaterial({
  uniforms: { uDim: { value: 0 }, uPaper: { value: PAPER }, uLight: { value: LIGHT } },
  vertexShader: `
    attribute vec3 aColor;
    uniform vec3 uLight;
    varying vec3 vColor;
    varying float vShade;
    void main() {
      vColor = aColor;
      vec3 n = normalize(mat3(modelMatrix) * normal);
      vShade = 0.72 + 0.28 * clamp(dot(n, uLight) * 0.5 + 0.5, 0.0, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform float uDim;
    uniform vec3 uPaper;
    varying vec3 vColor;
    varying float vShade;
    void main() {
      gl_FragColor = vec4(mix(vColor * vShade, uPaper, uDim), 1.0);
    }`,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});

// ---- device fronts ----
const port = (b, x, y, w = 0.125, h = 0.1, color = C.port) => b.box(x, y, 0.004, w, h, 0.012, color, false);

function faceplate(b, h, color, depth, bodyColor) {
  b.box(0, h / 2, -0.03, EAR_W, h - 0.02, 0.06, color);
  b.box(0, h / 2, -0.06 - depth / 2, BODY_W, h - 0.05, depth, bodyColor);
  for (const sx of [-1, 1]) for (const y of [0.1, h - 0.1]) b.box(sx * (EAR_W / 2 - 0.09), y, 0.004, 0.07, 0.045, 0.01, C.port, false);
}

const build = {
  network(b, leds, dev) {
    // patch panel on top, switch below, patch cables between them
    b.oy = leds.oy = U;
    faceplate(b, U, C.metal, 0.5, C.metal2);
    const patch = [];
    for (let g = 0; g < 4; g++) {
      const gx = -1.86 + g * 0.98;
      b.box(gx + 0.375, 0.37, 0.004, 0.86, 0.05, 0.01, C.white);
      for (let i = 0; i < 6; i++) { port(b, gx + i * 0.15, 0.2, 0.115, 0.105); patch.push(gx + i * 0.15); }
    }
    b.oy = leds.oy = 0;
    faceplate(b, U, C.dark, 2.6, C.dark2);
    [0.34, 0.25, 0.16].forEach((y, i) => leds.add(-2.04, y, i === 2 ? C.amber : C.led, i === 1 ? 'blink' : 'steady'));
    port(b, -1.8, 0.23, 0.13, 0.1, C.blue);
    const sw = [];
    for (let g = 0; g < 2; g++) for (let i = 0; i < 6; i++) {
      const x = -1.44 + g * 1.07 + i * 0.16;
      port(b, x, 0.335); port(b, x, 0.125);
      leds.add(x - 0.032, 0.232, C.led, 'activity', 0.04, 0.022);
      leds.add(x + 0.032, 0.232, i % 4 === 3 ? C.amber : C.led, i % 5 === 4 ? 'off' : 'activity', 0.04, 0.022);
      sw.push(x);
    }
    for (let i = 0; i < 4; i++) port(b, 0.95 + i * 0.2, 0.23, 0.15, 0.1, C.sfp);
    decal(dev, 'SW-01', 2.0, 0.23, 0.5, 0.125, '#d9d5cb');

    // patch cables: [patch port, switch port, colour]
    const runs = [[1, 0, C.accent], [4, 3, C.ink], [8, 5, C.blue], [10, 7, C.accent], [15, 8, C.ink], [19, 10, C.accent], [22, 11, C.blue]];
    dev.cables = runs.map(([from, to, color], k) => {
      const a = new THREE.Vector3(patch[from], U + 0.2, 0.01);
      const z = new THREE.Vector3(sw[to], 0.335, 0.01);
      const bow = 0.3 + (k % 3) * 0.07;
      const curve = new THREE.CatmullRomCurve3([
        a,
        new THREE.Vector3(a.x, a.y - 0.03, bow * 0.8),
        new THREE.Vector3((a.x + z.x) / 2, (a.y + z.y) / 2 - 0.02, bow + 0.08),
        new THREE.Vector3(z.x, z.y + 0.05, bow * 0.7),
        z,
      ]);
      const g = new THREE.TubeGeometry(curve, 22, 0.026, 5, false);
      const col = rgb(color);
      const colors = new Float32Array(g.getAttribute('position').count * 3);
      for (let v = 0; v < colors.length; v += 3) colors.set(col, v);
      g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
      return g;
    });
  },

  brush(b) {
    faceplate(b, U, C.dark, 0.3, C.dark2);
    b.box(0, U / 2, 0.004, 3.9, 0.13, 0.012, C.port, false);
  },

  firewall(b, leds, dev) {
    faceplate(b, U, C.dark, 3.0, C.dark2);
    b.box(-1.98, U / 2, 0.006, 0.62, U - 0.02, 0.012, C.accent, false);
    decal(dev, 'FW-01', -1.98, 0.23, 0.5, 0.125, '#ffffff');
    port(b, -1.42, 0.23, 0.13, 0.1, C.blue);
    port(b, -1.2, 0.23, 0.1, 0.045);
    for (let i = 0; i < 8; i++) {
      const x = -0.82 + i * 0.17;
      port(b, x, 0.2, 0.13, 0.105);
      leds.add(x, 0.34, i === 6 ? C.amber : C.led, i > 4 && i !== 6 ? 'off' : 'activity', 0.05, 0.022);
    }
    for (let i = 0; i < 2; i++) port(b, 0.78 + i * 0.2, 0.23, 0.15, 0.1, C.sfp);
    ['steady', 'steady', 'blink', 'off'].forEach((mode, i) => leds.add(1.5 + i * 0.14, 0.23, C.led, mode, 0.05, 0.05));
  },

  server(b, leds, dev) {
    const h = 2 * U;
    faceplate(b, h, C.metal, 3.6, C.metal2);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const x = -1.86 + c * 0.66, y = 0.25 + r * 0.42;
      b.box(x, y, 0.012, 0.62, 0.36, 0.03, C.bay);
      b.box(x + 0.25, y, 0.03, 0.035, 0.26, 0.012, C.port, false);
      leds.add(x - 0.25, y - 0.12, C.led, c === 3 && r === 1 ? 'steady' : 'disk');
    }
    for (let i = 0; i < 7; i++) b.box(1.5, 0.13 + i * 0.075, 0.004, 0.95, 0.03, 0.01, C.port, false);
    b.box(1.12, 0.79, 0.012, 0.1, 0.1, 0.024, C.dark);
    leds.add(1.27, 0.79, C.led, 'steady');
    decal(dev, 'SRV-01', 1.72, 0.79, 0.56, 0.14, C.ink);
  },

  hypervisor(b, leds, dev) {
    const h = 2 * U;
    faceplate(b, h, C.metal, 3.6, C.metal2);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
      const x = -1.93 + c * 0.5, y = 0.25 + r * 0.42;
      b.box(x, y, 0.012, 0.46, 0.36, 0.03, C.bay);
      b.box(x + 0.18, y, 0.03, 0.03, 0.26, 0.012, C.port, false);
      leds.add(x - 0.17, y - 0.12, C.led, (c + r) % 4 === 0 ? 'steady' : 'disk');
    }
    b.box(1.62, h / 2, 0.006, 0.9, h - 0.16, 0.012, C.dark, false);
    decal(dev, 'HV-01', 1.62, 0.7, 0.5, 0.125, '#d9d5cb');
    for (let i = 0; i < 4; i++) leds.add(1.32 + i * 0.2, 0.46, i === 3 ? C.amber : C.led, i === 3 ? 'blink' : 'steady', 0.1, 0.035);
    port(b, 1.4, 0.22, 0.1, 0.045, C.sfp);
    port(b, 1.58, 0.22, 0.1, 0.045, C.sfp);
    b.box(1.88, 0.22, 0.018, 0.09, 0.09, 0.02, C.metal);
  },

  vent(b) {
    faceplate(b, U, C.metal, 0.2, C.metal2);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) b.box(-1.9 + c * 0.345, 0.13 + r * 0.1, 0.004, 0.24, 0.035, 0.01, C.port, false);
  },

  pbx(b, leds, dev) {
    faceplate(b, U, C.metal, 2.2, C.metal2);
    b.box(-1.55, 0.23, 0.006, 0.9, 0.25, 0.012, C.screen);
    b.box(-1.67, 0.27, 0.014, 0.5, 0.03, 0.004, C.lcd, false);
    b.box(-1.75, 0.19, 0.014, 0.34, 0.03, 0.004, C.lcd, false);
    for (let i = 0; i < 3; i++) b.box(-0.92 + i * 0.14, 0.23, 0.01, 0.08, 0.08, 0.02, C.dark);
    for (let i = 0; i < 3; i++) port(b, -0.25 + i * 0.2, 0.23, 0.13, 0.105);
    for (let i = 0; i < 4; i++) port(b, 0.55 + i * 0.15, 0.23, 0.095, 0.085);
    for (let i = 0; i < 5; i++) leds.add(1.42 + i * 0.12, 0.17, C.led, i === 2 ? 'blink' : i > 2 ? 'off' : 'steady');
    decal(dev, 'PBX-01', 1.66, 0.32, 0.56, 0.125, C.ink);
  },

  monitor(b, leds, dev) {
    faceplate(b, U, C.dark, 1.8, C.dark2);
    b.box(-1.8, 0.23, 0.006, 0.56, 0.24, 0.012, C.screen, false);
    for (let i = 0; i < 3; i++) b.box(-1.95 + i * 0.15, 0.23, 0.014, 0.09, 0.14, 0.004, C.amber, false);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) port(b, -1.22 + c * 0.15, 0.15 + r * 0.16, 0.1, 0.085, C.sfp);
    b.box(0.5, 0.23, 0.02, 0.8, 0.16, 0.04, C.term, false);
    for (let i = 0; i < 6; i++) b.box(0.17 + i * 0.132, 0.23, 0.042, 0.06, 0.06, 0.004, C.metal, false);
    for (let i = 0; i < 8; i++) leds.add(1.22 + i * 0.1, 0.17, i === 5 ? C.amber : C.led, i === 5 ? 'blink' : 'steady', 0.05, 0.05);
    decal(dev, 'MON-01', 1.57, 0.32, 0.56, 0.125, '#d9d5cb');
  },

  ups(b, leds, dev) {
    const h = 2 * U;
    faceplate(b, h, C.dark, 3.4, C.dark2);
    for (let i = 0; i < 9; i++) b.box(-1.95 + i * 0.11, h / 2, 0.004, 0.045, h - 0.3, 0.01, C.port, false);
    b.box(0.1, h / 2, 0.008, 1.3, 0.56, 0.016, C.screen, false);
    for (let i = 0; i < 5; i++) leds.add(-0.3 + i * 0.2, 0.53, C.led, i === 4 ? 'off' : 'steady', 0.14, 0.2);
    b.box(0.1, 0.3, 0.018, 0.9, 0.035, 0.004, C.lcd, false);
    b.box(1.75, h / 2, 0.02, 0.17, 0.17, 0.04, C.metal);
    leds.add(1.75, 0.2, C.led, 'steady');
    decal(dev, 'UPS-01', 1.3, 0.74, 0.56, 0.125, '#d9d5cb');
  },
};
build.blank = (b) => faceplate(b, U, C.metal, 0.15, C.metal2);
build.vent2 = build.vent;

// Small text plates on device fronts. Drawn on a canvas once the web font is ready.
const decals = [];
function decal(dev, text, x, y, w, h, color) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = Math.round(256 * h / w);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, 0.02);
  dev.group.add(m);
  dev.decals.push(mat);
  decals.push({ cv, tex, text, color });
}
function paintDecals() {
  for (const d of decals) {
    const g = d.cv.getContext('2d');
    g.clearRect(0, 0, d.cv.width, d.cv.height);
    g.fillStyle = d.color;
    g.font = `500 ${Math.round(d.cv.height * 0.74)}px "IBM Plex Mono", ui-monospace, Consolas, monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(d.text, d.cv.width / 2, d.cv.height / 2 + 2);
    d.tex.needsUpdate = true;
  }
}

// ---- console drawer: tray, keyboard, and a lid with a screen that opens ----
const TERMINAL = [
  ['> whoami', 'anas tanveer / it infrastructure'],
  ['> uptime', 'boring. as intended.'],
  ['> tools', 'powershell  ansible  terraform'],
];
function buildConsole(dev) {
  const b = dev.batch, h = U;
  b.box(0, h / 2, -0.03, EAR_W, h - 0.02, 0.06, C.metal);
  b.box(0, h / 2, 0.06, 1.3, 0.07, 0.12, C.dark);
  for (const sx of [-1, 1]) {
    b.box(sx * 1.9, h / 2, 0.01, 0.2, 0.13, 0.02, C.dark, false);
    for (const y of [0.1, h - 0.1]) b.box(sx * (EAR_W / 2 - 0.09), y, 0.004, 0.07, 0.045, 0.01, C.port, false);
    b.box(sx * 2.12, 0.07, -3.1, 0.06, 0.06, 1.0, C.metal2);
  }
  b.box(0, 0.07, -1.39, BODY_W - 0.1, 0.08, 2.66, C.metal2);
  b.box(-0.25, 0.114, -0.82, 3.5, 0.008, 1.0, C.dark, false);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) b.box(-1.81 + c * 0.24, 0.126, -0.48 - r * 0.225, 0.19, 0.02, 0.175, C.key, false);
  b.box(1.85, 0.114, -0.82, 0.5, 0.008, 0.62, C.bay);
  decal(dev, 'KVM-01', -1.45, 0.23, 0.56, 0.125, C.ink);

  const lid = new Batch();
  lid.box(0, 0.05, 1.22, BODY_W - 0.2, 0.05, 2.4, C.metal);
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.12, -2.5);
  pivot.add(lid.mesh(dev.mat), lid.lines(dev.lineMat));

  const cv = document.createElement('canvas');
  cv.width = 640; cv.height = 352;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshBasicMaterial({ map: tex });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.15), screenMat);
  screen.rotation.x = Math.PI / 2;
  screen.position.set(0, 0.022, 1.22);
  pivot.add(screen);
  dev.group.add(pivot);

  dev.lid = pivot;
  dev.lidAngle = 0;
  dev.term = { cv, tex, chars: 0, started: -1, total: TERMINAL.reduce((n, [cmd]) => n + cmd.length + 8, 0), drawn: -1 };
  paintTerminal(dev.term, 0, 0);
}

function paintTerminal(term, chars, t) {
  const blink = Math.floor(t * 2) % 2;
  const key = chars * 2 + blink;
  if (key === term.drawn) return;
  term.drawn = key;
  const g = term.cv.getContext('2d');
  g.fillStyle = C.screen; g.fillRect(0, 0, term.cv.width, term.cv.height);
  g.font = '500 26px "IBM Plex Mono", ui-monospace, Consolas, monospace';
  g.textBaseline = 'top';
  let y = 26, left = chars, done = true;
  for (const [cmd, reply] of TERMINAL) {
    if (left <= 0) { done = false; break; }
    const typed = cmd.slice(0, Math.min(left, cmd.length));
    g.fillStyle = C.accent; g.fillText(typed.slice(0, 1), 28, y);
    g.fillStyle = '#f2efe8'; g.fillText(typed.slice(1), 28 + g.measureText('>').width, y);
    left -= cmd.length;
    if (left < 8) {
      if (blink) g.fillRect(28 + g.measureText(typed).width + 4, y + 2, 13, 24);
      done = false; break;
    }
    g.fillStyle = '#9aa39b'; g.fillText(reply, 28, y + 34);
    left -= 8;
    y += 84;
  }
  if (done) {
    g.fillStyle = C.accent; g.fillText('>', 28, y);
    if (blink) { g.fillStyle = '#f2efe8'; g.fillRect(28 + g.measureText('> ').width, y + 2, 13, 24); }
  }
  term.tex.needsUpdate = true;
}

// ---- scene ----
const FOV = 24;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const ease = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    root.classList.add('is-static'); // no WebGL: show the still image instead
    return;
  }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 120);
  const rack = new THREE.Group();
  scene.add(rack);

  const INK = new THREE.Color(C.ink);
  const FADED = new THREE.Color(C.paper).lerp(INK, 0.22);

  // frame
  const frame = new Batch();
  const postX = EAR_W / 2 + 0.13, postZ = RACK_D / 2 - 0.11;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      frame.box(sx * postX, (RACK_H + 0.12) / 2, sz * postZ, 0.22, RACK_H - 0.12, 0.22, C.frame);
      frame.box(sx * 2.4, 0.06, sz * 1.75, 0.34, 0.12, 0.34, C.dark);
    }
    frame.box(sx * 2.33, BASE_Y + (UNITS * U) / 2, FRONT_Z - 0.075, 0.17, UNITS * U, 0.03, C.metal2, false);
    for (const y of [1.6, 4.1, 6.6]) frame.box(sx * postX, y, 0, 0.08, 0.14, RACK_D - 0.44, C.frame);
    frame.box(sx * 2.12, BASE_Y + 11 * U + 0.07, 0.2, 0.08, 0.07, RACK_D - 0.7, C.metal2);
  }
  frame.box(0, RACK_H + 0.07, 0, postX * 2 + 0.22, 0.14, RACK_D, C.frame);
  frame.box(0, 0.22, 0, postX * 2 + 0.22, 0.2, RACK_D, C.frame);
  const frameMat = fillMaterial();
  const frameLineMat = new THREE.LineBasicMaterial({ color: INK, transparent: true });
  rack.add(frame.mesh(frameMat), frame.lines(frameLineMat));

  // floor: raised-floor tiles that fade out, and a hatched shadow
  const floor = [];
  for (let k = -5; k <= 5; k++) floor.push(k * 3, 0, -15, k * 3, 0, 15, -15, 0, k * 3, 15, 0, k * 3);
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(floor, 3));
  const floorMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uColor: { value: new THREE.Vector3(...rgb(C.ink)) }, uOpacity: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying vec2 vP; void main(){ gl_FragColor = vec4(uColor, uOpacity * (1.0 - smoothstep(4.0, 13.0, length(vP)))); }',
  });
  rack.add(new THREE.LineSegments(floorGeo, floorMat));

  const hatch = [];
  const sx0 = postX + 0.11, reach = 3.3, slope = 1.5;
  for (let x = sx0 + 0.12; x < sx0 + reach; x += 0.17) {
    const k = (x - sx0) / reach;
    hatch.push(x, 0.005, -RACK_D / 2 - slope, x, 0.005, RACK_D / 2 - slope * k);
  }
  const hatchGeo = new THREE.BufferGeometry();
  hatchGeo.setAttribute('position', new THREE.Float32BufferAttribute(hatch, 3));
  const hatchMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0 });
  rack.add(new THREE.LineSegments(hatchGeo, hatchMat));

  // dimension lines, like on a drawing
  const dimX = postX + 0.42, dimZ = -RACK_D / 2;
  const yTop = BASE_Y + UNITS * U, wy = RACK_H + 0.75;
  const dims = [
    dimX, BASE_Y, dimZ, dimX, yTop, dimZ,
    dimX - 0.14, BASE_Y, dimZ, dimX + 0.14, BASE_Y, dimZ,
    dimX - 0.14, yTop, dimZ, dimX + 0.14, yTop, dimZ,
    -EAR_W / 2, wy, FRONT_Z, EAR_W / 2, wy, FRONT_Z,
    -EAR_W / 2, wy - 0.14, FRONT_Z, -EAR_W / 2, wy + 0.14, FRONT_Z,
    EAR_W / 2, wy - 0.14, FRONT_Z, EAR_W / 2, wy + 0.14, FRONT_Z,
  ];
  const dimGeo = new THREE.BufferGeometry();
  dimGeo.setAttribute('position', new THREE.Float32BufferAttribute(dims, 3));
  const dimMat = new THREE.LineBasicMaterial({ color: new THREE.Color(C.accent), transparent: true, opacity: 0 });
  rack.add(new THREE.LineSegments(dimGeo, dimMat));
  const dimLabels = [
    { text: `${UNITS}U`, at: new THREE.Vector3(dimX, (BASE_Y + yTop) / 2, dimZ), dx: 12, dy: -8 },
    { text: '19 in', at: new THREE.Vector3(0, wy, FRONT_Z), dx: -18, dy: -24 },
  ].map((d) => {
    const el = document.createElement('span');
    el.className = 'rack__dim';
    el.textContent = d.text;
    labelsEl.append(el);
    return { ...d, el };
  });

  // devices
  const devices = LAYOUT.map((spec, index) => {
    const dev = {
      ...spec, index,
      h: spec.units * U,
      group: new THREE.Group(),
      batch: new Batch(), leds: new Leds(),
      mat: fillMaterial(),
      lineMat: new THREE.LineBasicMaterial({ color: INK.clone(), transparent: true }),
      decals: [],
      out: 0, outTarget: 0, dim: 0, dimTarget: 0, intro: reduceMotion ? 1 : 0,
    };
    dev.group.position.set(0, BASE_Y + (spec.u - 1) * U, FRONT_Z);
    if (spec.id === 'console') buildConsole(dev);
    else build[spec.id](dev.batch, dev.leds, dev);
    dev.group.add(dev.batch.mesh(dev.mat), dev.batch.lines(dev.lineMat));
    if (dev.leds.p.length) dev.group.add(dev.leds.mesh(dev.mat));
    if (dev.cables) for (const g of dev.cables) dev.group.add(new THREE.Mesh(g, dev.mat));

    const depth = spec.id === 'console' ? 2.7 : 1.2;
    dev.hit = new THREE.Mesh(new THREE.BoxGeometry(EAR_W, dev.h, depth), new THREE.MeshBasicMaterial());
    dev.hit.position.set(0, dev.h / 2, -depth / 2 + 0.1);
    dev.hit.visible = false;
    dev.hit.userData.dev = dev;
    dev.group.add(dev.hit);

    dev.anchor = new THREE.Vector3(-EAR_W / 2, dev.h / 2, 0);
    if (spec.name) {
      dev.labelEl = document.createElement('div');
      dev.labelEl.className = 'rack__label';
      const b = document.createElement('b'); b.textContent = spec.name;
      const s = document.createElement('span'); s.textContent = spec.desc;
      dev.labelEl.append(b, s);
      labelsEl.append(dev.labelEl);
      dev.leader = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      leadersEl.append(dev.leader);
    }
    rack.add(dev.group);
    return dev;
  });
  const byId = Object.fromEntries(devices.map((d) => [d.id, d]));
  const hits = devices.map((d) => d.hit);
  const consoleDev = byId.console;

  paintDecals();
  if (document.fonts && document.fonts.load) {
    document.fonts.load('500 26px "IBM Plex Mono"').then(() => { paintDecals(); consoleDev.term.drawn = -1; }).catch(() => {});
  }

  // ---- views: where the camera sits for the hero and for each step ----
  const yOf = (d) => BASE_Y + (d.u - 1) * U + d.h / 2;
  const VIEW = { yaw: -0.5, pitch: 0.2, zoom: 1, focus: new THREE.Vector3(0, RACK_H / 2 + 0.25, 0), side: 1 };
  const cur = { yaw: VIEW.yaw, pitch: VIEW.pitch, zoom: 0.94, focus: VIEW.focus.clone(), side: 1 };
  const target = { ...VIEW, focus: VIEW.focus.clone() };

  let step = null;
  function setStep(name) {
    if (name === step) return;
    step = name;
    const active = devices.filter((d) => d.step && d.step === step);
    for (const d of devices) {
      const on = active.includes(d);
      d.outTarget = on ? d.pull : 0;
      d.dimTarget = active.length && !on ? 0.62 : 0;
    }
    frameDimTarget = active.length ? 0.5 : 0;
    if (!active.length) {
      Object.assign(target, VIEW, { focus: VIEW.focus.clone() });
    } else {
      const y = active.reduce((sum, d) => sum + yOf(d), 0) / active.length;
      const isConsole = step === 'console';
      target.yaw = isConsole ? -0.72 : -0.62;
      target.pitch = isConsole ? 0.46 : 0.3;
      target.zoom = isConsole ? 1.5 : active.some((d) => d.units > 1) || active.length > 1 ? 1.62 : 1.78;
      target.focus.set(0, y + (isConsole ? 0.75 : 0), FRONT_Z + (isConsole ? 1.5 : 0.7));
      target.side = 0.35;
    }
    if (consoleDev.term.started < 0 && step === 'console') consoleDev.term.started = clock;
    root.dataset.mode = active.length ? 'step' : 'hero';
    lastDrag = -10; // let a dragged rack ease back to the new view
    lastActive = clock + 1.5; // a step change keeps full frame rate until the move has settled
  }

  // ---- pointer: hover, drag to turn, click to jump to the matching text ----
  const pointer = new THREE.Vector2(0, 0);
  const ndc = new THREE.Vector2(2, 2);
  const ray = new THREE.Raycaster();
  let hovered = null, dragging = false, dragYaw = 0, dragStartX = 0, dragStartYaw = 0, moved = 0, lastDrag = -10;
  let lastActive = 0; // clock time of the last pointer move or step change
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  root.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (finePointer) pointer.set(ndc.x, ndc.y);
    lastActive = clock;
    if (dragging) {
      moved = Math.max(moved, Math.abs(e.clientX - dragStartX));
      dragYaw = THREE.MathUtils.clamp(dragStartYaw + (e.clientX - dragStartX) * 0.007, -1.5, 1.5);
      lastDrag = clock;
    }
  });
  root.addEventListener('pointerleave', () => { ndc.set(2, 2); pointer.set(0, 0); });
  root.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0; dragStartX = e.clientX; dragStartYaw = dragYaw;
    root.classList.add('is-dragging');
  });
  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('is-dragging');
    if (moved < 6 && hovered && hovered.step) {
      const el = document.querySelector(`[data-step="${hovered.step}"]`);
      if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }
  });
  window.addEventListener('pointercancel', () => { dragging = false; root.classList.remove('is-dragging'); });

  // ---- size ----
  // "wide" means the labels beside the rack are shown (the stylesheet hides them at the same width)
  const wideQuery = window.matchMedia('(min-width: 1001px)');
  let width = 1, height = 1, wide = true;
  let maxDpr = wideQuery.matches ? 2 : 1.5;
  function resize() {
    const r = root.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    wide = wideQuery.matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    leadersEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  new ResizeObserver(resize).observe(root);
  resize();

  // ---- frame loop ----
  let clock = 0, last = 0, running = false, visible = true, started = -1, live = false;
  // Slow devices: if frames stay slow, first render at a lower resolution, then give up and show the still image.
  let slowFrames = 0, slowTime = 0, quality = 2;
  let frameDim = reduceMotion ? 0 : 1, frameDimTarget = 0;
  const v = new THREE.Vector3(), w = new THREE.Vector3(), corner = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  const project = (vec) => {
    vec.project(camera);
    return [(vec.x * 0.5 + 0.5) * width, (-vec.y * 0.5 + 0.5) * height];
  };

  function tick(now) {
    if (!running) return;
    requestAnimationFrame(tick);
    // When nothing is moving except the slow sway and the LEDs, draw every other frame to save battery.
    const calm = started >= 0 && clock - started > 4 && !dragging && clock - lastActive > 1.5;
    if (calm && now - last < 30) return;
    const raw = (now - last) / 1000;
    const dt = Math.min(Math.max(raw, 0), 0.05);
    last = now;
    if (!calm && started >= 0 && clock - started > 1.5 && raw > 0 && raw < 0.5) {
      slowFrames++; slowTime += raw;
      if (slowFrames === 40) {
        if (slowTime / slowFrames > 0.045) {
          quality--;
          if (quality === 1) { maxDpr = 1; resize(); }
          else { running = false; quality = 0; root.classList.remove('is-live'); root.classList.add('is-static'); return; }
        }
        slowFrames = 0; slowTime = 0;
      }
    }
    clock += dt;
    if (started < 0) started = clock;
    const since = clock - started;
    const snap = reduceMotion ? 1000 : 1;

    // view
    const reserve = wide ? (cur.side * 3.4) : 0.4;
    cur.yaw = damp(cur.yaw, target.yaw, 3.2 * snap, dt);
    cur.pitch = damp(cur.pitch, target.pitch, 3.2 * snap, dt);
    cur.zoom = damp(cur.zoom, target.zoom, 3.0 * snap, dt);
    cur.side = damp(cur.side, target.side, 3.0 * snap, dt);
    cur.focus.lerp(target.focus, 1 - Math.exp(-3.2 * snap * dt));
    if (!dragging && clock - lastDrag > 1.6) dragYaw = damp(dragYaw, 0, 1.4, dt);

    const sway = reduceMotion ? 0 : Math.sin(clock * 0.4) * 0.03;
    const yaw = cur.yaw + dragYaw + sway + (reduceMotion ? 0 : pointer.x * 0.1);
    const pitch = cur.pitch + (reduceMotion ? 0 : -pointer.y * 0.04);
    rack.rotation.y = yaw;

    const needH = RACK_H + 2.4, needW = 7.9 + reserve;
    const dist = Math.max(needH / (2 * TAN), needW / (2 * TAN * camera.aspect)) / cur.zoom;
    w.copy(cur.focus).applyAxisAngle(UP, yaw);
    w.x -= (reserve * 0.36) / cur.zoom;
    camera.position.set(w.x, w.y + dist * Math.sin(pitch), w.z + dist * Math.cos(pitch));
    camera.lookAt(w);
    camera.updateMatrixWorld();
    rack.updateMatrixWorld(true);

    // hover
    hovered = null;
    if (finePointer && !dragging && ndc.x <= 1) {
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(hits, false)[0];
      if (hit) hovered = hit.object.userData.dev;
    }
    root.classList.toggle('is-hover', Boolean(hovered && hovered.step));

    // frame and floor fade in first, then the devices slide in from the top down
    frameDim = damp(frameDim, Math.max(frameDimTarget, 1 - ease((since - 0.1) / 0.8)), 6 * snap, dt);
    frameMat.uniforms.uDim.value = frameDim;
    const drawn = reduceMotion ? 1 : ease(since / 0.7);
    frameLineMat.opacity = drawn;
    frameLineMat.color.lerpColors(INK, FADED, Math.min(frameDim * 1.2, 1));
    floorMat.uniforms.uOpacity.value = 0.17 * drawn;
    hatchMat.opacity = 0.34 * (reduceMotion ? 1 : ease((since - 0.9) / 0.8));
    const dimShow = (reduceMotion ? 1 : ease((since - 2.0) / 0.6)) * (step || !wide ? 0 : 1);
    dimMat.opacity = damp(dimMat.opacity, dimShow * 0.9, 8 * snap, dt);

    for (const d of devices) {
      if (d.intro < 1) d.intro = Math.min(1, Math.max(0, (since - 0.5 - d.index * 0.085) / 0.75));
      const k = ease(d.intro);
      const hoverPull = hovered === d && !step && d.step ? 0.32 : 0;
      d.out = damp(d.out, d.outTarget + hoverPull, 5.5 * snap, dt);
      d.dim = damp(d.dim, d.dimTarget, 5.5 * snap, dt);
      d.group.position.z = FRONT_Z + d.out + (1 - k) * 3.4;
      const dim = Math.max(d.dim, 1 - k);
      d.mat.uniforms.uDim.value = dim;
      d.lineMat.opacity = Math.min(1, d.intro * 2.5);
      d.lineMat.color.lerpColors(INK, FADED, Math.min(d.dim * 1.3, 1));
      for (const m of d.decals) m.opacity = 1 - dim;
      d.group.visible = d.intro > 0;
      if (!reduceMotion) d.leds.update(clock);
    }

    // console: lid opens once the drawer is out, then the terminal types
    const open = step === 'console' && consoleDev.out > 2.6;
    consoleDev.lidAngle = damp(consoleDev.lidAngle, open ? -1.67 : 0, 4 * snap, dt);
    consoleDev.lid.rotation.x = consoleDev.lidAngle;
    const term = consoleDev.term;
    if (term.started >= 0) {
      const chars = reduceMotion ? term.total : Math.min(term.total, Math.floor(Math.max(0, clock - term.started - 0.9) * 22));
      paintTerminal(term, chars, clock);
    }

    // labels and leader lines
    if (wide) {
      let edge = Infinity;
      for (const sxx of [-1, 1]) for (const szz of [-1, 1]) {
        corner.set(sxx * (postX + 0.11), RACK_H / 2, szz * RACK_D / 2).applyMatrix4(rack.matrixWorld);
        edge = Math.min(edge, project(corner)[0]);
      }
      const column = Math.max(edge - 26, 150);
      let lastY = -Infinity, flags = 0;
      for (const d of devices) {
        if (!d.labelEl) continue;
        v.copy(d.anchor).applyMatrix4(d.group.matrixWorld);
        const [ax, ay] = project(v);
        const active = step && d.step === step;
        const show = d.intro >= 1 && since > 1.9 && (step ? active : true);
        let lx, ly;
        // in a step, the first flag sits above its device and a second one below, so they never overlap
        const below = step && active && flags++ > 0;
        if (step) { lx = Math.min(Math.max(ax, 10), width - 200); ly = below ? ay + 58 : Math.max(ay - 58, 30); }
        else { lx = column; ly = Math.max(ay, lastY + 36); lastY = ly; }
        d.labelEl.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) translate(${step ? '0' : '-100%'}, -50%)`;
        d.labelEl.classList.toggle('is-step', Boolean(step));
        d.labelEl.classList.toggle('is-on', show);
        d.labelEl.classList.toggle('is-hot', Boolean(active || (hovered === d && !step)));
        d.leader.setAttribute('d', step
          ? `M${ax.toFixed(1)} ${ay.toFixed(1)} L${ax.toFixed(1)} ${(ly + (below ? -20 : 20)).toFixed(1)}`
          : `M${(lx + 6).toFixed(1)} ${ly.toFixed(1)} L${(lx + 16).toFixed(1)} ${ly.toFixed(1)} L${ax.toFixed(1)} ${ay.toFixed(1)}`);
        d.leader.classList.toggle('is-on', show);
        d.leader.classList.toggle('is-hot', Boolean(active || (hovered === d && !step)));
      }
      for (const d of dimLabels) {
        v.copy(d.at).applyMatrix4(rack.matrixWorld);
        const [x, y] = project(v);
        d.el.style.transform = `translate(${(x + d.dx).toFixed(1)}px, ${(y + d.dy).toFixed(1)}px)`;
        d.el.classList.toggle('is-on', dimShow > 0.5);
      }
    }

    renderer.render(scene, camera);
    if (!live) { live = true; root.classList.remove('is-static'); root.classList.add('is-live'); }
  }

  function setRunning() {
    const should = visible && !document.hidden && quality > 0;
    if (should === running) return;
    running = should;
    if (running) { last = performance.now(); requestAnimationFrame(tick); }
  }
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; setRunning(); }, { rootMargin: '80px' }).observe(root);
  document.addEventListener('visibilitychange', setRunning);

  window.addEventListener('rack:step', (e) => setStep(e.detail || null));
  setStep(document.documentElement.dataset.rackStep || null);
  setRunning();
}

if (root && canvas) init();
