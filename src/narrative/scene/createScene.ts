/*
 * "From Nature to Signature": the continuous Three.js scene.
 *
 * One renderer, one perspective scene (vessel, ingredients, accord, bottle)
 * and one screen-space overlay (mist particles that become the bookend
 * heading's letters). Everything is driven by a single sequence value t from
 * native scroll. Procedural lighting only (RoomEnvironment); no downloaded
 * assets. The loop runs only while the stage is on screen and the tab visible.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { GLYPH_PATHS } from '../../components/NoteGlyph';
import { SPRIG_STROKES } from '../../components/Botanical';
import { PALETTES, paletteFor } from '../../lib/palettes';
import { sceneParams, type SceneParams } from '../timeline';
import type { SceneController, SceneOptions } from './types';

const PARCHMENT = 0xf1ede6;
const GOLD_TEXT = 0x7a5a22;
const FAMILY_ORDER = ['Fresh', 'Warm', 'Woody', 'Aquatic', 'Sweet', 'Floral'];
const MAX_DPR = 1.75;
const SLOW_FRAME_MS = 24;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ── Artwork helpers ──────────────────────────────────────────────────── */

/** Thin gold lines from an SVG path string, centred and scaled to `size` world units. */
function lineArt(paths: string[], viewBox: number, size: number, material: THREE.LineBasicMaterial): THREE.Group {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox} ${viewBox}">${paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
  const data = new SVGLoader().parse(svg);
  const group = new THREE.Group();
  const s = size / viewBox;
  for (const p of data.paths) {
    for (const sub of p.subPaths) {
      const pts = sub.getPoints(24).map((v) => new THREE.Vector3((v.x - viewBox / 2) * s, -(v.y - viewBox / 2) * s, 0));
      if (pts.length > 1) group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material));
    }
  }
  return group;
}

/** Erlenmeyer profile (the flask of the seal) for LatheGeometry. */
function flaskProfile(scale = 1): THREE.Vector2[] {
  const pts: Array<[number, number]> = [
    [0, 0],
    [1.32, 0],
    [1.42, 0.08],
    [1.44, 0.22],
    [0.42, 2.25],
    [0.32, 2.45],
    [0.32, 3.05],
    [0.4, 3.12],
    [0.4, 3.22],
  ];
  return pts.map(([r, y]) => new THREE.Vector2(r * scale, y * scale));
}

