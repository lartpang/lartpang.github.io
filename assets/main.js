/* Youwei Pang — site behaviour, shared by all four pages. Content lives in data.js (SITE_DATA). */

const $ = id => document.getElementById(id);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Number(n).toLocaleString('en');
const page = document.body.dataset.page;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ===================== palette of the week =====================
   data.js carries three tones built from one hue; each page picks its own
   (<html data-tone>). The last palette is remembered so the next visit paints
   in the right colours before data.js arrives. */
const CACHE = 'yp-theme';
function applyTheme(theme) {
  if (!theme?.tones) return;
  const tone = theme.tones[document.documentElement.dataset.tone] || theme.tones.paper;
  for (const [k, v] of Object.entries(tone)) document.documentElement.style.setProperty('--' + k, v);
  try { localStorage.setItem(CACHE, JSON.stringify({ seed: theme.seed, week: theme.week, tones: theme.tones })); } catch { }
}
const cachedTheme = (() => { try { return JSON.parse(localStorage.getItem(CACHE)); } catch { return null; } })();

/* ===================== About: geometric artwork =====================
   Streamlines of a smooth field cross a dot lattice, measured by one orbit and
   one ruled line — structure, logic and measurement, drawn from the week's seed. */
function hash2(x, y, s) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct, s) {
  let sum = 0, amp = .5, norm = 0;
  for (let i = 0; i < oct; i++) { sum += amp * vnoise(x, y, s + i * 17); norm += amp; x *= 2.03; y *= 2.03; amp *= .5; }
  return sum / norm;
}

