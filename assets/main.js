/* Youwei Pang — homepage behaviour. Content lives in data.js (SITE_DATA). */

const $ = id => document.getElementById(id);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const onView = (cb, opts) => 'IntersectionObserver' in window
  ? new IntersectionObserver(es => es.forEach(e => e.isIntersecting && cb(e.target)), opts)
  : { observe: cb, unobserve() { } };
const debounce = (fn, ms = 150) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ===================== one sky for the whole page =====================
   A fixed canvas behind everything, painted like a long-exposure astrophoto.
   A single band of the galaxy winds down the page: faint blue reflection
   nebulae near the top, red emission clouds and dark dust lanes in the middle,
   and the warm, star-packed galactic core at the very bottom. */
const layer = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };

// value noise + fractal sums
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
  for (let i = 0; i < oct; i++) { sum += amp * vnoise(x, y, s + i * 17); norm += amp; x = x * 2.03 + 11.3; y = y * 2.03 + 7.1; amp *= .5; }
  return sum / norm;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

const cosmos = (function () {
  const cv = $('cosmos'), g = cv.getContext('2d');
  const F = .25;                               // the sky scrolls at a quarter of the page speed
  let W = 0, H = 0, D = 1, vw = 0, vh = 0, docH = 0, bgH = 0, cols = 0, rows = 0, T = 1;
  let tex = null, texCtx = null, img = null, mask = null, dust = null, job = 0, chunks = new Map(), near = null, dirty = true;

  // the galaxy band: where its centre lies and how wide it is at page depth v (0 top → 1 bottom)
  const bandAt = v => {
    let cx = .5 + .27 * Math.sin(v * 5.6 + 1.1) + .09 * Math.sin(v * 14 + .4);
    cx = mix(cx, .5, smooth(.72, 1, v));
    return { cx: cx * vw, w: vw * (.2 + .28 * v * v) + 90 };
  };

  function plan() {
    if (!innerWidth || !innerHeight) return false;   // not laid out yet; the next resize builds it
    const nd = document.documentElement.scrollHeight;
    if (innerWidth === vw && Math.abs(nd - docH) < 40 && innerHeight === vh && tex) return false;
    D = Math.min(devicePixelRatio || 1, 2);
    vw = innerWidth; vh = innerHeight; docH = nd;
    W = cv.width = Math.round(vw * D); H = cv.height = Math.round(vh * D);
    bgH = vh + Math.max(0, docH - vh) * F;
    cols = vw < 700 ? 160 : 360; T = vw / cols; rows = Math.ceil(bgH / T);
    tex = layer(cols, rows); texCtx = tex.getContext('2d');
    img = texCtx.createImageData(cols, rows);
    mask = new Float32Array(cols * rows); dust = new Float32Array(cols * rows);
    chunks.clear(); near = makeNear();
    return true;
  }

  // paint the nebula texture a few rows at a time, top first, so the page never stalls
  function paint() {
    const my = ++job, data = img.data;
    let y0 = 0;
    const step = () => {
      if (my !== job) return;
      const y1 = Math.min(rows, y0 + 48);
      for (let ty = y0; ty < y1; ty++) {
        const y = ty * T, v = y / bgH, band = bandAt(v);
        const lift = .65 + .35 * smooth(0, 1, v);                      // the band grows richer as we go down
        for (let tx = 0; tx < cols; tx++) {
          const x = tx * T, nx = x / 380, ny = y / 380;
          const d = (x - band.cx) / band.w, m = Math.exp(-d * d);
          // domain-warped clouds give filaments instead of blobs
          const qx = fbm(nx + 1.7, ny + 9.2, 3, 3), qy = fbm(nx + 8.3, ny + 2.8, 3, 5);
          const n = fbm(nx + 1.9 * qx, ny + 1.9 * qy, 5, 7);
          const hue = fbm(nx * .5 + 5.2, ny * .5 + 1.3, 3, 9);
          const rr = 1 - Math.abs(2 * fbm(nx * 2.2 + 3.1, ny * 2.2 + 4.7, 4, 11) - 1);   // ridges → dust lanes
          const du = smooth(.62, .93, rr) * (.35 + .65 * m) * smooth(.3, .7, n);
          const gas = (Math.pow(smooth(.38, .9, n), 1.5) * m * lift + smooth(.6, .95, n) * .16) * (1 - du * .85);
          const haze = m * (.015 + .05 * v) * (.5 + .8 * n) * (1 - du * .9);   // unresolved star light
          const core = Math.exp(-(((x - vw * .5) / (vw * .45)) ** 2) - (((v - 1.03) / .1) ** 2)) * (1 - du * .85);
          // colour: blue reflection near the top, red emission lower down, oxygen-teal where the gas is densest
          const red = smooth(.3, .7, hue) * smooth(.15, .65, v);
          let r = mix(55, 215, red), gg = mix(90, 45, red), b = mix(225, 95, red);
          const oiii = smooth(.72, .95, n) * (1 - red) * .7;
          r = mix(r, 40, oiii); gg = mix(gg, 180, oiii); b = mix(b, 195, oiii);
          let R = 2 + r * gas * .6 + 235 * haze + 255 * core * .5;
          let G = 3 + gg * gas * .6 + 225 * haze + 186 * core * .5;
          let B = 9 + b * gas * .6 + 210 * haze + 118 * core * .5;
          // keep the sky dark enough for text: cap perceived brightness
          const L = .3 * R + .59 * G + .11 * B, cap = 50 + 40 * core;
          if (L > cap) { const k = cap / L; R *= k; G *= k; B *= k; }
          const i = ty * cols + tx, k = i * 4;
          data[k] = Math.min(255, R); data[k + 1] = Math.min(255, G); data[k + 2] = Math.min(255, B); data[k + 3] = 255;
          mask[i] = m * lift; dust[i] = du;
        }
      }
      texCtx.putImageData(img, 0, 0, 0, y0, cols, y1 - y0);
      y0 = y1; dirty = true;
      if (y0 < rows) setTimeout(step, 0);
    };
    step();
  }

  const sample = (arr, x, y) => {
    const tx = Math.min(cols - 1, Math.max(0, x / T | 0)), ty = Math.min(rows - 1, Math.max(0, y / T | 0));
    return arr ? arr[ty * cols + tx] : 0;
  };

  // a star with a realistic colour and, for the brightest few, a soft halo and faint spikes
  function star(s, x, y, a, r) {
    const t = r(), col = t < .12 ? '170,195,255' : t < .5 ? '235,240,255' : t < .82 ? '255,240,215' : '255,205,165';
    const size = (.55 + a * .9) * D;
    s.fillStyle = `rgba(${col},${.25 + a * .75})`;
    s.fillRect(x * D - size / 2, y * D - size / 2, size, size);
    if (a > .96) {
      const R = (3 + a * 6) * D, gl = s.createRadialGradient(x * D, y * D, 0, x * D, y * D, R);
      gl.addColorStop(0, `rgba(${col},.55)`); gl.addColorStop(.25, `rgba(${col},.12)`); gl.addColorStop(1, `rgba(${col},0)`);
      s.fillStyle = gl; s.fillRect(x * D - R, y * D - R, R * 2, R * 2);
      if (a > .997) {
        s.strokeStyle = `rgba(${col},.14)`; s.lineWidth = .6 * D;
        s.beginPath(); s.moveTo(x * D - R * 2.2, y * D); s.lineTo(x * D + R * 2.2, y * D);
        s.moveTo(x * D, y * D - R * 2.2); s.lineTo(x * D, y * D + R * 2.2); s.stroke();
      }
    }
  }

  // stars belonging to the sky itself, generated per 512px slice and cached; thicker inside the band, hidden by dust
  const CH = 512;
  function chunk(ci) {
    if (chunks.has(ci)) return chunks.get(ci);
    const c = layer(W, CH * D), s = c.getContext('2d'), r = rng(9001 + ci * 131);
    const area = vw * CH, y0 = ci * CH;
    for (let i = 0, n = area / 1500; i < n; i++) star(s, r() * vw, r() * CH, r() ** 4, r);          // everywhere
    for (let i = 0, n = area / 110; i < n; i++) {                                                   // the band
      const x = r() * vw, y = r() * CH, m = sample(mask, x, y0 + y), du = sample(dust, x, y0 + y);
      if (r() > m * .85 * (1 - du)) continue;
      star(s, x, y, r() ** 7, r);
    }
    if (chunks.size > 14) chunks.delete(chunks.keys().next().value);
    chunks.set(ci, c);
    return c;
  }

  // a sparse layer of nearer stars that drifts a little faster, for depth
  function makeNear() {
    const S = Math.round(720 * D), c = layer(S, S), s = c.getContext('2d'), r = rng(4242);
    const save = D; for (let i = 0; i < 70; i++) star(s, r() * 720, r() * 720, .3 + r() ** 3 * .7, r);
    D = save; return c;
  }

  function draw() {
    if (!tex) return;
    const off = scrollY * F;
    g.fillStyle = '#020309'; g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    // only the slice of the texture that is on screen
    const sy0 = Math.max(0, off / T), sh = Math.min(rows - sy0, vh / T + 2);
    if (sh > 0) g.drawImage(tex, 0, sy0, cols, sh, 0, 0, W, sh * T * D);
    for (let ci = Math.floor(off / CH), last = Math.floor((off + vh) / CH); ci <= last; ci++) g.drawImage(chunk(ci), 0, Math.round((ci * CH - off) * D));
    const S = near.width, oy = -((scrollY * .32 * D) % S);
    g.globalAlpha = .8;
    for (let y = oy; y < H; y += S) for (let x = 0; x < W; x += S) g.drawImage(near, x, y);
    g.globalAlpha = 1;
  }

  function loop() { if (dirty) { dirty = false; draw(); } requestAnimationFrame(loop); }
  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  const rebuild = debounce(() => { if (plan()) paint(); dirty = true; }, 120);
  addEventListener('resize', rebuild);
  if ('ResizeObserver' in window) new ResizeObserver(rebuild).observe(document.body);
  if (plan()) paint();
  requestAnimationFrame(loop);
  return { refresh: rebuild };
})();