function liquidProfile(): THREE.Vector2[] {
  return [
    [0, 0.04],
    [1.26, 0.04],
    [1.36, 0.12],
    [1.37, 0.24],
    [0.9, 1.18],
    [0, 1.18],
  ].map(([r, y]) => new THREE.Vector2(r!, y!));
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Generic house label: no product names, no claims. */
function labelTexture() {
  return canvasTexture(512, 368, (ctx) => {
    ctx.fillStyle = '#f2e8d5';
    ctx.fillRect(0, 0, 512, 368);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7a5a22';
    ctx.font = '500 26px Jost, sans-serif';
    ctx.fillText('M A K E   M Y   P E R F U M E', 256, 92);
    ctx.fillStyle = '#1a1612';
    ctx.font = 'italic 500 84px "Cormorant Garamond", serif';
    ctx.fillText('Signature', 256, 196);
    ctx.fillStyle = '#c99a4b';
    ctx.fillRect(216, 228, 80, 3);
  });
}

function knurlTexture() {
  const t = canvasTexture(256, 64, (ctx) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 64);
    for (let x = 0; x < 256; x += 4) {
      ctx.fillStyle = x % 8 === 0 ? '#ffffff' : '#202020';
      ctx.fillRect(x, 0, 2, 64);
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(4, 1);
  return t;
}

function glowTexture() {
  return canvasTexture(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
}

/* ── Particles: mist that becomes letters ─────────────────────────────── */

const PARTICLES = 2600;

const particleVertex = /* glsl */ `
  attribute float aSeed;
  attribute vec2 aSpray;
  attribute vec2 aTarget;
  uniform vec2 uNozzle;
  uniform vec2 uTargetOrigin;
  uniform float uDrift;
  uniform float uForm;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vSeed;
  varying float vForm;
  void main() {
    float wob = (1.0 - uForm);
    vec2 spray = uNozzle + aSpray * (0.12 + 0.88 * uDrift)
      + vec2(sin(uTime * 0.7 + aSeed * 40.0), cos(uTime * 0.5 + aSeed * 23.0)) * 10.0 * uDrift * wob;
    float f = smoothstep(aSeed * 0.35, aSeed * 0.35 + 0.65, uForm);
    vec2 p = mix(spray, uTargetOrigin + aTarget, f);
    vSeed = aSeed;
    vForm = f;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, -p.y, 0.0, 1.0);
    gl_PointSize = (1.4 + aSeed * 2.4) * mix(1.0, 0.75, f) * uPixelRatio;
  }
`;

const particleFragment = /* glsl */ `
  uniform float uAmount;
  uniform float uHandoff;
  uniform vec3 uMist;
  uniform vec3 uInk;
  varying float vSeed;
  varying float vForm;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.15, d) * uAmount * (1.0 - uHandoff) * mix(0.35 + 0.5 * vSeed, 0.95, vForm);
    gl_FragColor = vec4(mix(uMist, uInk, vForm), a);
  }
`;

interface Line {
  text: string;
  font: string;
  rect: DOMRect;
}

/** Sample filled pixels of the heading's lines into targets relative to its top-left. */
function sampleHeading(heading: HTMLElement, count: number): Float32Array {
  const box = heading.getBoundingClientRect();
  const lines: Line[] = [...heading.children].map((el) => {
    const cs = getComputedStyle(el);
    const text = cs.textTransform === 'uppercase' ? (el.textContent ?? '').toUpperCase() : (el.textContent ?? '');
    return { text, font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, rect: el.getBoundingClientRect() };
  });
  const w = Math.max(1, Math.ceil(box.width));
  const h = Math.max(1, Math.ceil(box.height));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const l of lines) {
    ctx.font = l.font;
    ctx.fillText(l.text.trim(), l.rect.left - box.left + l.rect.width / 2, l.rect.top - box.top + l.rect.height / 2);
  }
  const data = ctx.getImageData(0, 0, w, h).data;
  const hits: number[] = [];
  const step = Math.max(1, Math.round(Math.sqrt((w * h) / (count * 6))));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3]! > 128) hits.push(x, y);
  }
  const out = new Float32Array(count * 2);
  const n = hits.length / 2;
  for (let i = 0; i < count; i++) {
    const k = n ? ((i * 7919) % n) : 0;
    out[i * 2] = n ? hits[k * 2]! + (Math.random() - 0.5) * step : w / 2;
    out[i * 2 + 1] = n ? hits[k * 2 + 1]! + (Math.random() - 0.5) * step : h / 2;
  }
  return out;
}

/* ── The scene ────────────────────────────────────────────────────────── */