let drawnSeed = null;
function drawArt(seed) {
  const host = $('art');
  if (!host || seed == null || seed === drawnSeed) return;
  drawnSeed = seed;
  const W = 600, H = 750, r = rng(seed), s = seed % 997;
  const base = r() * Math.PI * 2, swirl = 1.4 + r() * 1.6, scale = 220 + r() * 160;
  const out = [];
  const anim = (i, kind = 'draw') => RM ? '' : ` class="${kind}" style="animation-delay:${Math.min(1800, i * 9)}ms"`;

  // lattice
  for (let y = 30; y < H; y += 30) for (let x = 30; x < W; x += 30)
    out.push(`<circle cx="${x}" cy="${y}" r="1.1" fill="var(--faint)" opacity=".38"/>`);

  // streamlines
  const field = (x, y) => base + (fbm(x / scale, y / scale, 3, s) - .5) * Math.PI * 2 * swirl;
  for (let i = 0; i < 190; i++) {
    let x = r() * W, y = r() * H;
    const pts = [[x, y]];
    for (let k = 0; k < 90; k++) {
      const a = field(x, y);
      x += Math.cos(a) * 5; y += Math.sin(a) * 5;
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) break;
      pts.push([x, y]);
    }
    if (pts.length < 12) continue;
    const d = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
    const accent = r() < .07;
    out.push(`<path d="${d}" pathLength="1" fill="none" stroke="var(${accent ? '--accent' : '--line'})" stroke-width="${accent ? 1.6 : (.6 + r() * .7).toFixed(2)}" stroke-linecap="round" opacity="${accent ? .95 : (.22 + r() * .45).toFixed(2)}"${anim(i)}/>`);
  }

  // one orbit with a body on it, and one measured line through the centre
  const cx = W * (.42 + r() * .16), cy = H * (.38 + r() * .2), R = W * (.24 + r() * .1), t = r() * Math.PI * 2;
  out.push(`<circle cx="${cx}" cy="${cy}" r="${R}" pathLength="1" fill="none" stroke="var(--ink)" stroke-width="1.1"${anim(40)}/>`);
  out.push(`<circle cx="${cx + Math.cos(t) * R}" cy="${cy + Math.sin(t) * R}" r="${9 + r() * 6}" fill="var(--accent)"${anim(150, 'pop')}/>`);
  const ang = base + Math.PI / 2, L = R * 1.9, ux = Math.cos(ang), uy = Math.sin(ang);
  out.push(`<line x1="${cx - ux * L}" y1="${cy - uy * L}" x2="${cx + ux * L}" y2="${cy + uy * L}" pathLength="1" stroke="var(--ink)" stroke-width=".9"${anim(60)}/>`);
  for (let k = -10; k <= 10; k++) {
    const px = cx + ux * k * L / 10, py = cy + uy * k * L / 10, tl = k % 5 ? 5 : 11;
    out.push(`<line x1="${px - uy * tl}" y1="${py + ux * tl}" x2="${px + uy * tl}" y2="${py - ux * tl}" stroke="var(--ink)" stroke-width=".9"${anim(70 + k + 10, 'pop')}/>`);
  }
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${out.join('')}</svg>`;
}

/* ===================== card covers =====================
   A card shows its project's own image when one is given; otherwise a small
   geometric drawing seeded by the project's name, so no two covers repeat. The
   six families share the About artwork's vocabulary and the week's palette. */
function hashStr(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const TAU = Math.PI * 2;
const f1 = n => n.toFixed(1);
// `family` (0–5) picks the drawing style explicitly; by default the name decides it
function cover(key, family) {
  const seed = hashStr(key), r = rng(seed), W = 400, H = 220, out = [];
  const stroke = (c, w, o) => `fill="none" stroke="var(--${c})" stroke-width="${f1(w)}" opacity="${o.toFixed(2)}" stroke-linecap="round"`;
  const pick = () => r() < .09 ? 'accent' : 'line';
  switch (family ?? seed % 6) {
    case 0: {   // streamlines of a smooth field
      const base = r() * TAU, sc = 80 + r() * 90, swirl = 1 + r() * 1.8, s = seed % 997;
      for (let i = 0; i < 54; i++) {
        let x = r() * W, y = r() * H; const pts = [[x, y]];
        for (let k = 0; k < 46; k++) {
          const a = base + (fbm(x / sc, y / sc, 3, s) - .5) * TAU * swirl;
          x += Math.cos(a) * 4; y += Math.sin(a) * 4;
          if (x < -10 || x > W + 10 || y < -10 || y > H + 10) break;
          pts.push([x, y]);
        }
        if (pts.length < 8) continue;
        const c = pick();
        out.push(`<path d="M${pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L')}" ${stroke(c, c === 'accent' ? 1.6 : .7 + r() * .6, c === 'accent' ? .9 : .25 + r() * .45)}/>`);
      }
      break;
    }
    case 1: {   // nested orbits, one body, one measured chord
      const cx = W * (.3 + r() * .4), cy = H * (.35 + r() * .3), n = 4 + (r() * 4 | 0);
      for (let i = 1; i <= n; i++) {
        const R = 16 + i * (14 + r() * 10), dx = (r() - .5) * 18, dy = (r() - .5) * 12;
        out.push(`<circle cx="${f1(cx + dx)}" cy="${f1(cy + dy)}" r="${f1(R)}" ${stroke(i === n ? 'ink' : 'line', i === n ? 1 : .8, .35 + r() * .4)}/>`);
        if (r() < .5) { const t = r() * TAU; out.push(`<circle cx="${f1(cx + dx + Math.cos(t) * R)}" cy="${f1(cy + dy + Math.sin(t) * R)}" r="2.2" fill="var(--line)"/>`); }
      }
      const t = r() * TAU, R = 30 + r() * 40;
      out.push(`<circle cx="${f1(cx + Math.cos(t) * R)}" cy="${f1(cy + Math.sin(t) * R)}" r="${f1(5 + r() * 4)}" fill="var(--accent)"/>`);
      const a = r() * Math.PI, L = 150;
      out.push(`<line x1="${f1(cx - Math.cos(a) * L)}" y1="${f1(cy - Math.sin(a) * L)}" x2="${f1(cx + Math.cos(a) * L)}" y2="${f1(cy + Math.sin(a) * L)}" ${stroke('ink', .8, .7)}/>`);
      break;
    }
    case 2: {   // a lattice whose neighbours are sometimes wired together
      const step = 26 + (r() * 10 | 0), nodes = [];
      for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step)
        nodes.push([x + (r() - .5) * step * .35, y + (r() - .5) * step * .35]);
      const cols = Math.ceil((W - step / 2) / step), p = .3 + r() * .35;
      nodes.forEach(([x, y], i) => {
        const right = nodes[i + 1], down = nodes[i + cols];
        if (right && (i + 1) % cols && r() < p) out.push(`<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(right[0])}" y2="${f1(right[1])}" ${stroke(pick(), .9, .55)}/>`);
        if (down && r() < p) out.push(`<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(down[0])}" y2="${f1(down[1])}" ${stroke(pick(), .9, .55)}/>`);
      });
      nodes.forEach(([x, y]) => { const big = r() < .06; out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${big ? 4.5 : 1.6}" fill="var(--${big ? 'accent' : 'ink'})" opacity="${big ? 1 : .55}"/>`); });
      break;
    }
    case 3: {   // contour lines over a quiet terrain
      const n = 14 + (r() * 8 | 0), s = seed % 991, amp = 30 + r() * 50, sc = 90 + r() * 80;
      for (let i = 0; i < n; i++) {
        const y0 = (i + .5) * H / n, pts = [];
        for (let x = -8; x <= W + 8; x += 8) pts.push([x, y0 + (fbm(x / sc, i * .12, 3, s) - .5) * amp]);
        out.push(`<path d="M${pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L')}" ${stroke(r() < .08 ? 'accent' : 'line', .9, .3 + r() * .5)}/>`);
      }
      break;
    }
    case 4: {   // Truchet tiles of quarter arcs
      const c = 22 + (r() * 12 | 0), h = c / 2;
      for (let y = 0; y < H; y += c) for (let x = 0; x < W; x += c) {
        const d = r() < .5
          ? `M${x + h} ${y}A${h} ${h} 0 0 1 ${x} ${y + h}M${x + c} ${y + h}A${h} ${h} 0 0 0 ${x + h} ${y + c}`
          : `M${x + h} ${y}A${h} ${h} 0 0 0 ${x + c} ${y + h}M${x} ${y + h}A${h} ${h} 0 0 1 ${x + h} ${y + c}`;
        const col = pick();
        out.push(`<path d="${d}" ${stroke(col, col === 'accent' ? 1.6 : 1, col === 'accent' ? .9 : .35 + r() * .35)}/>`);
      }
      break;
    }
    default: {  // rays from an off-frame origin, crossed by rings
      const ox = r() < .5 ? -40 : W + 40, oy = H * r(), n = 30 + (r() * 16 | 0);
      const dir = ox < 0 ? 0 : Math.PI, spread = .7 + r() * .5;
      for (let i = 0; i < n; i++) {
        const a = dir + (i / (n - 1) - .5) * spread * Math.PI, L = 180 + r() * 300, col = pick();
        out.push(`<line x1="${ox}" y1="${f1(oy)}" x2="${f1(ox + Math.cos(a) * L)}" y2="${f1(oy + Math.sin(a) * L)}" ${stroke(col, col === 'accent' ? 1.5 : .7, col === 'accent' ? .9 : .25 + r() * .4)}/>`);
      }
      for (let k = 1; k <= 3; k++) out.push(`<circle cx="${ox}" cy="${f1(oy)}" r="${f1(90 + k * (60 + r() * 30))}" ${stroke('ink', .8, .45)}/>`);
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${out.join('')}</svg>`;
}

/* ===================== interest motifs =====================
   Each interest gets a small line drawing of what it is about, in the same thin
   strokes and weekly palette as the generated covers; the seed only varies details. */
const MOTIFS = (() => {
  const W = 400, H = 300;
  const S = (d, c = 'line', w = 1, o = .8, extra = '') => `<path d="${d}" fill="none" stroke="var(--${c})" stroke-width="${w}" opacity="${o}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
  const C = (x, y, r, c = 'line', w = 1, o = .8, fill = 'none') => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${fill}" stroke="${fill === 'none' ? `var(--${c})` : 'none'}" stroke-width="${w}" opacity="${o}"/>`;
  const dots = (step = 20, o = .3) => { let s = ''; for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) s += `<circle cx="${x}" cy="${y}" r=".9" fill="var(--faint)" opacity="${o}"/>`; return s; };
  const wave = (x0, x1, y, amp, len, ph) => { let d = ''; for (let x = x0; x <= x1; x += 4) d += (d ? 'L' : 'M') + f1(x) + ' ' + f1(y + Math.sin(x / len * TAU + ph) * amp); return d; };

  return {
    // an open book: curved pages, lines of text, a ribbon marker
    reading(r) {
      const o = [dots(20, .22)], cx = 200, top = 72, bot = 236, sag = 16 + r() * 6;
      for (const side of [-1, 1]) {
        const ex = cx + side * 150;
        for (let k = 3; k >= 0; k--) o.push(S(`M${cx} ${bot + k * 3}Q${cx + side * 75} ${bot - sag + k * 3} ${ex - side * k * 2} ${bot - 2 + k * 3}`, 'line', .8, .35));
        o.push(S(`M${cx} ${top}Q${cx + side * 75} ${top - sag} ${ex} ${top - 4}L${ex} ${bot - 2}Q${cx + side * 75} ${bot - sag} ${cx} ${bot}Z`, 'ink', 1.1, .85));
        for (let i = 0; i < 9; i++) {
          const y = top + 22 + i * 15, len = i === 8 ? .45 : .8 + r() * .18;
          const xa = cx + side * 14, xb = cx + side * (14 + 118 * len);
          o.push(S(`M${xa} ${y}Q${(xa + xb) / 2} ${y - sag * .55} ${f1(xb)} ${y - 2}`, 'line', 1, .55));
        }
      }
      o.push(S(`M${cx} ${top}L${cx} ${bot}`, 'ink', 1, .7));
      o.push(`<path d="M${cx + 30} ${top - 12}L${cx + 30} ${top + 46}L${cx + 37} ${top + 38}L${cx + 44} ${top + 46}L${cx + 44} ${top - 14}Z" fill="var(--accent)" opacity=".9"/>`);
      return o.join('');
    },

    // a staff with a melody, and the sound it makes
    music(r) {
      const o = [], y0 = 112, gap = 16;
      for (let i = 0; i < 5; i++) o.push(S(`M24 ${y0 + i * gap}L376 ${y0 + i * gap}`, 'ink', .9, .45));
      for (let k = 0; k < 3; k++) o.push(S(wave(24, 376, y0 + 2 * gap, 26 - k * 7, 70 + k * 18, r() * TAU), k ? 'line' : 'accent', k ? .8 : 1.3, k ? .45 : .8));
      const xs = [74, 122, 170, 218, 266, 314];
      xs.forEach((x, i) => {
        const y = y0 + (Math.round(r() * 8) * gap / 2), acc = i === 3;
        o.push(`<ellipse cx="${x}" cy="${f1(y)}" rx="8.5" ry="6" transform="rotate(-22 ${x} ${f1(y)})" fill="var(--${acc ? 'accent' : 'ink'})" opacity=".9"/>`);
        o.push(S(`M${x + 7.6} ${f1(y - 2)}L${x + 7.6} ${f1(y - 46)}`, 'ink', 1.2, .85));
        xs.__y = xs.__y || []; xs.__y[i] = y - 46;
      });
      o.push(`<path d="M${xs[0] + 7.6} ${f1(xs.__y[0])}L${xs[1] + 7.6} ${f1(xs.__y[1])}L${xs[1] + 7.6} ${f1(xs.__y[1] + 6)}L${xs[0] + 7.6} ${f1(xs.__y[0] + 6)}Z" fill="var(--ink)" opacity=".85"/>`);
      return o.join('');
    },

    // a controller over a pixel field, with a few falling blocks
    games(r) {
      const o = [];
      for (let y = 10; y < H; y += 20) for (let x = 10; x < W; x += 20) o.push(`<rect x="${x - 7}" y="${y - 7}" width="14" height="14" fill="none" stroke="var(--rule)" stroke-width=".8"/>`);
      const shapes = [[[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]]];
      for (let k = 0; k < 4; k++) {
        const sh = shapes[(r() * shapes.length) | 0], gx = 1 + ((r() * 17) | 0), gy = (r() * 2) | 0, acc = k === 0;
        for (const [dx, dy] of sh) o.push(`<rect x="${(gx + dx) * 20 + 3}" y="${(gy + dy) * 20 + 3}" width="14" height="14" fill="var(--${acc ? 'accent' : 'line'})" opacity="${acc ? .9 : .45}"/>`);
      }
      o.push(`<path d="M120 118H280C326 118 342 150 350 196C356 232 330 250 306 232L278 210H122L94 232C70 250 44 232 50 196C58 150 74 118 120 118Z" fill="var(--raised)" stroke="var(--ink)" stroke-width="1.4"/>`);
      o.push(`<path d="M120 152h12v-12h12v12h12v12h-12v12h-12v-12h-12z" fill="var(--ink)" opacity=".85"/>`);
      [[280, 146], [298, 164], [280, 182], [262, 164]].forEach(([x, y], i) => o.push(C(x, y, 8, 'ink', 1.2, .9, i === 0 ? 'var(--accent)' : 'none')));
      o.push(`<rect x="182" y="160" width="16" height="6" rx="3" fill="var(--line)" opacity=".7"/><rect x="204" y="160" width="16" height="6" rx="3" fill="var(--line)" opacity=".7"/>`);
      return o.join('');
    },

    // a stadium track, a runner and the trail behind
    running(r) {
      const o = [dots(24, .2)], cx = 200, cy = 150, L = 150;
      for (let k = 0; k < 5; k++) {
        const R = 38 + k * 15;
        o.push(S(`M${cx - L / 2} ${cy - R}H${cx + L / 2}A${R} ${R} 0 0 1 ${cx + L / 2} ${cy + R}H${cx - L / 2}A${R} ${R} 0 0 1 ${cx - L / 2} ${cy - R}Z`, k === 4 || k === 0 ? 'ink' : 'line', k === 4 || k === 0 ? 1.1 : .8, .7));
      }
      o.push(S(`M${cx + 20} ${cy + 38}L${cx + 20} ${cy + 98}`, 'ink', 1.4, .8));
      const R = 38 + 2.5 * 15, a = -.6 - r() * .8, rx = cx + L / 2 + Math.cos(a) * R, ry = cy + Math.sin(a) * R;
      o.push(S(`M${cx - 30} ${cy - R}H${cx + L / 2}A${R} ${R} 0 0 1 ${f1(rx)} ${f1(ry)}`, 'accent', 2, .85, ' stroke-dasharray="2 7"'));
      o.push(C(rx, ry, 7, 'accent', 1, 1, 'var(--accent)'));
      return o.join('');
    },

    // lane ropes, water, and the wake of a swimmer
    swimming(r) {
      const o = [], lanes = [48, 116, 184, 252];
      lanes.forEach(y => { for (let x = 8; x < W; x += 12) o.push(C(x, y, 2.6, 'line', 1, .8, `var(--${(x / 12 | 0) % 4 === 0 ? 'accent' : 'line'})`)); });
      for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) o.push(S(wave(0, W, lanes[i] + 22 + k * 22, 4, 46 + k * 9, r() * TAU), 'line', .8, .45));
      const sx = 120 + r() * 160, sy = lanes[1] + 34;
      for (let k = 1; k <= 4; k++) o.push(S(`M${f1(sx - k * 22)} ${f1(sy - k * 10)}Q${f1(sx - k * 6)} ${sy} ${f1(sx - k * 22)} ${f1(sy + k * 10)}`, 'ink', 1, .75 - k * .13));
      o.push(C(sx, sy, 6.5, 'accent', 1, 1, 'var(--accent)'));
      o.push(S(`M${f1(sx - 4)} ${f1(sy - 3)}L${f1(sx + 18)} ${f1(sy - 16)}M${f1(sx - 4)} ${f1(sy + 3)}L${f1(sx + 18)} ${f1(sy + 16)}`, 'ink', 1.2, .8));
      return o.join('');
    },

    // a street map and a dotted walk through it
    citywalks(r) {
      const o = [], xs = [], ys = [];
      for (let x = 20 + r() * 20; x < W; x += 44 + r() * 30) xs.push(x);
      for (let y = 18 + r() * 16; y < H; y += 40 + r() * 26) ys.push(y);
      if (xs.length > 2) o.push(`<rect x="${f1(xs[1] + 5)}" y="${f1(ys[0] + 5)}" width="${f1(xs[2] - xs[1] - 10)}" height="${f1(ys[1] - ys[0] - 10)}" fill="var(--line)" opacity=".12"/>`);
      xs.forEach((x, i) => o.push(S(`M${f1(x)} 0L${f1(x + (r() - .5) * 14)} ${H}`, i % 3 ? 'line' : 'ink', i % 3 ? .8 : 1.3, .6)));
      ys.forEach((y, i) => o.push(S(`M0 ${f1(y)}L${W} ${f1(y + (r() - .5) * 12)}`, i % 2 ? 'line' : 'ink', i % 2 ? .8 : 1.3, .6)));
      o.push(S(`M-10 ${f1(H * (.55 + r() * .3))}C${W * .3} ${f1(H * r())} ${W * .6} ${H} ${W + 10} ${f1(H * (.1 + r() * .3))}`, 'line', 10, .12));   // a river
      let ix = 0, iy = ys.length - 1, x = xs[0], y = ys[iy], d = `M${f1(x)} ${f1(y)}`;
      while (ix < xs.length - 1 || iy > 0) {
        if (iy > 0 && (ix >= xs.length - 1 || r() < .45)) iy--; else ix++;
        x = xs[ix]; y = ys[iy]; d += `L${f1(x)} ${f1(y)}`;
      }
      o.push(S(d, 'accent', 3, .95, ' stroke-dasharray="0.1 8"'));
      o.push(C(xs[0], ys[ys.length - 1], 6, 'accent', 1.6, 1));
      o.push(`<path d="M${f1(x)} ${f1(y + 2)}c-9-11-9-23 0-23s9 12 0 23z" fill="var(--accent)" transform="translate(0 -6)"/>`);
      return o.join('');
    },

    // a steaming bowl and a pair of chopsticks
    goodfood(r) {
      const o = [dots(20, .2)], cx = 200, rim = 172, rx = 104;
      for (let k = 0; k < 3; k++) {
        const x0 = cx - 40 + k * 40, ph = r() * TAU;
        let d = ''; for (let y = rim - 18; y > 54; y -= 4) d += (d ? 'L' : 'M') + f1(x0 + Math.sin((rim - y) / 22 + ph) * 9) + ' ' + y;
        o.push(S(d, k === 1 ? 'accent' : 'line', k === 1 ? 1.5 : 1, k === 1 ? .85 : .55));
      }
      o.push(S(`M${cx - rx} ${rim}A${rx} ${rx * .72} 0 0 0 ${cx + rx} ${rim}`, 'ink', 1.4, .9));
      o.push(`<ellipse cx="${cx}" cy="${rim}" rx="${rx}" ry="15" fill="none" stroke="var(--ink)" stroke-width="1.2" opacity=".85"/>`);
      for (let i = 0; i < 26; i++) { const a = r() * TAU, rr = Math.sqrt(r()); o.push(`<ellipse cx="${f1(cx + Math.cos(a) * rr * (rx - 16))}" cy="${f1(rim + Math.sin(a) * rr * 9)}" rx="3" ry="1.6" fill="var(--line)" opacity=".55"/>`); }
      o.push(`<ellipse cx="${cx + 28}" cy="${rim - 2}" rx="13" ry="6" fill="var(--accent)" opacity=".9"/>`);
      o.push(S(`M${cx - 36} ${rim + rx * .72 - 2}L${cx + 36} ${rim + rx * .72 - 2}`, 'ink', 1.2, .8));
      o.push(S(`M${cx + 40} ${rim - 6}L${cx + 150} ${rim - 120}M${cx + 54} ${rim - 2}L${cx + 168} ${rim - 108}`, 'ink', 2.2, .85));
      return o.join('');
    },
  };
})();
function motif(title) {
  const draw = MOTIFS[String(title).toLowerCase().replace(/[^a-z]/g, '')];
  return draw ? `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${draw(rng(hashStr('motif:' + title)))}</svg>` : null;
}