/* ===================== hero: sunrise over a night-side planet ===================== */
(function scene() {
  const cv = $('scene'), g = cv.getContext('2d');
  let W = 0, H = 0, D = 1, planet = null, sun = null, visible = true, raf = 0;

  function build() {
    if (!cv.clientWidth || !cv.clientHeight) return;   // not laid out yet; the next resize builds it
    D = Math.min(devicePixelRatio || 1, 2);
    W = cv.width = Math.round(cv.clientWidth * D);
    H = cv.height = Math.round(cv.clientHeight * D);
    const r = rng(20250901), narrow = cv.clientWidth < 700;

    // planet: a huge circle whose limb crosses the lower part of the frame, tilted slightly
    const R = Math.max(W, H) * (narrow ? 2.4 : 1.9);
    const horizonY = H * (narrow ? .74 : .7);
    const tilt = narrow ? .05 : .08;
    const cx = W * .55 + Math.sin(tilt) * R, cy = horizonY + Math.cos(tilt) * R;
    const sunA = -Math.acos(Math.max(-1, Math.min(1, (W * (narrow ? .7 : .78) - cx) / R)));   // sun sits on the limb, right of centre
    const sx = cx + Math.cos(sunA) * R, sy = cy + Math.sin(sunA) * R;

    // planet body, city lights, atmosphere
    planet = layer(W, H);
    const p = planet.getContext('2d');
    p.save();
    p.beginPath(); p.arc(cx, cy, R, 0, Math.PI * 2); p.clip();
    const body = p.createLinearGradient(0, horizonY - 20 * D, 0, H);
    body.addColorStop(0, '#0d1a2c'); body.addColorStop(.08, '#060c16'); body.addColorStop(1, '#010203');
    p.fillStyle = body; p.fillRect(0, 0, W, H);
    // day-side scatter near the sun
    const day = p.createRadialGradient(sx, sy, 0, sx, sy, W * .55);
    day.addColorStop(0, 'rgba(90,150,220,.55)'); day.addColorStop(.25, 'rgba(40,80,140,.22)'); day.addColorStop(1, 'rgba(10,20,40,0)');
    p.fillStyle = day; p.fillRect(0, 0, W, H);
    // city lights: clustered, compressed toward the horizon
    const gauss = () => (r() + r() + r() - 1.5) / 1.5;
    for (let k = 0; k < 60; k++) {
      const ox = r() * W, depth = r() ** 1.4;
      const clusterN = 4 + (r() ** 2 * 50 | 0), spread = (14 + r() * 40) * D * (.3 + depth);
      for (let j = 0; j < clusterN; j++) {
        const x = ox + gauss() * spread;
        const limbY = cy - Math.sqrt(Math.max(0, R * R - (x - cx) ** 2));
        const y = limbY + 6 * D + depth * (H - limbY) * .9 + gauss() * spread * .35 * (.2 + depth);
        const fade = Math.min(1, Math.hypot(x - sx, y - sy) / (W * .35));    // daylight washes them out
        p.fillStyle = `rgba(255,${170 + (r() * 50 | 0)},${90 + (r() * 40 | 0)},${(.1 + r() ** 2 * .6) * fade})`;
        const sz = (.4 + r() * .5 + depth * .9) * D;
        p.fillRect(x, y, sz, sz * (.45 + depth * .55));
      }
    }
    p.restore();

    // atmosphere: a thin bright rim and a soft haze above it, strongest toward the sun
    const atm = layer(W, H), a = atm.getContext('2d');
    const rim = a.createRadialGradient(cx, cy, R - 3 * D, cx, cy, R + 90 * D);
    rim.addColorStop(0, 'rgba(160,215,255,0)');
    rim.addColorStop(.03, 'rgba(170,220,255,.95)');
    rim.addColorStop(.07, 'rgba(80,150,255,.55)');
    rim.addColorStop(.25, 'rgba(40,90,210,.16)');
    rim.addColorStop(1, 'rgba(20,40,120,0)');
    a.fillStyle = rim;
    a.beginPath(); a.arc(cx, cy, R + 90 * D, 0, Math.PI * 2); a.arc(cx, cy, R - 3 * D, 0, Math.PI * 2, true); a.fill('evenodd');
    a.globalCompositeOperation = 'destination-in';
    const mask = a.createRadialGradient(sx, sy, 0, sx, sy, W * .95);
    mask.addColorStop(0, 'rgba(0,0,0,1)'); mask.addColorStop(.5, 'rgba(0,0,0,.55)'); mask.addColorStop(1, 'rgba(0,0,0,.18)');
    a.fillStyle = mask; a.fillRect(0, 0, W, H);
    p.drawImage(atm, 0, 0);

    // the sun, just cresting the limb
    sun = layer(W, H);
    const u = sun.getContext('2d');
    u.globalCompositeOperation = 'lighter';
    const glow = u.createRadialGradient(sx, sy, 0, sx, sy, W * .32);
    glow.addColorStop(0, 'rgba(255,250,240,1)'); glow.addColorStop(.02, 'rgba(255,236,200,.95)');
    glow.addColorStop(.08, 'rgba(255,190,120,.35)'); glow.addColorStop(.3, 'rgba(120,150,255,.08)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    u.fillStyle = glow; u.fillRect(0, 0, W, H);
    // anamorphic streak along the horizon
    u.save(); u.translate(sx, sy); u.rotate(tilt); u.scale(1, .018);
    const streak = u.createRadialGradient(0, 0, 0, 0, 0, W * .6);
    streak.addColorStop(0, 'rgba(255,245,230,.9)'); streak.addColorStop(.3, 'rgba(180,210,255,.25)'); streak.addColorStop(1, 'rgba(0,0,0,0)');
    u.fillStyle = streak; u.beginPath(); u.arc(0, 0, W * .6, 0, Math.PI * 2); u.fill();
    u.restore();

    draw(performance.now());
  }

  function draw(t) {
    if (!planet) return;
    const sy = Math.min(scrollY, H / D) * D;
    g.clearRect(0, 0, W, H);
    g.drawImage(planet, 0, sy * .22);
    g.globalAlpha = .88 + .12 * Math.sin(t / 2600);
    g.drawImage(sun, 0, sy * .22);
    g.globalAlpha = 1;
  }

  function loop(t) {
    raf = 0;
    if (!visible) return;
    draw(t);
    if (!RM) raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(loop); };

  build();
  addEventListener('resize', debounce(() => { build(); kick(); }));
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(cv);
  if (RM) addEventListener('scroll', kick, { passive: true });
  kick();
})();

/* ===================== nav ===================== */
{
  const nav = $('nav'), links = $('navLinks'), burger = $('burger'), secs = [...document.querySelectorAll('main section[id]')];
  const drawer = matchMedia('(max-width: 1100px)');
  // a closed drawer is only moved off-screen, so take its links out of the tab order too
  const setOpen = open => {
    links.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open);
    links.inert = drawer.matches && !open;
  };
  drawer.addEventListener('change', () => setOpen(false));
  setOpen(false);
  burger.addEventListener('click', () => setOpen(!links.classList.contains('open')));
  links.addEventListener('click', e => e.target.tagName === 'A' && setOpen(false));
  addEventListener('keydown', e => e.key === 'Escape' && setOpen(false));
  $('hint').addEventListener('click', () => $('mission').scrollIntoView());
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('solid', y > 40);
    // hide while reading downward, return on a real upward scroll or near the top;
    // small jitters in between keep the current state
    if (y < innerHeight * .6 || y < lastY - 4 || links.classList.contains('open')) nav.classList.remove('away');
    else if (y > lastY + 4) nav.classList.add('away');
    if (Math.abs(y - lastY) > 4) lastY = y;
    const cur = secs.filter(s => s.getBoundingClientRect().top < innerHeight * .4).pop()?.id;
    links.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.hash === '#' + cur));
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// The address is stored shifted by 5 code points to keep it away from scrapers.
{
  const btn = $('mailBtn'), txt = $('mailText');
  const real = [...'qfwyufslElrfnq3htr'].map(ch => String.fromCharCode(ch.charCodeAt(0) - 5)).join('');
  let shown = false;
  btn.addEventListener('click', () => {
    if (shown) { location.href = 'mailto:' + real; return; }
    shown = true;
    btn.classList.add('shown');
    let i = 0;
    const iv = setInterval(() => {
      txt.textContent = real.slice(0, i) + [...real.slice(i)].map(() => '0123456789ABCDEF'[Math.random() * 16 | 0]).join('');
      if (++i > real.length) { clearInterval(iv); txt.textContent = real; }
    }, RM ? 0 : 35);
  });
}