export function createScene({ canvas, width, height, onReady, onFailure }: SceneOptions): SceneController {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.setSize(width, height, false);
  renderer.setClearColor(PARCHMENT, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.localClippingEnabled = true;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;

  // One warm key from the upper left, a cool fill, as in the posters.
  const key = new THREE.DirectionalLight(0xffe4bd, 2.2);
  key.position.set(-5, 7, 6);
  const fill = new THREE.DirectionalLight(0xdbe4ff, 0.5);
  fill.position.set(6, 2, 4);
  scene.add(key, fill, new THREE.AmbientLight(0xffffff, 0.25));

  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
  const camFar = new THREE.Vector3(0, 0.9, 13.5);
  const camNear = new THREE.Vector3(-1.2, 2.6, 7.2);
  const lookFar = new THREE.Vector3(0, 0.6, 0);
  const lookNear = new THREE.Vector3(0, 2.3, 0);

  /* Contact shadow on the ground. */
  const shadowTex = canvasTexture(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(60,45,25,0.35)');
    g.addColorStop(1, 'rgba(60,45,25,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.69;
  scene.add(shadow);

  /* ── Vessel: glass flask with liquid ─── */
  const flask = new THREE.Group();
  flask.position.y = -1.7;
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    roughness: 0.06,
    thickness: 0.35,
    ior: 1.45,
    transparent: true,
    side: THREE.DoubleSide,
    envMapIntensity: 1.2,
  });
  const glass = new THREE.Mesh(new THREE.LatheGeometry(flaskProfile(), 96), glassMat);
  const [wGlow, wMid, wDeep] = paletteFor('Warm');
  const liquidMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(wMid), roughness: 0.2, transparent: false, sheen: 0.4, sheenColor: new THREE.Color(wGlow), attenuationColor: new THREE.Color(wDeep), attenuationDistance: 1.2 });
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(liquidProfile(), 96), liquidMat);
  flask.add(glass, liquid);
  scene.add(flask);

  /* ── Ingredients: the brand's own line art, drifting into the neck ─── */
  const lineMat = new THREE.LineBasicMaterial({ color: GOLD_TEXT, transparent: true, opacity: 1 });
  const ingredientSpots: Array<{ family: string; pos: THREE.Vector3; size: number; spin: number }> = [
    { family: 'Fresh', pos: new THREE.Vector3(-2.7, 1.2, 0.6), size: 0.95, spin: 0.25 },
    { family: 'Woody', pos: new THREE.Vector3(2.4, 2.2, -0.8), size: 0.8, spin: -0.2 },
    { family: 'Floral', pos: new THREE.Vector3(2.6, -0.2, 0.9), size: 1.0, spin: 0.18 },
    { family: 'Sweet', pos: new THREE.Vector3(-2.3, -0.9, -0.6), size: 0.75, spin: -0.22 },
    { family: 'Aquatic', pos: new THREE.Vector3(1.5, -1.3, 1.4), size: 0.7, spin: 0.3 },
  ];
  const ingredients = ingredientSpots.map((s) => {
    const g = lineArt([GLYPH_PATHS[s.family]!], 24, s.size * 1.45, lineMat);
    scene.add(g);
    return { ...s, group: g };
  });
  const sprig = lineArt(SPRIG_STROKES, 260, 2.6, lineMat);
  sprig.position.set(-2.0, 1.6, 0.4);
  sprig.rotation.z = -0.15;
  scene.add(sprig);
  const neck = new THREE.Vector3(0, 1.45, 0);

  /* ── Accord: a suspended body of liquid in the family colours ─── */
  const accordGeo = new THREE.IcosahedronGeometry(1.0, 20);
  const accordBase = Float32Array.from(accordGeo.attributes.position!.array as Float32Array);
  const accordMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(wMid), roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06, transmission: 0.2, thickness: 1.5, transparent: true });
  const accord = new THREE.Mesh(accordGeo, accordMat);
  // Hangs above the flask's neck, as if drawn up out of it.
  accord.position.y = 2.25;
  scene.add(accord);

  /* ── The house bottle: stylised, generic lettering ─── */
  const bottle = new THREE.Group();
  bottle.position.y = -1.7;
  const buildPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const clip = [buildPlane];
  const matte = new THREE.MeshPhysicalMaterial({ color: 0x080706, roughness: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.6, envMapIntensity: 0.45, clippingPlanes: clip, transparent: true });
  const body = new THREE.Mesh(new RoundedBoxGeometry(2.0, 2.5, 1.05, 6, 0.2), matte);
  body.position.y = 1.25;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.94), new THREE.MeshBasicMaterial({ map: labelTexture(), toneMapped: false, clippingPlanes: clip, transparent: true }));
  label.position.set(0, 1.3, 0.531);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 48), new THREE.MeshPhysicalMaterial({ color: 0x1d1915, roughness: 0.35, metalness: 0.4, clippingPlanes: clip, transparent: true }));
  collar.position.y = 2.62;
  const atomizer = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0xcfc4b3, metalness: 0.8, roughness: 0.3 }));
  stem.position.y = 2.82;
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 40), new THREE.MeshPhysicalMaterial({ color: 0x0a0908, roughness: 0.45, clearcoat: 0.4, envMapIntensity: 0.5 }));
  nozzle.position.y = 3.04;
  atomizer.add(stem, nozzle);
  const nozzleTip = new THREE.Vector3(-0.21, 3.06, 0);
  const capPivot = new THREE.Group();
  const knurl = knurlTexture();
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.62, 64), new THREE.MeshPhysicalMaterial({ color: 0x0a0908, roughness: 0.5, metalness: 0.15, envMapIntensity: 0.5, bumpMap: knurl, bumpScale: 2.5, transparent: true }));
  capPivot.position.y = 3.05;
  capPivot.add(cap);
  bottle.add(body, label, collar, atomizer, capPivot);
  scene.add(bottle);

  // Family light: a coloured glow behind and a coloured rim light.
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(wMid), transparent: true, depthWrite: false, opacity: 0 }));
  glow.position.set(0, 0.2, -2.5);
  scene.add(glow);
  const rim = new THREE.PointLight(new THREE.Color(wMid), 0, 12, 1.4);
  rim.position.set(2.6, 1.6, -2.2);
  scene.add(rim);

  /* ── Overlay: particles in screen pixels ─── */
  const overlay = new THREE.Scene();
  const ortho = new THREE.OrthographicCamera(0, width, 0, -height, -10, 10);
  const pGeo = new THREE.BufferGeometry();
  const seeds = new Float32Array(PARTICLES);
  const spray = new Float32Array(PARTICLES * 2);
  for (let i = 0; i < PARTICLES; i++) {
    seeds[i] = Math.random();
    const a = Math.PI + (Math.random() + Math.random() - 1) * 0.32;
    const dist = 40 + Math.pow(Math.random(), 0.7) * 520;
    spray[i * 2] = Math.cos(a) * dist;
    spray[i * 2 + 1] = Math.sin(a) * dist * 0.75 - dist * 0.08;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLES * 3), 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  pGeo.setAttribute('aSpray', new THREE.BufferAttribute(spray, 2));
  pGeo.setAttribute('aTarget', new THREE.BufferAttribute(new Float32Array(PARTICLES * 2), 2));
  const uniforms = {
    uNozzle: { value: new THREE.Vector2() },
    uTargetOrigin: { value: new THREE.Vector2() },
    uDrift: { value: 0 },
    uForm: { value: 0 },
    uTime: { value: 0 },
    uAmount: { value: 0 },
    uHandoff: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uMist: { value: new THREE.Color(0xb98a3e) },
    uInk: { value: new THREE.Color(0x1a1612) },
  };
  const points = new THREE.Points(
    pGeo,
    new THREE.ShaderMaterial({ uniforms, vertexShader: particleVertex, fragmentShader: particleFragment, transparent: true, depthTest: false, depthWrite: false }),
  );
  points.frustumCulled = false;
  overlay.add(points);

  /* ── State ─── */
  let w = width;
  let h = height;
  let t = 0;
  let params: SceneParams = sceneParams(0);
  let preview: string | null = null;
  let accentFamily = 'Warm';
  const accordColor = new THREE.Color(wMid);
  const accentColor = new THREE.Color(wMid);
  const tmpColor = new THREE.Color();
  let heading: HTMLElement | null = null;
  let targetsReady = false;
  let active = false;
  let frame = 0;
  let disposed = false;
  let readySent = false;
  let last = performance.now();
  let elapsed = 0;
  const frameTimes: number[] = [];
  const v = new THREE.Vector3();

  function familyMixColor(mix: number, out: THREE.Color) {
    const x = mix * (FAMILY_ORDER.length - 1);
    const i = Math.min(FAMILY_ORDER.length - 2, Math.floor(x));
    const a = PALETTES[FAMILY_ORDER[i]!]![1];
    const b = PALETTES[FAMILY_ORDER[i + 1]!]![1];
    return out.set(a).lerp(tmpColor.set(b), x - i);
  }

  function computeTargets() {
    if (!heading) return;
    (pGeo.attributes.aTarget as THREE.BufferAttribute).set(sampleHeading(heading, PARTICLES));
    pGeo.attributes.aTarget!.needsUpdate = true;
    targetsReady = true;
  }

  function layout() {
    camera.aspect = w / h;
    // Content holds the left of the page; the scene sits to the right until the bookend centres it.
    const shift = -w * 0.2 * (1 - params.camera.centre);
    camera.setViewOffset(w, h, shift, 0, w, h);
    camera.updateProjectionMatrix();
    ortho.right = w;
    ortho.bottom = -h;
    ortho.updateProjectionMatrix();
  }

  function update(dt: number, time: number) {
    const p = params;

    // Camera: establishing frame, close to the shoulder for the ritual, then back.
    camera.position.lerpVectors(camFar, camNear, p.camera.closeUp);
    v.lerpVectors(lookFar, lookNear, p.camera.closeUp);
    camera.lookAt(v);
    layout();

    // Vessel
    flask.visible = p.flask.visible > 0.01;
    flask.scale.setScalar(0.85 + 0.15 * p.flask.visible);
    glassMat.opacity = p.flask.visible;
    // Opaque while fully shown, so the glass's transmission pass can see it.
    liquidMat.transparent = p.flask.visible < 0.999;
    liquidMat.opacity = p.flask.visible;
    liquid.scale.set(1, Math.max(0.001, 0.15 + 0.85 * p.flask.fill), 1);
    flask.rotation.y = time * 0.08;

    // Ingredients spiral into the neck as they gather.
    const gather = 1 - p.ingredients.spread;
    lineMat.opacity = p.ingredients.visible;
    for (const ing of ingredients) {
      ing.group.visible = p.ingredients.visible > 0.01;
      ing.group.position.lerpVectors(ing.pos, neck, gather);
      ing.group.position.y += Math.sin(time * 0.6 + ing.size * 9) * 0.06 * p.ingredients.spread;
      ing.group.rotation.z = ing.spin * time + gather * 2.2;
      ing.group.scale.setScalar(lerp(1, 0.08, gather));
    }
    sprig.visible = p.ingredients.visible > 0.01;
    sprig.position.set(lerp(-2.0, 0, gather), lerp(1.6, 1.45, gather), lerp(0.4, 0, gather));
    sprig.scale.setScalar(lerp(1, 0.05, gather));

    // Accord: wobbling liquid, colour through the families or the previewed one.
    accord.visible = p.accord.visible > 0.01;
    if (accord.visible) {
      const target = preview ? tmpColor.set(paletteFor(preview)[1]) : familyMixColor(p.accord.familyMix, tmpColor);
      accordColor.lerp(target, Math.min(1, dt * 4));
      accordMat.color.copy(accordColor);
      accordMat.opacity = p.accord.visible;
      accord.scale.setScalar(0.6 + 0.4 * p.accord.visible);
      accord.rotation.y = time * 0.25;
      const pos = accordGeo.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = accordBase[i]!;
        const y = accordBase[i + 1]!;
        const z = accordBase[i + 2]!;
        const n = 1 + 0.06 * Math.sin(x * 2.6 + time * 1.3) * Math.cos(y * 2.2 + time * 0.9) + 0.03 * Math.sin(z * 3.1 + time * 1.7);
        arr[i] = x * n;
        arr[i + 1] = y * n;
        arr[i + 2] = z * n;
      }
      pos.needsUpdate = true;
      accordGeo.computeVertexNormals();
    }

    // Bottle: built from the base, capped, turned, then uncapped for the ritual.
    bottle.visible = p.bottle.visible > 0.01;
    const fade = p.bottle.visible;
    matte.opacity = fade;
    (label.material as THREE.MeshBasicMaterial).opacity = fade;
    (collar.material as THREE.MeshPhysicalMaterial).opacity = fade;
    buildPlane.constant = -1.7 + p.bottle.build * 2.8 + 0.001;
    atomizer.visible = p.bottle.build > 0.98 && bottle.visible;
    capPivot.visible = p.bottle.capOn > 0.01 && p.bottle.capLift < 0.99 && bottle.visible;
    capPivot.position.set(p.bottle.capLift * 1.4, 3.05 + (1 - p.bottle.capOn) * 2.2 + p.bottle.capLift * 1.6, 0);
    capPivot.rotation.set(0, (1 - p.bottle.capOn) * Math.PI * 1.5, -p.bottle.capLift * 0.6);
    (cap.material as THREE.MeshPhysicalMaterial).opacity = (1 - p.bottle.capLift) * fade;
    bottle.rotation.y = p.bottle.rotation;
    bottle.scale.setScalar(0.92 + 0.08 * fade);

    // Family light behind the bottle (the card at the centre of the screen).
    accentColor.lerp(tmpColor.set(paletteFor(accentFamily)[1]), Math.min(1, dt * 3));
    (glow.material as THREE.MeshBasicMaterial).color.copy(accentColor);
    (glow.material as THREE.MeshBasicMaterial).opacity = 0.55 * fade * (1 - p.camera.closeUp * 0.6);
    rim.color.copy(accentColor);
    rim.intensity = 18 * fade;
    shadow.scale.x = bottle.visible ? 0.9 : 1.2;
    // The ground shadow belongs to whatever stands on it; none, no shadow.
    (shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(p.flask.visible, p.bottle.visible);
    shadow.visible = (shadow.material as THREE.MeshBasicMaterial).opacity > 0.01;

    // Mist from the nozzle, then letters.
    bottle.updateMatrixWorld();
    v.copy(nozzleTip).applyMatrix4(bottle.matrixWorld).project(camera);
    const nx = (v.x * 0.5 + 0.5) * w;
    const ny = (1 - (v.y * 0.5 + 0.5)) * h;
    if (p.type.formation < 0.02) uniforms.uNozzle.value.set(nx, ny);
    if (heading) {
      if (!targetsReady) computeTargets();
      const r = heading.getBoundingClientRect();
      uniforms.uTargetOrigin.value.set(r.left, r.top);
      heading.style.opacity = String(p.type.handoff);
    }
    uniforms.uDrift.value = p.mist.drift;
    uniforms.uForm.value = heading ? p.type.formation : 0;
    uniforms.uAmount.value = p.mist.amount;
    uniforms.uHandoff.value = p.type.handoff;
    uniforms.uTime.value = time;
    points.visible = p.mist.amount > 0.01 && p.type.handoff < 0.99;
  }

  function render() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    update(dt, elapsed);
    renderer.clear();
    renderer.render(scene, camera);
    if (points.visible) {
      renderer.clearDepth();
      renderer.render(overlay, ortho);
    }
    if (!readySent) {
      readySent = true;
      onReady();
    }
    // Slow-device guard over the first 90 frames.
    if (frameTimes.length < 90) {
      frameTimes.push(performance.now() - now);
      if (frameTimes.length === 90) {
        const sorted = [...frameTimes].sort((a, b) => a - b);
        if (sorted[Math.floor(sorted.length / 2)]! > SLOW_FRAME_MS) onFailure('too-slow');
      }
    }
  }

  function loop() {
    frame = 0;
    if (!active || disposed) return;
    render();
    frame = requestAnimationFrame(loop);
  }

  const onLost = (e: Event) => {
    e.preventDefault();
    onFailure('context-lost');
  };
  canvas.addEventListener('webglcontextlost', onLost);

  layout();
  // Fonts drawn into the label and sampled for the letters must be loaded first.
  document.fonts?.ready.then(() => {
    if (disposed) return;
    (label.material as THREE.MeshBasicMaterial).map = labelTexture();
    (label.material as THREE.MeshBasicMaterial).needsUpdate = true;
    targetsReady = false;
  });
  render();

  return {
    setProgress(next) {
      t = next;
      params = sceneParams(t);
      if (!active && !disposed) render();
    },
    previewFamily(f) {
      preview = f;
    },
    setAccentFamily(f) {
      accentFamily = f;
    },
    setTypeTarget(el) {
      if (heading && heading !== el) heading.style.removeProperty('opacity');
      heading = el;
      targetsReady = false;
    },
    resize(nw, nh) {
      w = nw;
      h = nh;
      renderer.setSize(w, h, false);
      uniforms.uPixelRatio.value = renderer.getPixelRatio();
      targetsReady = false;
      layout();
      if (!active) render();
    },
    setActive(next) {
      if (active === next) return;
      active = next;
      if (active && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    },
    dispose() {
      disposed = true;
      active = false;
      if (frame) cancelAnimationFrame(frame);
      canvas.removeEventListener('webglcontextlost', onLost);
      heading?.style.removeProperty('opacity');
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mat of mats) {
          for (const val of Object.values(mat)) if (val instanceof THREE.Texture) val.dispose();
          mat.dispose();
        }
      });
      pGeo.dispose();
      (points.material as THREE.Material).dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