// one card for code and sharing alike: cover, meta line, linked title, text, optional extras.
// A logo is shown whole on dotted paper; imageFit "cover" fills the frame instead (for
// posters and screenshots), cropped around imagePosition.
function card({ key, image, imageFit, imagePosition, imageZoom, href, title, lang, meta, text, extra = '' }) {
  const fill = imageFit === 'cover';
  const css = [fill && imagePosition ? `object-position:${imagePosition}` : '', imageZoom ? `--zoom:${+imageZoom || 1}` : ''].filter(Boolean).join(';');
  const pos = css ? ` style="${esc(css)}"` : '';
  const top = image
    ? `<div class="cover ${fill ? 'photo' : 'logo'}" data-key="${esc(key)}"><img src="${esc(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"${pos} /></div>`
    : `<div class="cover">${cover(key)}</div>`;
  return `<article class="card">
      ${top}
      <div class="card-b">
        <div class="meta">${meta}</div>
        <h3><a class="stretch" href="${esc(href)}" target="_blank" rel="noopener"${lang ? ` lang="${esc(lang)}"` : ''}>${esc(title)}</a></h3>
        <p>${esc(text)}</p>
        ${extra}
      </div>
    </article>`;
}
// a cover image that fails to load gives way to the generated pattern
function wireCovers(root) {
  root.querySelectorAll('.cover.logo img, .cover.photo img').forEach(img => img.addEventListener('error', () => {
    const box = img.parentElement; box.classList.remove('logo', 'photo'); box.innerHTML = cover(box.dataset.key);
  }, { once: true }));
}