/* ===================== reveal on scroll ===================== */
const revealIO = onView(el => { el.classList.add('in'); revealIO.unobserve(el); }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
function reveal(root = document) {
  root.querySelectorAll('.rv:not(.in)').forEach((el, i) => { el.style.transitionDelay = i % 4 * 80 + 'ms'; revealIO.observe(el); });
}

/* ===================== data-driven sections ===================== */
function renderPapers(list) {
  const isPre = p => /^arxiv/i.test(p.conf || '');
  const papers = list.map((p, i) => ({ p, i }))
    .sort((a, b) => (parseInt(b.p.year) || 0) - (parseInt(a.p.year) || 0) || isPre(a.p) - isPre(b.p) || a.i - b.i)
    .map(x => x.p);
  const groups = [];
  for (const p of papers) {
    if (groups.at(-1)?.year === p.year) groups.at(-1).items.push(p);
    else groups.push({ year: p.year, items: [p] });
  }
  const tag = t => {
    const tmp = document.createElement('div'); tmp.innerHTML = t.html;
    const a = tmp.querySelector('a'), label = tmp.textContent.replace(/^\[|\]$/g, '');
    return t.class === 'tag-link' && a
      ? `<a href="${esc(a.getAttribute('href'))}" target="_blank" rel="noopener">${esc(label)}</a>`
      : `<span class="p-info">${esc(label)}</span>`;
  };
  const links = p => (p.tags || []).filter(t => t.class === 'tag-link');
  const infos = p => (p.tags || []).filter(t => t.class !== 'tag-link');
  // a white square marks first / co-first / corresponding authorship
  const mine = p => /^<span class="author-me">|author-me">Youwei Pang<\/span>[*#]/.test(p.authorsHtml || '');
  $('paperList').innerHTML = groups.map(g => `
    <div class="pyear">
      <div class="pyear-n">${esc(g.year)}</div>
      <div>${g.items.map(p => `
        <article class="paper rv${mine(p) ? ' first' : ''}" id="${esc(p.id)}">
          <div class="p-venue"><span>${esc(p.conf)}</span>${p.award ? `<span class="p-award">${esc(p.award)}</span>` : ''}</div>
          <div class="p-title">${esc(p.title)}</div>
          <div class="p-auth">${p.authorsHtml || ''}</div>
          <div class="p-tags">${[...links(p), ...infos(p)].map(tag).join('')}</div>
        </article>`).join('')}
      </div>
    </div>`).join('');
}

function renderRepos(list) {
  const LIMIT = 9;
  const projs = [...list].sort((a, b) => (b.stars || 0) - (a.stars || 0));
  const max = Math.log10((projs[0]?.stars || 1) + 1);
  const card = p => `<a class="repo rv" href="${esc(p.url)}" target="_blank" rel="noopener">
      <div class="repo-head"><span class="repo-name">${esc(p.name)}</span><span class="repo-star" title="stars">${(p.stars || 0).toLocaleString('en')}</span></div>
      <div class="repo-desc">${esc(String(p.desc || '').replace(/:[a-z_]+:/g, '').trim())}</div>
      <div class="repo-foot"><span>${esc(p.language || '')}</span><span class="repo-bar"><i style="width:${Math.max(3, Math.log10((p.stars || 0) + 1) / max * 100).toFixed(1)}%"></i></span></div>
    </a>`;
  const repos = $('repos'), more = $('moreRepos');
  repos.innerHTML = projs.slice(0, LIMIT).map(card).join('');
  if (projs.length <= LIMIT) return;
  more.hidden = false;
  more.querySelector('i').textContent = projs.length - LIMIT;
  more.addEventListener('click', () => {
    repos.insertAdjacentHTML('beforeend', projs.slice(LIMIT).map(card).join(''));
    more.hidden = true;
    reveal(repos);
  }, { once: true });
}

function renderLog(news, resources) {
  const li = n => `<li><time>${esc(n.date)}</time><span>${n.content}</span></li>`;
  $('news').innerHTML = news.map(li).join('');
  $('resources').innerHTML = resources.map(li).join('');
  document.querySelectorAll('#news a, #resources a').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
}

// numbers count up the first time they scroll into view
const counterIO = onView(el => {
  counterIO.unobserve(el);
  const target = +el.dataset.target, t0 = performance.now();
  if (RM) { el.textContent = target.toLocaleString('en'); return; }
  (function tick() {
    const k = Math.min(1, (performance.now() - t0) / 1400);
    el.textContent = Math.round(target * (1 - (1 - k) ** 3)).toLocaleString('en');
    if (k < 1) requestAnimationFrame(tick);
  })();
}, { threshold: .4 });

function setLive(key, value) {
  if (value == null) return;
  document.querySelectorAll(`[data-live="${key}"]`).forEach(el => {
    if (typeof value !== 'number') { el.textContent = value; return; }
    el.dataset.target = value;
    counterIO.observe(el);
  });
}

/* ---------- photos: a horizontal film strip ---------- */
function renderPhotos(photos) {
  const list = photos.length ? photos.slice(0, 12) : Array.from({ length: 5 }, () => ({ url: 'https://yooweey.tuchong.com/' }));
  const strip = $('shots');
  strip.innerHTML = list.map(p => `<a class="shot" href="${esc(p.url)}" target="_blank" rel="noopener">
      <div class="shot-frame">${p.image ? `<img alt="${esc(p.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${esc(p.image)}" />` : ''}</div>
      <div class="shot-cap">${esc(p.title || '图虫')}</div>
      <div class="shot-meta">${esc(p.date || '')}${p.count ? ' · ' + p.count : ''}</div>
    </a>`).join('');
  strip.querySelectorAll('img').forEach(img => {
    const ok = () => img.naturalWidth ? img.classList.add('ok') : img.remove();
    if (img.complete) ok(); else { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', () => img.remove(), { once: true }); }
  });
}
{
  const strip = $('shots');
  const step = dir => strip.scrollBy({ left: dir * (strip.querySelector('.shot')?.offsetWidth + 16 || 300), behavior: RM ? 'auto' : 'smooth' });
  $('shotPrev').addEventListener('click', () => step(-1));
  $('shotNext').addEventListener('click', () => step(1));
}

/* ---------- GitHub contribution calendar (live) ---------- */
fetch('https://github-contributions-api.jogruber.de/v4/lartpang?y=last')
  .then(r => r.ok ? r.json() : Promise.reject(r.status))
  .then(({ contributions: days = [] }) => {
    if (!days.length) throw new Error('empty');
    const pad = new Date(days[0].date + 'T00:00:00').getDay();   // align the first column to its weekday
    $('heat').innerHTML = '<i style="visibility:hidden"></i>'.repeat(pad)
      + days.map(d => `<i data-l="${d.level}" title="${d.date}: ${d.count}"></i>`).join('');
  })
  .catch(() => { $('gh').hidden = true; });

/* ---------- boot ---------- */
function render(D) {
  const live = D.live || {};
  renderPapers(D.papers || []);
  renderRepos(D.projects || []);
  renderLog(D.news || [], D.resources || []);
  renderPhotos(live.photos || []);
  setLive('yuqueDocs', live.yuque?.docs);
  setLive('yuqueFollowers', live.yuque?.followers);
  setLive('csdnVisitors', live.csdn?.visitors);
  setLive('csdnFollowers', live.csdn?.followers);
  reveal();
  cosmos.refresh();
}

reveal();
// data.js is cache-busted so weekly data updates show up immediately
const dataScript = document.createElement('script');
dataScript.src = './data.js?v=' + Date.now();
dataScript.onload = () => render(typeof SITE_DATA !== 'undefined' ? SITE_DATA : {});
document.body.appendChild(dataScript);