/* ===================== email: stored shifted by 5 code points ===================== */
{
  const btn = $('mailBtn'), txt = $('mailText');
  if (btn) {
    const real = [...'qfwyufslElrfnq3htr'].map(ch => String.fromCharCode(ch.charCodeAt(0) - 5)).join('');
    let shown = false;
    btn.addEventListener('click', () => {
      if (shown) { location.href = 'mailto:' + real; return; }
      shown = true;
      btn.classList.add('shown');
      let i = 0;
      const iv = setInterval(() => {
        txt.textContent = real.slice(0, i) + [...real.slice(i)].map(() => '0123456789abcdef'[Math.random() * 16 | 0]).join('');
        if (++i > real.length) { clearInterval(iv); txt.textContent = real; }
      }, RM ? 0 : 30);
    });
  }
}

/* ===================== floating top bar =====================
   Hidden while reading downward; a few pixels of upward scroll bring it back. */
{
  const bar = $('bar');
  let last = scrollY;
  const onScroll = () => {
    const y = scrollY;
    bar.classList.toggle('lifted', y > 4);
    if (y < bar.offsetHeight) bar.classList.remove('away');
    else if (y > last + 6) bar.classList.add('away');
    else if (y < last - 6) bar.classList.remove('away');
    if (Math.abs(y - last) > 6) last = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  // the About hero sizes itself to the screen below the bar, whose height differs on phones
  const measure = () => document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
  measure();
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(bar);
}

/* ===================== shared bits ===================== */
function setText(key, value) {
  if (value == null || value === '') return;
  document.querySelectorAll(`[data-live="${key}"]`).forEach(el => { el.textContent = typeof value === 'number' ? fmt(value) : value; });
}

const isPreprint = p => /^arxiv/i.test(p.conf || '');

/* ===================== page renderers ===================== */
// off the clock: one tile per interest, each with its own generated cover
function renderInterests(D) {
  const list = D.interests || [];
  if (!list.length) return;
  // families are dealt in turn here, so neighbouring tiles never share a style
  // an interest with a url (a reading log, a playlist, a photo stream) links out
  $('interestList').innerHTML = list.map((it, i) => `
    <li class="tile${it.url ? ' linked' : ''}">
      <div class="cover">${motif(it.title) || cover('interest:' + it.title, i % 6)}</div>
      <h3>${it.url ? `<a class="stretch" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a>` : esc(it.title)}</h3>
    </li>`).join('');
}

function renderResearch(D) {
  const list = (D.papers || []).map((p, i) => ({ p, i }))
    .sort((a, b) => (parseInt(b.p.year) || 0) - (parseInt(a.p.year) || 0) || isPreprint(a.p) - isPreprint(b.p) || a.i - b.i)
    .map(x => x.p);
  const groups = [];
  for (const p of list) {
    if (groups.at(-1)?.year === p.year) groups.at(-1).items.push(p);
    else groups.push({ year: p.year, items: [p] });
  }
  const tag = t => {
    const tmp = document.createElement('div'); tmp.innerHTML = t.html;
    const a = tmp.querySelector('a'), label = tmp.textContent.replace(/^\[|\]$/g, '');
    return t.class === 'tag-link' && a
      ? `<a href="${esc(a.getAttribute('href'))}" target="_blank" rel="noopener">${esc(label)}</a>`
      : `<span class="info">${esc(label)}</span>`;
  };
  $('paperList').innerHTML = groups.map(g => `
    <section class="year" aria-label="${esc(g.year)}">
      <div class="year-n">${esc(g.year)}</div>
      <div>${g.items.map(p => `
        <article class="paper" id="${esc(p.id)}">
          <div class="meta">${esc(p.conf)}${p.award ? `<span class="dot"></span><span class="acc">${esc(p.award)}</span>` : ''}</div>
          <h3>${esc(p.title)}</h3>
          <p class="p-auth">${p.authorsHtml || ''}</p>
          <div class="p-links">${[...(p.tags || []).filter(t => t.class === 'tag-link'), ...(p.tags || []).filter(t => t.class !== 'tag-link')].map(tag).join('')}</div>
        </article>`).join('')}</div>
    </section>`).join('');
}

// everything I have made and shared, in sections. An item may point at a GitHub repo;
// its stars, language and description then come from the weekly project data.
// Repos that no item mentions still show up, under "Other".
function renderSharing(D) {
  const projects = new Map((D.projects || []).map(p => [String(p.repo).toLowerCase(), p]));
  const used = new Set();
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const clean = t => String(t || '').replace(/\s*:[a-z_+-]+:/g, '').trim();
  const items = (D.sharing || []).map(it => {
    const p = it.repo ? projects.get(it.repo.toLowerCase()) : null;
    if (p) used.add(it.repo.toLowerCase());
    return { ...it, p };
  });
  for (const [key, p] of projects) if (!used.has(key)) items.push({ section: 'other', repo: p.repo, p });

  const sections = [...(D.sections || []), { id: 'other', title: 'Other' }];
  const stars = it => it.p?.stars ?? -1;
  $('sections').innerHTML = sections.map(sec => {
    const list = items.filter(it => it.section === sec.id)
      .toSorted((a, b) => stars(b) - stars(a) || String(b.date || '').localeCompare(String(a.date || '')));
    if (!list.length) return '';
    return `<section class="block share-group" aria-labelledby="sec-${esc(sec.id)}">
      <h2 class="label" id="sec-${esc(sec.id)}">${esc(sec.title)}</h2>
      <div class="cards">${list.map(it => {
        const p = it.p, url = it.url || p?.url;
        const meta = p
          ? `${esc(p.language || 'Markdown')}<span class="dot"></span>★ ${fmt(p.stars || 0)}${p.forks ? `<span class="dot"></span>${fmt(p.forks)} forks` : ''}`
          : `${esc(it.date || '')}<span class="dot"></span>${esc(it.note || host(url))}`;   // note: e.g. a file size instead of the host
        const source = it.source || (p && it.url && p.url !== it.url ? p.url : '');
        return card({
          key: it.repo || it.title,
          image: it.image || p?.image,
          imageFit: it.imageFit || p?.imageFit,
          imagePosition: it.imagePosition || p?.imagePosition,
          imageZoom: it.imageZoom || p?.imageZoom,
          href: url,
          title: it.title || p?.name,
          lang: it.lang,
          meta: (it.tag ? `<span class="acc">${esc(it.tag)}</span><span class="dot"></span>` : '') + meta,
          text: clean(it.desc || p?.desc),
          extra: source ? `<div class="p-links"><a href="${esc(source)}" target="_blank" rel="noopener">Source</a></div>` : '',
        });
      }).join('')}</div>
    </section>`;
  }).join('');
  wireCovers($('sections'));
  setText('githubStars', D.live?.github?.stars);
  setText('githubFollowers', D.live?.github?.followers);
}

function renderPhotos(D) {
  const photos = D.live?.photos || [];
  if (!photos.length) return;
  // a justified wall per year: each frame grows in proportion to its aspect ratio
  const shot = p => {
    const ar = (p.width && p.height) ? p.width / p.height : 1.4;
    return `<figure class="shot" style="flex:${ar.toFixed(3)} 1 ${Math.round(ar * 240)}px;aspect-ratio:${ar.toFixed(3)};margin:0">
      <a href="${esc(p.url)}" target="_blank" rel="noopener" style="display:block;height:100%">
        <img src="${esc(p.image)}" alt="${esc(p.title || 'Photograph')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
        <figcaption lang="zh">${esc(p.title)}<span class="meta">${esc(p.date)}${p.count ? ` · ${p.count} photos` : ''}</span></figcaption>
      </a>
    </figure>`;
  };
  const years = [];
  for (const p of photos.toSorted((a, b) => String(b.date).localeCompare(String(a.date)))) {
    const y = String(p.date).slice(0, 4) || 'Undated';
    if (years.at(-1)?.y === y) years.at(-1).items.push(p); else years.push({ y, items: [p] });
  }
  $('wall').innerHTML = years.map(g => `
    <section class="photo-year" aria-labelledby="y-${esc(g.y)}">
      <h2 class="label" id="y-${esc(g.y)}">${esc(g.y)}<span class="dot"></span>${g.items.length} ${g.items.length > 1 ? 'posts' : 'post'}</h2>
      <div class="wall">${g.items.map(shot).join('')}</div>
    </section>`).join('');
  $('wall').querySelectorAll('img').forEach(img => {
    const ok = () => img.classList.add('ok');
    img.complete ? ok() : img.addEventListener('load', ok, { once: true });
  });
  setText('photoCount', photos.length);
}

function render(D) {
  applyTheme(D.theme);
  if (page === 'about') drawArt(D.theme?.seed);
  ({ research: renderResearch, sharing: renderSharing, interests: renderInterests, photos: renderPhotos })[page]?.(D);
  setText('updated', D.live?.updatedAt);
  setText('week', D.theme?.week);
}

if (page === 'about' && cachedTheme?.seed != null) drawArt(cachedTheme.seed);

// data.js is cache-busted so weekly data updates show up immediately
const dataScript = document.createElement('script');
dataScript.src = './data.js?v=' + Date.now();
dataScript.onload = () => render(typeof SITE_DATA !== 'undefined' ? SITE_DATA : {});
dataScript.onerror = () => { if (page === 'about') drawArt(20261127); };
document.body.appendChild(dataScript);
